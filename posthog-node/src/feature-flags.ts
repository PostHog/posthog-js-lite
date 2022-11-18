import { createHash } from 'crypto'
import { FeatureFlagCondition, PostHogFeatureFlag } from './types'
import { version } from '../package.json'
import { PostHogFetchOptions, PostHogFetchResponse } from 'posthog-core/src'
import { safeSetTimeout } from 'posthog-core/src/utils'
import { fetch } from './fetch'

// eslint-disable-next-line
const LONG_SCALE = 0xfffffffffffffff

class ClientError extends Error {
  constructor(message: string) {
    super()
    Error.captureStackTrace(this, this.constructor)
    this.name = 'ClientError'
    this.message = message
    Object.setPrototypeOf(this, ClientError.prototype)
  }
}

class InconclusiveMatchError extends Error {
  constructor(message: string) {
    super(message)
    this.name = this.constructor.name
    Error.captureStackTrace(this, this.constructor)
    // instanceof doesn't work in ES3 or ES5
    // https://www.dannyguo.com/blog/how-to-fix-instanceof-not-working-for-custom-errors-in-typescript/
    // this is the workaround
    Object.setPrototypeOf(this, InconclusiveMatchError.prototype)
  }
}

type FeatureFlagsPollerOptions = {
  personalApiKey: string
  projectApiKey: string
  host: string
  pollingInterval: number
  timeout?: number
  fetch?: (url: string, options: PostHogFetchOptions) => Promise<PostHogFetchResponse>
}

class FeatureFlagsPoller {
  pollingInterval: number
  personalApiKey: string
  projectApiKey: string
  featureFlags: Array<PostHogFeatureFlag>
  groupTypeMapping: Record<string, string>
  loadedSuccessfullyOnce: boolean
  timeout?: number
  host: FeatureFlagsPollerOptions['host']
  poller?: NodeJS.Timeout
  fetch: (url: string, options: PostHogFetchOptions) => Promise<PostHogFetchResponse>

  constructor({
    pollingInterval,
    personalApiKey,
    projectApiKey,
    timeout,
    host,
    ...options
  }: FeatureFlagsPollerOptions) {
    this.pollingInterval = pollingInterval
    this.personalApiKey = personalApiKey
    this.featureFlags = []
    this.groupTypeMapping = {}
    this.loadedSuccessfullyOnce = false
    this.timeout = timeout
    this.projectApiKey = projectApiKey
    this.host = host
    this.poller = undefined
    // NOTE: as any is required here as the AbortSignal typing is slightly misaligned but works just fine
    this.fetch = options.fetch || fetch

    void this.loadFeatureFlags()
  }

  async getFeatureFlag(
    key: string,
    distinctId: string,
    groups: Record<string, string> = {},
    personProperties: Record<string, string> = {},
    groupProperties: Record<string, Record<string, string>> = {}
  ): Promise<string | boolean | undefined> {
    await this.loadFeatureFlags()

    let response = undefined
    let featureFlag = undefined

    if (!this.loadedSuccessfullyOnce) {
      return response
    }

    for (const flag of this.featureFlags) {
      if (key === flag.key) {
        featureFlag = flag
        break
      }
    }

    if (featureFlag !== undefined) {
      try {
        response = this.computeFlagLocally(featureFlag, distinctId, groups, personProperties, groupProperties)
        console.debug(`Successfully computed flag locally: ${key} -> ${response}`)
      } catch (e) {
        if (e instanceof InconclusiveMatchError) {
          console.debug(`Can't compute flag locally: ${key}: ${e}`)
        } else if (e instanceof Error) {
          console.error(`Error computing flag locally: ${key}: ${e}`)
        }
      }
    }

    return response
  }

  async getAllFlags(
    distinctId: string,
    groups: Record<string, string> = {},
    personProperties: Record<string, string> = {},
    groupProperties: Record<string, Record<string, string>> = {}
  ): Promise<{ response: Record<string, string | boolean>; fallbackToDecide: boolean }> {
    await this.loadFeatureFlags()

    const response: Record<string, string | boolean> = {}
    let fallbackToDecide = this.featureFlags.length == 0

    this.featureFlags.map((flag) => {
      try {
        response[flag.key] = this.computeFlagLocally(flag, distinctId, groups, personProperties, groupProperties)
      } catch (e) {
        if (e instanceof InconclusiveMatchError) {
          // do nothing
        } else if (e instanceof Error) {
          console.error(`Error computing flag locally: ${flag.key}: ${e}`)
        }
        fallbackToDecide = true
      }
    })

    return { response, fallbackToDecide }
  }

  computeFlagLocally(
    flag: PostHogFeatureFlag,
    distinctId: string,
    groups: Record<string, string> = {},
    personProperties: Record<string, string> = {},
    groupProperties: Record<string, Record<string, string>> = {}
  ): string | boolean {
    if (flag.ensure_experience_continuity) {
      throw new InconclusiveMatchError('Flag has experience continuity enabled')
    }

    if (!flag.active) {
      return false
    }

    const flagFilters = flag.filters || {}
    const aggregation_group_type_index = flagFilters.aggregation_group_type_index

    if (aggregation_group_type_index != undefined) {
      const groupName = this.groupTypeMapping[String(aggregation_group_type_index)]

      if (!groupName) {
        console.warn(
          `[FEATURE FLAGS] Unknown group type index ${aggregation_group_type_index} for feature flag ${flag.key}`
        )
        throw new InconclusiveMatchError('Flag has unknown group type index')
      }

      if (!(groupName in groups)) {
        console.warn(`[FEATURE FLAGS] Can't compute group feature flag: ${flag.key} without group names passed in`)
        return false
      }

      const focusedGroupProperties = groupProperties[groupName]
      return this.matchFeatureFlagProperties(flag, groups[groupName], focusedGroupProperties)
    } else {
      return this.matchFeatureFlagProperties(flag, distinctId, personProperties)
    }
  }

  matchFeatureFlagProperties(
    flag: PostHogFeatureFlag,
    distinctId: string,
    properties: Record<string, string>
  ): string | boolean {
    const flagFilters = flag.filters || {}
    const flagConditions = flagFilters.groups || []
    let isInconclusive = false
    let result = undefined

    // # Stable sort conditions with variant overrides to the top. This ensures that if overrides are present, they are
    // # evaluated first, and the variant override is applied to the first matching condition.
    const sortedFlagConditions = [...flagConditions].sort((conditionA, conditionB) => {
      const AHasVariantOverride = !!conditionA.variant
      const BHasVariantOverride = !!conditionB.variant

      if (AHasVariantOverride && BHasVariantOverride) {
        return 0
      } else if (AHasVariantOverride) {
        return -1
      } else if (BHasVariantOverride) {
        return 1
      } else {
        return 0
      }
    })

    for (const condition of sortedFlagConditions) {
      try {
        if (this.isConditionMatch(flag, distinctId, condition, properties)) {
          const variantOverride = condition.variant
          const flagVariants = flagFilters.multivariate?.variants || []
          if (variantOverride && flagVariants.some((variant) => variant.key === variantOverride)) {
            result = variantOverride
          } else {
            result = this.getMatchingVariant(flag, distinctId) || true
          }
          break
        }
      } catch (e) {
        if (e instanceof InconclusiveMatchError) {
          isInconclusive = true
        } else {
          throw e
        }
      }
    }

    if (result !== undefined) {
      return result
    } else if (isInconclusive) {
      throw new InconclusiveMatchError("Can't determine if feature flag is enabled or not with given properties")
    }

    // We can only return False when all conditions are False
    return false
  }

  isConditionMatch(
    flag: PostHogFeatureFlag,
    distinctId: string,
    condition: FeatureFlagCondition,
    properties: Record<string, string>
  ): boolean {
    const rolloutPercentage = condition.rollout_percentage

    if ((condition.properties || []).length > 0) {
      const matchAll = condition.properties.every((property) => {
        return matchProperty(property, properties)
      })
      if (!matchAll) {
        return false
      } else if (rolloutPercentage == undefined) {
        // == to include `null` as a match, not just `undefined`
        return true
      }
    }

    if (rolloutPercentage != undefined && _hash(flag.key, distinctId) > rolloutPercentage / 100.0) {
      return false
    }

    return true
  }

  getMatchingVariant(flag: PostHogFeatureFlag, distinctId: string): string | boolean | undefined {
    const hashValue = _hash(flag.key, distinctId, 'variant')
    const matchingVariant = this.variantLookupTable(flag).find((variant) => {
      return hashValue >= variant.valueMin && hashValue < variant.valueMax
    })

    if (matchingVariant) {
      return matchingVariant.key
    }
    return undefined
  }

  variantLookupTable(flag: PostHogFeatureFlag): { valueMin: number; valueMax: number; key: string }[] {
    const lookupTable: { valueMin: number; valueMax: number; key: string }[] = []
    let valueMin = 0
    let valueMax = 0
    const flagFilters = flag.filters || {}
    const multivariates: {
      key: string
      rollout_percentage: number
    }[] = flagFilters.multivariate?.variants || []

    multivariates.forEach((variant) => {
      valueMax = valueMin + variant.rollout_percentage / 100.0
      lookupTable.push({ valueMin, valueMax, key: variant.key })
      valueMin = valueMax
    })
    return lookupTable
  }

  async loadFeatureFlags(forceReload = false): Promise<void> {
    if (!this.loadedSuccessfullyOnce || forceReload) {
      await this._loadFeatureFlags()
    }
  }

  async _loadFeatureFlags(): Promise<void> {
    if (this.poller) {
      clearTimeout(this.poller)
      this.poller = undefined
    }
    this.poller = setTimeout(() => this._loadFeatureFlags(), this.pollingInterval)

    try {
      const res = await this._requestFeatureFlagDefinitions()

      if (res && res.status === 401) {
        throw new ClientError(
          `Your personalApiKey is invalid. Are you sure you're not using your Project API key? More information: https://posthog.com/docs/api/overview`
        )
      }
      const responseJson = await res.json()
      if (!('flags' in responseJson)) {
        console.error(`Invalid response when getting feature flags: ${JSON.stringify(responseJson)}`)
      }

      this.featureFlags = responseJson.flags || []
      this.groupTypeMapping = responseJson.group_type_mapping || {}
      this.loadedSuccessfullyOnce = true
    } catch (err) {
      // if an error that is not an instance of ClientError is thrown
      // we silently ignore the error when reloading feature flags
      if (err instanceof ClientError) {
        throw err
      }
    }
  }

  async _requestFeatureFlagDefinitions(): Promise<PostHogFetchResponse> {
    const url = `${this.host}/api/feature_flag/local_evaluation?token=${this.projectApiKey}`

    const options: PostHogFetchOptions = {
      method: 'GET',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${this.personalApiKey}`,
        'user-agent': `posthog-node/${version}`,
      },
    }

    let abortTimeout = null

    if (this.timeout && typeof this.timeout === 'number') {
      const controller = new AbortController()
      abortTimeout = safeSetTimeout(() => {
        controller.abort()
      }, this.timeout)
      options.signal = controller.signal
    }

    try {
      return await this.fetch(url, options)
    } catch (err) {
      throw new Error(`Request failed with error: ${err}`)
    } finally {
      clearTimeout(abortTimeout)
    }
  }

  stopPoller(): void {
    clearTimeout(this.poller)
  }
}

// # This function takes a distinct_id and a feature flag key and returns a float between 0 and 1.
// # Given the same distinct_id and key, it'll always return the same float. These floats are
// # uniformly distributed between 0 and 1, so if we want to show this feature to 20% of traffic
// # we can do _hash(key, distinct_id) < 0.2
function _hash(key: string, distinctId: string, salt: string = ''): number {
  const sha1Hash = createHash('sha1')
  sha1Hash.update(`${key}.${distinctId}${salt}`)
  return parseInt(sha1Hash.digest('hex').slice(0, 15), 16) / LONG_SCALE
}

function matchProperty(
  property: FeatureFlagCondition['properties'][number],
  propertyValues: Record<string, any>
): boolean {
  const key = property.key
  const value = property.value
  const operator = property.operator || 'exact'

  if (!(key in propertyValues)) {
    throw new InconclusiveMatchError(`Property ${key} not found in propertyValues`)
  } else if (operator === 'is_not_set') {
    throw new InconclusiveMatchError(`Operator is_not_set is not supported`)
  }

  const overrideValue = propertyValues[key]

  switch (operator) {
    case 'exact':
      return Array.isArray(value) ? value.indexOf(overrideValue) !== -1 : value === overrideValue
    case 'is_not':
      return Array.isArray(value) ? value.indexOf(overrideValue) === -1 : value !== overrideValue
    case 'is_set':
      return key in propertyValues
    case 'icontains':
      return String(overrideValue).toLowerCase().includes(String(value).toLowerCase())
    case 'not_icontains':
      return !String(overrideValue).toLowerCase().includes(String(value).toLowerCase())
    case 'regex':
      return isValidRegex(String(value)) && String(overrideValue).match(String(value)) !== null
    case 'not_regex':
      return isValidRegex(String(value)) && String(overrideValue).match(String(value)) === null
    case 'gt':
      return typeof overrideValue == typeof value && overrideValue > value
    case 'gte':
      return typeof overrideValue == typeof value && overrideValue >= value
    case 'lt':
      return typeof overrideValue == typeof value && overrideValue < value
    case 'lte':
      return typeof overrideValue == typeof value && overrideValue <= value
    case 'is_date_after':
    case 'is_date_before':
      const parsedDate = convertToDateTime(value)
      const overrideDate = convertToDateTime(overrideValue)
      if (operator === 'is_date_before') {
        return overrideDate < parsedDate
      }
      return overrideDate > parsedDate
    default:
      console.error(`Unknown operator: ${operator}`)
      return false
  }
}

function isValidRegex(regex: string): boolean {
  try {
    new RegExp(regex)
    return true
  } catch (err) {
    return false
  }
}

function convertToDateTime(value: string | number | (string | number)[] | Date): Date {
  if (value instanceof Date) {
    return value
  } else if (typeof value === 'string' || typeof value === 'number') {
    const date = new Date(value)
    if (!isNaN(date.valueOf())) {
      return date
    }
    throw new InconclusiveMatchError(`${value} is in an invalid date format`)
  } else {
    throw new InconclusiveMatchError(`The date provided ${value} must be a string, number, or date object`)
  }
}

export { FeatureFlagsPoller, matchProperty, InconclusiveMatchError, ClientError }

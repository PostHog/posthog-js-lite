import { version } from '../package.json'

import {
  JsonType,
  PostHogCoreStateless,
  PostHogFlagsResponse,
  PostHogFetchOptions,
  PostHogFetchResponse,
  PostHogFlagsAndPayloadsResponse,
  PostHogPersistedProperty,
  safeSetTimeout,
} from 'posthog-core'
import { EventMessage, GroupIdentifyMessage, IdentifyMessage, IPostHog, PostHogOptions } from './types'
import { FeatureFlagDetail, FeatureFlagValue } from 'posthog-core'
import { FeatureFlagsPoller } from './extensions/feature-flags/feature-flags'
import ErrorTracking from './extensions/error-tracking'
import { getFeatureFlagValue } from 'posthog-core'
import { PostHogMemoryStorage } from './storage-memory'

// Standard local evaluation rate limit is 600 per minute (10 per second),
// so the fastest a poller should ever be set is 100ms.
const MINIMUM_POLLING_INTERVAL = 100
const THIRTY_SECONDS = 30 * 1000
const MAX_CACHE_SIZE = 50 * 1000

// The actual exported Nodejs API.
export abstract class PostHogBackendClient extends PostHogCoreStateless implements IPostHog {
  private _memoryStorage = new PostHogMemoryStorage()

  private featureFlagsPoller?: FeatureFlagsPoller
  protected errorTracking: ErrorTracking
  private maxCacheSize: number
  public readonly options: PostHogOptions

  distinctIdHasSentFlagCalls: Record<string, string[]>

  constructor(apiKey: string, options: PostHogOptions = {}) {
    super(apiKey, options)

    this.options = options

    this.options.featureFlagsPollingInterval =
      typeof options.featureFlagsPollingInterval === 'number'
        ? Math.max(options.featureFlagsPollingInterval, MINIMUM_POLLING_INTERVAL)
        : THIRTY_SECONDS

    if (options.personalApiKey) {
      if (options.personalApiKey.includes('phc_')) {
        throw new Error(
          'Your Personal API key is invalid. These keys are prefixed with "phx_" and can be created in PostHog project settings.'
        )
      }

      // Only start the poller if local evaluation is enabled (defaults to true for backward compatibility)
      const shouldEnableLocalEvaluation = options.enableLocalEvaluation !== false

      if (shouldEnableLocalEvaluation) {
        this.featureFlagsPoller = new FeatureFlagsPoller({
          pollingInterval: this.options.featureFlagsPollingInterval,
          personalApiKey: options.personalApiKey,
          projectApiKey: apiKey,
          timeout: options.requestTimeout ?? 10000, // 10 seconds
          host: this.host,
          fetch: options.fetch,
          onError: (err: Error) => {
            this._events.emit('error', err)
          },
          onLoad: (count: number) => {
            this._events.emit('localEvaluationFlagsLoaded', count)
          },
          customHeaders: this.getCustomHeaders(),
        })
      }
    }
    this.errorTracking = new ErrorTracking(this, options)
    this.distinctIdHasSentFlagCalls = {}
    this.maxCacheSize = options.maxCacheSize || MAX_CACHE_SIZE
  }

  getPersistedProperty(key: PostHogPersistedProperty): any | undefined {
    return this._memoryStorage.getProperty(key)
  }

  setPersistedProperty(key: PostHogPersistedProperty, value: any | null): void {
    return this._memoryStorage.setProperty(key, value)
  }

  fetch(url: string, options: PostHogFetchOptions): Promise<PostHogFetchResponse> {
    return this.options.fetch ? this.options.fetch(url, options) : fetch(url, options)
  }
  getLibraryVersion(): string {
    return version
  }
  getCustomUserAgent(): string {
    return `${this.getLibraryId()}/${this.getLibraryVersion()}`
  }

  enable(): Promise<void> {
    return super.optIn()
  }

  disable(): Promise<void> {
    return super.optOut()
  }

  debug(enabled: boolean = true): void {
    super.debug(enabled)
    this.featureFlagsPoller?.debug(enabled)
  }

  capture(props: EventMessage): void {
    if (typeof props === 'string') {
      this.logMsgIfDebug(() =>
        console.warn('Called capture() with a string as the first argument when an object was expected.')
      )
    }
    const { distinctId, event, properties, groups, sendFeatureFlags, timestamp, disableGeoip, uuid }: EventMessage =
      props
    const _capture = (props: EventMessage['properties']): void => {
      super.captureStateless(distinctId, event, props, { timestamp, disableGeoip, uuid })
    }

    const _getFlags = async (
      distinctId: EventMessage['distinctId'],
      groups: EventMessage['groups'],
      disableGeoip: EventMessage['disableGeoip'],
      sendFeatureFlagsConfig?: {
        personProperties?: Record<string, string>
        groupProperties?: Record<string, Record<string, string>>
        onlyEvaluateLocally?: boolean
        strictLocalEvaluation?: boolean
      }
    ): Promise<PostHogFlagsResponse['featureFlags'] | undefined> => {
      const groupsWithStringValues: Record<string, string> = {}
      for (const [key, value] of Object.entries(groups || {})) {
        groupsWithStringValues[key] = String(value)
      }

      // Default to local-only evaluation when sendFeatureFlags: true is used without config AND local evaluation is available
      const onlyEvaluateLocally = sendFeatureFlagsConfig?.onlyEvaluateLocally ?? 
        (sendFeatureFlags === true && !sendFeatureFlagsConfig && (this.featureFlagsPoller?.featureFlags?.length || 0) > 0)
      const strictLocalEvaluation = sendFeatureFlagsConfig?.strictLocalEvaluation ?? false

      // ALWAYS try local evaluation first if we have flags loaded
      if ((this.featureFlagsPoller?.featureFlags?.length || 0) > 0) {
        const localFlags = await this.getAllFlags(distinctId, {
          groups: groupsWithStringValues,
          personProperties: sendFeatureFlagsConfig?.personProperties,
          groupProperties: sendFeatureFlagsConfig?.groupProperties,
          onlyEvaluateLocally,
          strictLocalEvaluation,
          disableGeoip,
        })

        // If onlyEvaluateLocally is true, NEVER fall back regardless of results
        if (onlyEvaluateLocally) {
          return localFlags
        }

        // If we got some flags OR in strict mode, use local results
        if (Object.keys(localFlags).length > 0 || strictLocalEvaluation) {
          // Warn about behavior change for boolean sendFeatureFlags
          if (sendFeatureFlags === true && !sendFeatureFlagsConfig) {
            const totalFlagsLoaded = this.featureFlagsPoller?.featureFlags?.length || 0
            const localFlagsReturned = Object.keys(localFlags).length
            if (localFlagsReturned < totalFlagsLoaded) {
              console.warn(
                '[PostHog] sendFeatureFlags: true now prioritizes local evaluation and may return incomplete flags. ' +
                  'Use sendFeatureFlags: { onlyEvaluateLocally: false } to force remote evaluation for complete flag sets.'
              )
            }
          }
          return localFlags
        }
      }

      // Only fall back to remote if not in local-only mode
      if (!onlyEvaluateLocally) {
        return (await super.getFeatureFlagsStateless(distinctId, groups, undefined, undefined, disableGeoip)).flags
      }

      // If we're in local-only mode but have no flags loaded, return empty
      return {}
    }

    // Parse sendFeatureFlags configuration
    const sendFeatureFlagsEnabled =
      sendFeatureFlags === true || (typeof sendFeatureFlags === 'object' && sendFeatureFlags !== null)
    const sendFeatureFlagsConfig =
      typeof sendFeatureFlags === 'object' && sendFeatureFlags !== null ? sendFeatureFlags : undefined

    // :TRICKY: If we flush, or need to shut down, to not lose events we want this promise to resolve before we flush
    const capturePromise = Promise.resolve()
      .then(async () => {
        if (sendFeatureFlagsEnabled) {
          // If we are sending feature flags, we need to make sure we have the latest flags
          return await _getFlags(distinctId, groups, disableGeoip, sendFeatureFlagsConfig)
        }

        if (event === '$feature_flag_called') {
          // If we're capturing a $feature_flag_called event, we don't want to enrich the event with cached flags that may be out of date.
          return {}
        }

        // No sendFeatureFlags specified, no additional flags to include
        return {}
      })
      .then((flags) => {
        // Derive the relevant flag properties to add
        const additionalProperties: Record<string, any> = {}
        if (flags) {
          for (const [feature, variant] of Object.entries(flags)) {
            additionalProperties[`$feature/${feature}`] = variant
          }
        }
        const activeFlags = Object.keys(flags || {})
          .filter((flag) => flags?.[flag] !== false)
          .sort()
        if (activeFlags.length > 0) {
          additionalProperties['$active_feature_flags'] = activeFlags
        }

        return additionalProperties
      })
      .catch(() => {
        // Something went wrong getting the flag info - we should capture the event anyways
        return {}
      })
      .then((additionalProperties) => {
        // No matter what - capture the event
        _capture({ ...additionalProperties, ...properties, $groups: groups })
      })

    this.addPendingPromise(capturePromise)
  }

  async captureImmediate(props: EventMessage): Promise<void> {
    if (typeof props === 'string') {
      this.logMsgIfDebug(() =>
        console.warn('Called capture() with a string as the first argument when an object was expected.')
      )
    }
    const { distinctId, event, properties, groups, sendFeatureFlags, timestamp, disableGeoip, uuid }: EventMessage =
      props

    const _capture = (props: EventMessage['properties']): Promise<void> => {
      return super.captureStatelessImmediate(distinctId, event, props, { timestamp, disableGeoip, uuid })
    }

    const _getFlags = async (
      distinctId: EventMessage['distinctId'],
      groups: EventMessage['groups'],
      disableGeoip: EventMessage['disableGeoip'],
      sendFeatureFlagsConfig?: {
        personProperties?: Record<string, string>
        groupProperties?: Record<string, Record<string, string>>
        onlyEvaluateLocally?: boolean
        strictLocalEvaluation?: boolean
      }
    ): Promise<PostHogFlagsResponse['featureFlags'] | undefined> => {
      const groupsWithStringValues: Record<string, string> = {}
      for (const [key, value] of Object.entries(groups || {})) {
        groupsWithStringValues[key] = String(value)
      }

      // Default to local-only evaluation when sendFeatureFlags: true is used without config AND local evaluation is available
      const onlyEvaluateLocally = sendFeatureFlagsConfig?.onlyEvaluateLocally ?? 
        (sendFeatureFlags === true && !sendFeatureFlagsConfig && (this.featureFlagsPoller?.featureFlags?.length || 0) > 0)
      const strictLocalEvaluation = sendFeatureFlagsConfig?.strictLocalEvaluation ?? false

      // ALWAYS try local evaluation first if we have flags loaded
      if ((this.featureFlagsPoller?.featureFlags?.length || 0) > 0) {
        const localFlags = await this.getAllFlags(distinctId, {
          groups: groupsWithStringValues,
          personProperties: sendFeatureFlagsConfig?.personProperties,
          groupProperties: sendFeatureFlagsConfig?.groupProperties,
          onlyEvaluateLocally,
          strictLocalEvaluation,
          disableGeoip,
        })

        // If onlyEvaluateLocally is true, NEVER fall back regardless of results
        if (onlyEvaluateLocally) {
          return localFlags
        }

        // If we got some flags OR in strict mode, use local results
        if (Object.keys(localFlags).length > 0 || strictLocalEvaluation) {
          // Warn about behavior change for boolean sendFeatureFlags
          if (sendFeatureFlags === true && !sendFeatureFlagsConfig) {
            const totalFlagsLoaded = this.featureFlagsPoller?.featureFlags?.length || 0
            const localFlagsReturned = Object.keys(localFlags).length
            if (localFlagsReturned < totalFlagsLoaded) {
              console.warn(
                '[PostHog] sendFeatureFlags: true now prioritizes local evaluation and may return incomplete flags. ' +
                  'Use sendFeatureFlags: { onlyEvaluateLocally: false } to force remote evaluation for complete flag sets.'
              )
            }
          }
          return localFlags
        }
      }

      // Only fall back to remote if not in local-only mode
      if (!onlyEvaluateLocally) {
        return (await super.getFeatureFlagsStateless(distinctId, groups, undefined, undefined, disableGeoip)).flags
      }

      // If we're in local-only mode but have no flags loaded, return empty
      return {}
    }

    // Parse sendFeatureFlags configuration
    const sendFeatureFlagsEnabled =
      sendFeatureFlags === true || (typeof sendFeatureFlags === 'object' && sendFeatureFlags !== null)
    const sendFeatureFlagsConfig =
      typeof sendFeatureFlags === 'object' && sendFeatureFlags !== null ? sendFeatureFlags : undefined

    const capturePromise = Promise.resolve()
      .then(async () => {
        if (sendFeatureFlagsEnabled) {
          // If we are sending feature flags, we need to make sure we have the latest flags
          return await _getFlags(distinctId, groups, disableGeoip, sendFeatureFlagsConfig)
        }

        if (event === '$feature_flag_called') {
          // If we're capturing a $feature_flag_called event, we don't want to enrich the event with cached flags that may be out of date.
          return {}
        }

        // No sendFeatureFlags specified, no additional flags to include
        return {}
      })
      .then((flags) => {
        // Derive the relevant flag properties to add
        const additionalProperties: Record<string, any> = {}
        if (flags) {
          for (const [feature, variant] of Object.entries(flags)) {
            additionalProperties[`$feature/${feature}`] = variant
          }
        }
        const activeFlags = Object.keys(flags || {})
          .filter((flag) => flags?.[flag] !== false)
          .sort()
        if (activeFlags.length > 0) {
          additionalProperties['$active_feature_flags'] = activeFlags
        }

        return additionalProperties
      })
      .catch(() => {
        // Something went wrong getting the flag info - we should capture the event anyways
        return {}
      })
      .then((additionalProperties) => {
        // No matter what - capture the event
        _capture({ ...additionalProperties, ...properties, $groups: groups })
      })

    await capturePromise
  }

  identify({ distinctId, properties, disableGeoip }: IdentifyMessage): void {
    // Catch properties passed as $set and move them to the top level

    // promote $set and $set_once to top level
    const userPropsOnce = properties?.$set_once
    delete properties?.$set_once

    // if no $set is provided we assume all properties are $set
    const userProps = properties?.$set || properties

    super.identifyStateless(
      distinctId,
      {
        $set: userProps,
        $set_once: userPropsOnce,
      },
      { disableGeoip }
    )
  }

  async identifyImmediate({ distinctId, properties, disableGeoip }: IdentifyMessage): Promise<void> {
    // promote $set and $set_once to top level
    const userPropsOnce = properties?.$set_once
    delete properties?.$set_once

    // if no $set is provided we assume all properties are $set
    const userProps = properties?.$set || properties

    await super.identifyStatelessImmediate(
      distinctId,
      {
        $set: userProps,
        $set_once: userPropsOnce,
      },
      { disableGeoip }
    )
  }

  alias(data: { distinctId: string; alias: string; disableGeoip?: boolean }): void {
    super.aliasStateless(data.alias, data.distinctId, undefined, { disableGeoip: data.disableGeoip })
  }

  async aliasImmediate(data: { distinctId: string; alias: string; disableGeoip?: boolean }): Promise<void> {
    await super.aliasStatelessImmediate(data.alias, data.distinctId, undefined, { disableGeoip: data.disableGeoip })
  }

  isLocalEvaluationReady(): boolean {
    return this.featureFlagsPoller?.isLocalEvaluationReady() ?? false
  }

  async waitForLocalEvaluationReady(timeoutMs: number = THIRTY_SECONDS): Promise<boolean> {
    if (this.isLocalEvaluationReady()) {
      return true
    }

    if (this.featureFlagsPoller === undefined) {
      return false
    }

    return new Promise((resolve) => {
      const timeout = setTimeout(() => {
        cleanup()
        resolve(false)
      }, timeoutMs)

      const cleanup = this._events.on('localEvaluationFlagsLoaded', (count: number) => {
        clearTimeout(timeout)
        cleanup()
        resolve(count > 0)
      })
    })
  }

  async getFeatureFlag(
    key: string,
    distinctId: string,
    options?: {
      groups?: Record<string, string>
      personProperties?: Record<string, string>
      groupProperties?: Record<string, Record<string, string>>
      onlyEvaluateLocally?: boolean
      sendFeatureFlagEvents?: boolean
      disableGeoip?: boolean
      strictLocalEvaluation?: boolean
    }
  ): Promise<FeatureFlagValue | undefined> {
    const { groups, disableGeoip } = options || {}
    let { onlyEvaluateLocally, sendFeatureFlagEvents, personProperties, groupProperties, strictLocalEvaluation } =
      options || {}

    // Use global strictLocalEvaluation setting if not provided
    if (strictLocalEvaluation === undefined) {
      strictLocalEvaluation = this.options.strictLocalEvaluation ?? false
    }

    const adjustedProperties = this.addLocalPersonAndGroupProperties(
      distinctId,
      groups,
      personProperties,
      groupProperties
    )

    personProperties = adjustedProperties.allPersonProperties
    groupProperties = adjustedProperties.allGroupProperties

    // set defaults
    if (onlyEvaluateLocally == undefined) {
      onlyEvaluateLocally = false
    }
    if (sendFeatureFlagEvents == undefined) {
      sendFeatureFlagEvents = true
    }

    let response = await this.featureFlagsPoller?.getFeatureFlag(
      key,
      distinctId,
      groups,
      personProperties,
      groupProperties
    )

    const flagWasLocallyEvaluated = response !== undefined
    let requestId = undefined
    let flagDetail: FeatureFlagDetail | undefined = undefined

    // STRICT LOCAL EVALUATION: Fail fast when we can't reliably evaluate locally
    // This prevents returning incorrect flag values due to missing properties
    if (!flagWasLocallyEvaluated && strictLocalEvaluation && onlyEvaluateLocally) {
      // Return undefined instead of false to indicate "cannot evaluate" vs "flag is off"
      return undefined
    }

    // FALLBACK TO REMOTE: Only when not in local-only mode
    if (!flagWasLocallyEvaluated && !onlyEvaluateLocally) {
      const remoteResponse = await super.getFeatureFlagDetailStateless(
        key,
        distinctId,
        groups,
        personProperties,
        groupProperties,
        disableGeoip
      )

      if (remoteResponse === undefined) {
        return undefined
      }

      flagDetail = remoteResponse.response
      response = getFeatureFlagValue(flagDetail)
      requestId = remoteResponse?.requestId
    }

    const featureFlagReportedKey = `${key}_${response}`

    if (
      sendFeatureFlagEvents &&
      (!(distinctId in this.distinctIdHasSentFlagCalls) ||
        !this.distinctIdHasSentFlagCalls[distinctId].includes(featureFlagReportedKey))
    ) {
      if (Object.keys(this.distinctIdHasSentFlagCalls).length >= this.maxCacheSize) {
        this.distinctIdHasSentFlagCalls = {}
      }
      if (Array.isArray(this.distinctIdHasSentFlagCalls[distinctId])) {
        this.distinctIdHasSentFlagCalls[distinctId].push(featureFlagReportedKey)
      } else {
        this.distinctIdHasSentFlagCalls[distinctId] = [featureFlagReportedKey]
      }
      this.capture({
        distinctId,
        event: '$feature_flag_called',
        properties: {
          $feature_flag: key,
          $feature_flag_response: response,
          $feature_flag_id: flagDetail?.metadata?.id,
          $feature_flag_version: flagDetail?.metadata?.version,
          $feature_flag_reason: flagDetail?.reason?.description ?? flagDetail?.reason?.code,
          locally_evaluated: flagWasLocallyEvaluated,
          [`$feature/${key}`]: response,
          $feature_flag_request_id: requestId,
        },
        groups,
        disableGeoip,
      })
    }
    return response
  }

  async getFeatureFlagPayload(
    key: string,
    distinctId: string,
    matchValue?: FeatureFlagValue,
    options?: {
      groups?: Record<string, string>
      personProperties?: Record<string, string>
      groupProperties?: Record<string, Record<string, string>>
      onlyEvaluateLocally?: boolean
      sendFeatureFlagEvents?: boolean
      disableGeoip?: boolean
    }
  ): Promise<JsonType | undefined> {
    const { groups, disableGeoip } = options || {}
    let { onlyEvaluateLocally, sendFeatureFlagEvents, personProperties, groupProperties } = options || {}

    const adjustedProperties = this.addLocalPersonAndGroupProperties(
      distinctId,
      groups,
      personProperties,
      groupProperties
    )

    personProperties = adjustedProperties.allPersonProperties
    groupProperties = adjustedProperties.allGroupProperties

    let response = undefined

    const localEvaluationEnabled = this.featureFlagsPoller !== undefined
    if (localEvaluationEnabled) {
      // Try to get match value locally if not provided
      if (!matchValue) {
        matchValue = await this.getFeatureFlag(key, distinctId, {
          ...options,
          onlyEvaluateLocally: true,
          sendFeatureFlagEvents: false,
        })
      }

      if (matchValue) {
        response = await this.featureFlagsPoller?.computeFeatureFlagPayloadLocally(key, matchValue)
      }
    }
    //}

    // set defaults
    if (onlyEvaluateLocally == undefined) {
      onlyEvaluateLocally = false
    }
    if (sendFeatureFlagEvents == undefined) {
      sendFeatureFlagEvents = true
    }

    // set defaults
    if (onlyEvaluateLocally == undefined) {
      onlyEvaluateLocally = false
    }

    const payloadWasLocallyEvaluated = response !== undefined

    if (!payloadWasLocallyEvaluated && !onlyEvaluateLocally) {
      response = await super.getFeatureFlagPayloadStateless(
        key,
        distinctId,
        groups,
        personProperties,
        groupProperties,
        disableGeoip
      )
    }
    return response
  }

  async getRemoteConfigPayload(flagKey: string): Promise<JsonType | undefined> {
    if (!this.options.personalApiKey) {
      throw new Error('Personal API key is required for remote config payload decryption')
    }

    const response = await this._requestRemoteConfigPayload(flagKey)
    if (!response) {
      return undefined
    }

    const parsed = await response.json()
    // The payload from the endpoint is stored as a JSON encoded string. So when we return
    // it, it's effectively double encoded. As far as we know, we should never get single-encoded
    // JSON, but we'll be defensive here just in case.
    if (typeof parsed === 'string') {
      try {
        // If the parsed value is a string, try parsing it again to handle double-encoded JSON
        return JSON.parse(parsed)
      } catch (e) {
        // If second parse fails, return the string as is
        return parsed
      }
    }
    return parsed
  }

  async isFeatureEnabled(
    key: string,
    distinctId: string,
    options?: {
      groups?: Record<string, string>
      personProperties?: Record<string, string>
      groupProperties?: Record<string, Record<string, string>>
      onlyEvaluateLocally?: boolean
      sendFeatureFlagEvents?: boolean
      disableGeoip?: boolean
      strictLocalEvaluation?: boolean
    }
  ): Promise<boolean | undefined> {
    const feat = await this.getFeatureFlag(key, distinctId, options)
    if (feat === undefined) {
      return undefined
    }
    return !!feat || false
  }

  async getAllFlags(
    distinctId: string,
    options?: {
      groups?: Record<string, string>
      personProperties?: Record<string, string>
      groupProperties?: Record<string, Record<string, string>>
      onlyEvaluateLocally?: boolean
      disableGeoip?: boolean
      strictLocalEvaluation?: boolean
    }
  ): Promise<Record<string, FeatureFlagValue>> {
    const response = await this.getAllFlagsAndPayloads(distinctId, options)
    return response.featureFlags || {}
  }

  async getAllFlagsAndPayloads(
    distinctId: string,
    options?: {
      groups?: Record<string, string>
      personProperties?: Record<string, string>
      groupProperties?: Record<string, Record<string, string>>
      onlyEvaluateLocally?: boolean
      disableGeoip?: boolean
      strictLocalEvaluation?: boolean
    }
  ): Promise<PostHogFlagsAndPayloadsResponse> {
    const { groups, disableGeoip } = options || {}
    let { onlyEvaluateLocally, personProperties, groupProperties, strictLocalEvaluation } = options || {}

    // Use global strictLocalEvaluation setting if not provided
    if (strictLocalEvaluation === undefined) {
      strictLocalEvaluation = this.options.strictLocalEvaluation ?? false
    }

    const adjustedProperties = this.addLocalPersonAndGroupProperties(
      distinctId,
      groups,
      personProperties,
      groupProperties
    )

    personProperties = adjustedProperties.allPersonProperties
    groupProperties = adjustedProperties.allGroupProperties

    // set defaults
    if (onlyEvaluateLocally == undefined) {
      onlyEvaluateLocally = false
    }

    const localEvaluationResult = await this.featureFlagsPoller?.getAllFlagsAndPayloads(
      distinctId,
      groups,
      personProperties,
      groupProperties
    )

    let featureFlags = {}
    let featureFlagPayloads = {}
    let fallbackToFlags = true
    if (localEvaluationResult) {
      featureFlags = localEvaluationResult.response
      featureFlagPayloads = localEvaluationResult.payloads
      fallbackToFlags = localEvaluationResult.fallbackToFlags
    }

    // STRICT LOCAL EVALUATION: Prevent potentially incorrect results
    // When strictLocalEvaluation=true, we exclude flags that couldn't be reliably evaluated
    // rather than risk returning wrong values due to missing properties
    if (fallbackToFlags && strictLocalEvaluation && onlyEvaluateLocally) {
      // Return only flags that were successfully evaluated with provided properties
      // Missing flags indicate insufficient data for reliable evaluation
      return { featureFlags, featureFlagPayloads }
    }

    if (fallbackToFlags && !onlyEvaluateLocally) {
      const remoteEvaluationResult = await super.getFeatureFlagsAndPayloadsStateless(
        distinctId,
        groups,
        personProperties,
        groupProperties,
        disableGeoip
      )
      featureFlags = {
        ...featureFlags,
        ...(remoteEvaluationResult.flags || {}),
      }
      featureFlagPayloads = {
        ...featureFlagPayloads,
        ...(remoteEvaluationResult.payloads || {}),
      }
    }

    return { featureFlags, featureFlagPayloads }
  }

  groupIdentify({ groupType, groupKey, properties, distinctId, disableGeoip }: GroupIdentifyMessage): void {
    super.groupIdentifyStateless(groupType, groupKey, properties, { disableGeoip }, distinctId)
  }

  /**
   * Reloads the feature flag definitions from the server for local evaluation.
   * This is useful to call if you want to ensure that the feature flags are up to date before calling getFeatureFlag.
   */
  async reloadFeatureFlags(): Promise<void> {
    await this.featureFlagsPoller?.loadFeatureFlags(true)
  }

  /**
   * @description Analyzes a feature flag to determine what properties are required for local evaluation.
   * This helps developers understand what properties they need to provide to avoid evaluation failures.
   *
   * Use this method with `strictLocalEvaluation: true` to:
   * 1. Identify required properties for reliable local evaluation
   * 2. Detect when flags cannot be evaluated locally (experience continuity, etc.)
   * 3. Prevent the footgun where missing properties cause incorrect flag values
   *
   * @param flagKey The unique key of the feature flag to analyze
   * @returns An object containing required properties and evaluation capabilities
   *
   * @example
   * ```typescript
   * const requirements = client.getRequiredProperties('my-flag')
   * if (requirements.personProperties.includes('plan')) {
   *   // Make sure to provide 'plan' property for reliable evaluation
   *   const flags = await client.getAllFlags('user123', {
   *     personProperties: { plan: 'premium' },
   *     onlyEvaluateLocally: true,
   *     strictLocalEvaluation: true
   *   })
   * }
   * ```
   */
  getRequiredProperties(flagKey: string): {
    personProperties: string[]
    groupProperties: Record<string, string[]>
    canEvaluateLocally: boolean
    requiresGroups: boolean
    groupTypes: string[]
  } {
    return (
      this.featureFlagsPoller?.getRequiredProperties(flagKey) ?? {
        personProperties: [],
        groupProperties: {},
        canEvaluateLocally: false,
        requiresGroups: false,
        groupTypes: [],
      }
    )
  }

  async _shutdown(shutdownTimeoutMs?: number): Promise<void> {
    this.featureFlagsPoller?.stopPoller()
    return super._shutdown(shutdownTimeoutMs)
  }

  private async _requestRemoteConfigPayload(flagKey: string): Promise<PostHogFetchResponse | undefined> {
    if (!this.options.personalApiKey) {
      return undefined
    }

    const url = `${this.host}/api/projects/@current/feature_flags/${flagKey}/remote_config/`

    const options: PostHogFetchOptions = {
      method: 'GET',
      headers: {
        ...this.getCustomHeaders(),
        'Content-Type': 'application/json',
        Authorization: `Bearer ${this.options.personalApiKey}`,
      },
    }

    let abortTimeout = null
    if (this.options.requestTimeout && typeof this.options.requestTimeout === 'number') {
      const controller = new AbortController()
      abortTimeout = safeSetTimeout(() => {
        controller.abort()
      }, this.options.requestTimeout)
      options.signal = controller.signal
    }

    try {
      return await this.fetch(url, options)
    } catch (error) {
      this._events.emit('error', error)
      return undefined
    } finally {
      if (abortTimeout) {
        clearTimeout(abortTimeout)
      }
    }
  }

  private addLocalPersonAndGroupProperties(
    distinctId: string,
    groups?: Record<string, string>,
    personProperties?: Record<string, string>,
    groupProperties?: Record<string, Record<string, string>>
  ): { allPersonProperties: Record<string, string>; allGroupProperties: Record<string, Record<string, string>> } {
    const allPersonProperties = { distinct_id: distinctId, ...(personProperties || {}) }

    const allGroupProperties: Record<string, Record<string, string>> = {}
    if (groups) {
      for (const groupName of Object.keys(groups)) {
        allGroupProperties[groupName] = {
          $group_key: groups[groupName],
          ...(groupProperties?.[groupName] || {}),
        }
      }
    }

    return { allPersonProperties, allGroupProperties }
  }

  captureException(error: unknown, distinctId?: string, additionalProperties?: Record<string | number, any>): void {
    const syntheticException = new Error('PostHog syntheticException')
    ErrorTracking.buildEventMessage(error, { syntheticException }, distinctId, additionalProperties).then((msg) => {
      this.capture(msg)
    })
  }

  async captureExceptionImmediate(
    error: unknown,
    distinctId?: string,
    additionalProperties?: Record<string | number, any>
  ): Promise<void> {
    const syntheticException = new Error('PostHog syntheticException')
    const evtMsg = await ErrorTracking.buildEventMessage(
      error,
      { syntheticException },
      distinctId,
      additionalProperties
    )
    return await this.captureImmediate(evtMsg)
  }
}

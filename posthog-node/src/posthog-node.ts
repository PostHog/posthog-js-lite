import { version } from '../package.json'

import {
  JsonType,
  PostHogCoreOptions,
  PostHogCoreStateless,
  PostHogDecideResponse,
  PostHogFetchOptions,
  PostHogFetchResponse,
  PostHogFlagsAndPayloadsResponse,
  PostHogPersistedProperty,
} from '../../posthog-core/src'
import { PostHogMemoryStorage } from '../../posthog-core/src/storage-memory'
import { EventMessage, GroupIdentifyMessage, IdentifyMessage, PostHogNodeV1 } from './types'
import { FeatureFlagDetail, FeatureFlagValue } from '../../posthog-core/src/types'
import { FeatureFlagsPoller } from './feature-flags'
import fetch from './fetch'
import ErrorTracking from './error-tracking'
import { getFeatureFlagValue } from 'posthog-core/src/featureFlagUtils'

export type PostHogOptions = PostHogCoreOptions & {
  persistence?: 'memory'
  personalApiKey?: string
  privacyMode?: boolean
  enableExceptionAutocapture?: boolean
  // The interval in milliseconds between polls for refreshing feature flag definitions. Defaults to 30 seconds.
  featureFlagsPollingInterval?: number
  // Maximum size of cache that deduplicates $feature_flag_called calls per user.
  maxCacheSize?: number
  fetch?: (url: string, options: PostHogFetchOptions) => Promise<PostHogFetchResponse>
}

// Standard local evaluation rate limit is 600 per minute (10 per second),
// so the fastest a poller should ever be set is 100ms.
export const MINIMUM_POLLING_INTERVAL = 100
export const THIRTY_SECONDS = 30 * 1000
export const SIXTY_SECONDS = 60 * 1000
const MAX_CACHE_SIZE = 50 * 1000

// The actual exported Nodejs API.
export class PostHog extends PostHogCoreStateless implements PostHogNodeV1 {
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
        customHeaders: this.getCustomHeaders(),
      })
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

  getLibraryId(): string {
    return 'posthog-node'
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
      disableGeoip: EventMessage['disableGeoip']
    ): Promise<PostHogDecideResponse['featureFlags'] | undefined> => {
      return (await super.getFeatureFlagsStateless(distinctId, groups, undefined, undefined, disableGeoip)).flags
    }

    // :TRICKY: If we flush, or need to shut down, to not lose events we want this promise to resolve before we flush
    const capturePromise = Promise.resolve()
      .then(async () => {
        if (sendFeatureFlags) {
          // If we are sending feature flags, we need to make sure we have the latest flags
          // return await super.getFeatureFlagsStateless(distinctId, groups, undefined, undefined, disableGeoip)
          return await _getFlags(distinctId, groups, disableGeoip)
        }

        if (event === '$feature_flag_called') {
          // If we're capturing a $feature_flag_called event, we don't want to enrich the event with cached flags that may be out of date.
          return {}
        }

        if ((this.featureFlagsPoller?.featureFlags?.length || 0) > 0) {
          // Otherwise we may as well check for the flags locally and include them if they are already loaded
          const groupsWithStringValues: Record<string, string> = {}
          for (const [key, value] of Object.entries(groups || {})) {
            groupsWithStringValues[key] = String(value)
          }

          return await this.getAllFlags(distinctId, {
            groups: groupsWithStringValues,
            disableGeoip,
            onlyEvaluateLocally: true,
          })
        }
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

  alias(data: { distinctId: string; alias: string; disableGeoip?: boolean }): void {
    super.aliasStateless(data.alias, data.distinctId, undefined, { disableGeoip: data.disableGeoip })
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
    }
  ): Promise<FeatureFlagValue | undefined> {
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
    return (await this.featureFlagsPoller?._requestRemoteConfigPayload(flagKey))?.json()
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
    }
  ): Promise<PostHogFlagsAndPayloadsResponse> {
    const { groups, disableGeoip } = options || {}
    let { onlyEvaluateLocally, personProperties, groupProperties } = options || {}

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
    let fallbackToDecide = true
    if (localEvaluationResult) {
      featureFlags = localEvaluationResult.response
      featureFlagPayloads = localEvaluationResult.payloads
      fallbackToDecide = localEvaluationResult.fallbackToDecide
    }

    if (fallbackToDecide && !onlyEvaluateLocally) {
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

  async reloadFeatureFlags(): Promise<void> {
    await this.featureFlagsPoller?.loadFeatureFlags(true)
  }

  async shutdown(shutdownTimeoutMs?: number): Promise<void> {
    this.featureFlagsPoller?.stopPoller()
    return super.shutdown(shutdownTimeoutMs)
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
    ErrorTracking.captureException(this, error, { syntheticException }, distinctId, additionalProperties)
  }
}

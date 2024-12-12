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
import { FeatureFlagsPoller } from './feature-flags'
import fetch from './fetch'

export type PostHogOptions = PostHogCoreOptions & {
  persistence?: 'memory'
  personalApiKey?: string
  // The interval in milliseconds between polls for refreshing feature flag definitions. Defaults to 30 seconds.
  featureFlagsPollingInterval?: number
  // Maximum size of cache that deduplicates $feature_flag_called calls per user.
  maxCacheSize?: number
  fetch?: (url: string, options: PostHogFetchOptions) => Promise<PostHogFetchResponse>
}

const THIRTY_SECONDS = 30 * 1000
const MAX_CACHE_SIZE = 50 * 1000

// The actual exported Nodejs API.
export class PostHog extends PostHogCoreStateless implements PostHogNodeV1 {
  private _memoryStorage = new PostHogMemoryStorage()

  private featureFlagsPoller?: FeatureFlagsPoller
  private maxCacheSize: number
  public readonly options: PostHogOptions

  distinctIdHasSentFlagCalls: Record<string, string[]>

  constructor(apiKey: string, options: PostHogOptions = {}) {
    super(apiKey, options)

    this.options = options

    if (options.personalApiKey) {
      this.featureFlagsPoller = new FeatureFlagsPoller({
        pollingInterval:
          typeof options.featureFlagsPollingInterval === 'number'
            ? options.featureFlagsPollingInterval
            : THIRTY_SECONDS,
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

  capture({
    distinctId,
    event,
    properties,
    groups,
    sendFeatureFlags,
    timestamp,
    disableGeoip,
    uuid,
  }: EventMessage): void {
    const _capture = (props: EventMessage['properties']): void => {
      super.captureStateless(distinctId, event, props, { timestamp, disableGeoip, uuid })
    }

    const _getFlags = (
      distinctId: EventMessage['distinctId'],
      groups: EventMessage['groups'],
      disableGeoip: EventMessage['disableGeoip']
    ): Promise<PostHogDecideResponse['featureFlags'] | undefined> => {
      return super.getFeatureFlagsStateless(distinctId, groups, undefined, undefined, disableGeoip)
    }

    // :TRICKY: If we flush, or need to shut down, to not lose events we want this promise to resolve before we flush
    const capturePromise = Promise.resolve()
      .then(async () => {
        if (sendFeatureFlags) {
          // If we are sending feature flags, we need to make sure we have the latest flags
          // return await super.getFeatureFlagsStateless(distinctId, groups, undefined, undefined, disableGeoip)
          return await _getFlags(distinctId, groups, disableGeoip)
        }

        if ((this.featureFlagsPoller?.featureFlags?.length || 0) > 0) {
          // Otherwise we may as well check for the flags locally and include them if there
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
        const activeFlags = Object.keys(flags || {}).filter((flag) => flags?.[flag] !== false)
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
  ): Promise<string | boolean | undefined> {
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

    if (!flagWasLocallyEvaluated && !onlyEvaluateLocally) {
      response = await super.getFeatureFlagStateless(
        key,
        distinctId,
        groups,
        personProperties,
        groupProperties,
        disableGeoip
      )
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
          locally_evaluated: flagWasLocallyEvaluated,
          [`$feature/${key}`]: response,
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
    matchValue?: string | boolean,
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

    // Try to get match value locally if not provided
    if (!matchValue) {
      matchValue = await this.getFeatureFlag(key, distinctId, {
        ...options,
        onlyEvaluateLocally: true,
      })
    }

    if (matchValue) {
      response = await this.featureFlagsPoller?.computeFeatureFlagPayloadLocally(key, matchValue)
    }

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
  ): Promise<Record<string, string | boolean>> {
    const response = await this.getAllFlagsAndPayloads(distinctId, options)
    return response.featureFlags
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
}

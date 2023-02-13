import { version } from '../package.json'

import {
  JsonType,
  PosthogCoreOptions,
  PostHogCoreStateless,
  PostHogFetchOptions,
  PostHogFetchResponse,
  PosthogFlagsAndPayloadsResponse,
  PostHogPersistedProperty,
} from '../../posthog-core/src'
import { PostHogMemoryStorage } from '../../posthog-core/src/storage-memory'
import { EventMessageV1, GroupIdentifyMessage, IdentifyMessageV1, PostHogNodeV1 } from './types'
import { FeatureFlagsPoller } from './feature-flags'
import { fetch } from './fetch'

export type PostHogOptions = PosthogCoreOptions & {
  persistence?: 'memory'
  personalApiKey?: string
  // The interval in milliseconds between polls for refreshing feature flag definitions
  featureFlagsPollingInterval?: number
  // Timeout in milliseconds for any calls. Defaults to 10 seconds.
  requestTimeout?: number
  // Maximum size of cache that deduplicates $feature_flag_called calls per user.
  maxCacheSize?: number
  fetch?: (url: string, options: PostHogFetchOptions) => Promise<PostHogFetchResponse>
}

const THIRTY_SECONDS = 30 * 1000
const MAX_CACHE_SIZE = 50 * 1000

class PostHogClient extends PostHogCoreStateless {
  private _memoryStorage = new PostHogMemoryStorage()

  constructor(apiKey: string, private options: PostHogOptions = {}) {
    options.captureMode = options?.captureMode || 'json'
    super(apiKey, options)
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
    return `posthog-node/${version}`
  }
}

// The actual exported Nodejs API.
export class PostHog implements PostHogNodeV1 {
  private _sharedClient: PostHogClient
  private featureFlagsPoller?: FeatureFlagsPoller
  private maxCacheSize: number

  distinctIdHasSentFlagCalls: Record<string, string[]>

  constructor(apiKey: string, options: PostHogOptions = {}) {
    this._sharedClient = new PostHogClient(apiKey, options)
    if (options.personalApiKey) {
      this.featureFlagsPoller = new FeatureFlagsPoller({
        pollingInterval:
          typeof options.featureFlagsPollingInterval === 'number'
            ? options.featureFlagsPollingInterval
            : THIRTY_SECONDS,
        personalApiKey: options.personalApiKey,
        projectApiKey: apiKey,
        timeout: options.requestTimeout ?? 10000, // 10 seconds
        host: this._sharedClient.host,
        fetch: options.fetch,
      })
    }
    this.distinctIdHasSentFlagCalls = {}
    this.maxCacheSize = options.maxCacheSize || MAX_CACHE_SIZE
  }

  enable(): void {
    return this._sharedClient.optIn()
  }

  disable(): void {
    return this._sharedClient.optOut()
  }

  capture({ distinctId, event, properties, groups, sendFeatureFlags, timestamp }: EventMessageV1): void {
    
    const _capture = (props: EventMessageV1['properties']): void => {
      this._sharedClient.captureStateless(distinctId, event, props, { timestamp })
    }

    if (sendFeatureFlags) {
      this._sharedClient.getFeatureFlagsStateless(distinctId, groups).then((flags) => {
        const featureVariantProperties: Record<string, string | boolean> = {}
        if (flags) {
          for (const [feature, variant] of Object.entries(flags)) {
            featureVariantProperties[`$feature/${feature}`] = variant
          }
        }
        const flagProperties = {
          $active_feature_flags: flags ? Object.keys(flags) : undefined,
          ...featureVariantProperties,
        }
        _capture({...properties, $groups: groups, ...flagProperties})
      })
    } else {
      _capture({...properties, $groups: groups})
    }
  }

  identify({ distinctId, properties }: IdentifyMessageV1): void {
    this._sharedClient.identifyStateless(distinctId, properties)
  }

  alias(data: { distinctId: string; alias: string }): void {
    this._sharedClient.aliasStateless(data.alias, data.distinctId)
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
    }
  ): Promise<string | boolean | undefined> {
    const { groups, personProperties, groupProperties } = options || {}
    let { onlyEvaluateLocally, sendFeatureFlagEvents } = options || {}

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
      response = await this._sharedClient.getFeatureFlagStateless(key, distinctId, groups, personProperties, groupProperties)
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
        },
        groups,
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
    }
  ): Promise<JsonType | undefined> {
    const { groups, personProperties, groupProperties } = options || {}
    let { onlyEvaluateLocally, sendFeatureFlagEvents } = options || {}
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
      response = await this._sharedClient.getFeatureFlagPayloadStateless(key, distinctId, groups, personProperties, groupProperties)
    }

    try {
      return JSON.parse(response as any)
    } catch {
      return response
    }
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
    }
  ): Promise<PosthogFlagsAndPayloadsResponse> {
    const { groups, personProperties, groupProperties } = options || {}
    let { onlyEvaluateLocally } = options || {}

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
      const remoteEvaluationResult = await this._sharedClient.getFeatureFlagsAndPayloadsStateless(distinctId, groups, personProperties, groupProperties)
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

  groupIdentify({ groupType, groupKey, properties }: GroupIdentifyMessage): void {
    this._sharedClient.groupIdentifyStateless(groupType, groupKey, properties)
  }

  async reloadFeatureFlags(): Promise<void> {
    await this.featureFlagsPoller?.loadFeatureFlags(true)
  }

  flush(): void {
    this._sharedClient.flush()
  }

  shutdown(): void {
    void this.shutdownAsync()
  }

  async shutdownAsync(): Promise<void> {
    this.featureFlagsPoller?.stopPoller()
    return this._sharedClient.shutdownAsync()
  }

  debug(enabled?: boolean): void {
    return this._sharedClient.debug(enabled)
  }
}

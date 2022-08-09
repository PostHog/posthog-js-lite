import { version } from '../package.json'
import undici from 'undici'
import {
  PostHogCore,
  PosthogCoreOptions,
  PostHogFetchOptions,
  PostHogFetchResponse,
  PostHogPersistedProperty,
} from '../../posthog-core/src'
import { PostHogMemoryStorage } from '../../posthog-core/src/storage-memory'
import { EventMessageV1, GroupIdentifyMessage, IdentifyMessageV1, PostHogNodeV1 } from './types'
import { FeatureFlagsPoller } from './feature-flags'

export type PostHogOptions = PosthogCoreOptions & {
  persistence?: 'memory'
  personalApiKey?: string
  // The interval in milliseconds between polls for refreshing feature flag definitions
  featureFlagsPollingInterval?: number
  // Timeout in milliseconds for feature flag definitions calls. Defaults to 30 seconds.
  requestTimeout?: number
}

const THIRTY_SECONDS = 30 * 1000
const MAX_DICT_SIZE = 50 * 1000


class PostHog extends PostHogCore {
  private _memoryStorage = new PostHogMemoryStorage()

  constructor(apiKey: string, options: PostHogOptions = {}) {
    options.captureMode = options?.captureMode || 'json'
    options.preloadFeatureFlags = false // Don't preload as this makes no sense without a distinctId
    options.sendFeatureFlagEvent = false // Let `posthog-node` handle this on its own, since we're dealing with multiple distinctIDs

    super(apiKey, options)
  }

  getPersistedProperty(key: PostHogPersistedProperty): any | undefined {
    return this._memoryStorage.getProperty(key)
  }

  setPersistedProperty(key: PostHogPersistedProperty, value: any | null): void {
    return this._memoryStorage.setProperty(key, value)
  }

  getSessionId(): string | undefined {
    // Sessions don't make sense for Node
    return undefined
  }

  fetch(url: string, options: PostHogFetchOptions): Promise<PostHogFetchResponse> {
    return undici.fetch(url, options)
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
export class PostHogGlobal implements PostHogNodeV1 {
  private _sharedClient: PostHog
  private featureFlagsPoller?: FeatureFlagsPoller
  
  distinctIdHasSentFlagCalls: Record<string, string[]>

  constructor(apiKey: string, options: PostHogOptions = {}) {
    this._sharedClient = new PostHog(apiKey, options)
    if (options.personalApiKey) {
        this.featureFlagsPoller = new FeatureFlagsPoller({
            pollingInterval:
                typeof options.featureFlagsPollingInterval === 'number'
                    ? options.featureFlagsPollingInterval
                    : THIRTY_SECONDS,
            personalApiKey: options.personalApiKey,
            projectApiKey: apiKey,
            timeout: options.requestTimeout,
            host: this._sharedClient.host,
        })
    }
    this.distinctIdHasSentFlagCalls = {}
  }

  private reInit(distinctId: string): void {
    // Certain properties we want to persist
    const propertiesToKeep = [PostHogPersistedProperty.Queue, PostHogPersistedProperty.OptedOut]

    for (const key in PostHogPersistedProperty) {
      if (!propertiesToKeep.includes(key as any)) {
        this._sharedClient.setPersistedProperty((PostHogPersistedProperty as any)[key], null)
      }
    }
    this._sharedClient.setPersistedProperty(PostHogPersistedProperty.DistinctId, distinctId)
  }

  enable(): void {
    return this._sharedClient.optIn()
  }

  disable(): void {
    return this._sharedClient.optOut()
  }

  capture({ distinctId, event, properties, groups, sendFeatureFlags }: EventMessageV1): void {
    this.reInit(distinctId)
    if (groups) {
      this._sharedClient.groups(groups)
    }
    this._sharedClient.capture(event, properties, (sendFeatureFlags || false))
  }

  identify({ distinctId, properties }: IdentifyMessageV1): void {
    this.reInit(distinctId)
    this._sharedClient.identify(distinctId, properties)
  }

  alias(data: { distinctId: string; alias: string }): void {
    this.reInit(data.distinctId)
    this._sharedClient.alias(data.alias)
  }

  async getFeatureFlag(
    key: string,
    distinctId: string,
    defaultResult?: boolean | string,
    groups?: Record<string, string>,
    personProperties?: Record<string, string>,
    groupProperties?: Record<string, Record<string, string>>,
    onlyEvaluateLocally: boolean = false,
    sendFeatureFlagEvents: boolean = true,
  ): Promise<string | boolean | undefined> {

    let response = await this.featureFlagsPoller?.getFeatureFlag(key, distinctId, groups, personProperties, groupProperties)

    const flagWasLocallyEvaluated = response !== undefined
    
    if (!flagWasLocallyEvaluated && !onlyEvaluateLocally) {
      this.reInit(distinctId)
      if (groups !== undefined) {
        this._sharedClient.groups(groups)
      }

      if (personProperties) {
        this._sharedClient.personProperties(personProperties)
      }

      if (groupProperties) {
        this._sharedClient.groupProperties(groupProperties)
      }
      await this._sharedClient.reloadFeatureFlagsAsync(false)
      response = this._sharedClient.getFeatureFlag(key, defaultResult)
    }

    const featureFlagReportedKey = `${key}_${response}`
      
    if (sendFeatureFlagEvents && (!(distinctId in this.distinctIdHasSentFlagCalls) || !(featureFlagReportedKey in this.distinctIdHasSentFlagCalls[distinctId]))) {
      if (Object.keys(this.distinctIdHasSentFlagCalls).length >= MAX_DICT_SIZE) {
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
          '$feature_flag': key,
          '$feature_flag_response': response,
          'locally_evaluated': flagWasLocallyEvaluated,
        },
      })
    }
    return response
  }

  async isFeatureEnabled(
    key: string,
    distinctId: string,
    defaultResult?: boolean,
    groups?: Record<string, string>,
    personProperties?: Record<string, string>,
    groupProperties?: Record<string, Record<string, string>>,
    onlyEvaluateLocally: boolean = false,
    sendFeatureFlagEvents: boolean = true,
  ): Promise<boolean> {
    const feat = await this.getFeatureFlag(key, distinctId, defaultResult, groups, personProperties, groupProperties, onlyEvaluateLocally, sendFeatureFlagEvents)
    return !!feat || false
  }

  async getAllFlags(
    distinctId: string,
    groups?: Record<string, string>,
    personProperties?: Record<string, string>,
    groupProperties?: Record<string, Record<string, string>>,
    onlyEvaluateLocally: boolean = false,
  ): Promise<Record<string, string | boolean>> {
    const localEvaluationResult = await this.featureFlagsPoller?.getAllFlags(distinctId, groups, personProperties, groupProperties)

    let response = {}
    let fallbackToDecide = true
    if (localEvaluationResult) {
      response = localEvaluationResult.response
      fallbackToDecide = localEvaluationResult.fallbackToDecide
    }

    if (fallbackToDecide && !onlyEvaluateLocally) {
      this.reInit(distinctId)
      if (groups !== undefined) {
        this._sharedClient.groups(groups)
      }

      if (personProperties) {
        this._sharedClient.personProperties(personProperties)
      }

      if (groupProperties) {
        this._sharedClient.groupProperties(groupProperties)
      }
      await this._sharedClient.reloadFeatureFlagsAsync(false)
      const remoteEvaluationResult = this._sharedClient.getFeatureFlags()

      return {...response, ...remoteEvaluationResult}
    }

    return response
  }

  groupIdentify({ groupType, groupKey, properties }: GroupIdentifyMessage): void {
    this._sharedClient.groupIdentify(groupType, groupKey, properties)
  }

  async reloadFeatureFlags(): Promise<void> {
    await this.featureFlagsPoller?.loadFeatureFlags(true)
  }

  flush(): void {
    this._sharedClient.flush()
  }

  shutdown(): void {
    void this._sharedClient.shutdownAsync()
  }

  shutdownAsync(): Promise<void> {
    return this._sharedClient.shutdownAsync()
  }

  debug(enabled?: boolean): void {
    return this._sharedClient.debug(enabled)
  }
}

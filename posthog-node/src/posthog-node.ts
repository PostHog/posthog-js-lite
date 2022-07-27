import { version } from '../package.json'
import undici from 'undici'
import {
  PostHogCore,
  PosthogCoreOptions,
  PostHogFetchOptions,
  PostHogFetchResponse,
  PostHogPersistedProperty,
} from '../../posthog-core/src'
import { EventMessageV1, GroupIdentifyMessage, IdentifyMessageV1, PostHogNodeV1 } from './types'

export type PostHogOptions = PosthogCoreOptions

class PostHog extends PostHogCore {
  private _memoryStorage: { [key: string]: any | undefined } = {}

  constructor(apiKey: string, options: PostHogOptions = {}) {
    options.captureMode = options?.captureMode || 'json'
    options.preloadFeatureFlags = false // Don't preload as this makes no sense without a distinctId

    super(apiKey, options)
  }

  getPersistedProperty(key: PostHogPersistedProperty): any | undefined {
    return this._memoryStorage[key]
  }

  setPersistedProperty(key: PostHogPersistedProperty, value: any | null): void {
    this._memoryStorage[key] = value !== null ? value : undefined
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

  constructor(apiKey: string, options: PostHogOptions = {}) {
    options.decidePollInterval = 0 // Forcefully set to 0 so we don't auto-reload
    this._sharedClient = new PostHog(apiKey, options)
  }

  private reInit(distinctId: string): void {
    // Remove all state except the queue
    const queue = this._sharedClient.getPersistedProperty(PostHogPersistedProperty.Queue)
    this._sharedClient.reset()
    this._sharedClient.setPersistedProperty(PostHogPersistedProperty.Queue, queue)
    this._sharedClient.setPersistedProperty(PostHogPersistedProperty.DistinctId, distinctId)
  }

  enable(): void {
    return this._sharedClient.optIn()
  }

  disable(): void {
    return this._sharedClient.optOut()
  }

  capture({ distinctId, event, properties, groups }: EventMessageV1): void {
    this.reInit(distinctId)
    if (groups) {
      this._sharedClient.groups(groups)
    }
    this._sharedClient.capture(event, properties)
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
    groups?: Record<string, string> | undefined
  ): Promise<string | boolean | undefined> {
    this.reInit(distinctId)
    if (groups) {
      this._sharedClient.groups(groups)
    }
    await this._sharedClient.reloadFeatureFlagsAsync()
    return this._sharedClient.getFeatureFlag(key)
  }

  async isFeatureEnabled(
    key: string,
    distinctId: string,
    defaultResult?: boolean | undefined,
    groups?: Record<string, string> | undefined
  ): Promise<boolean> {
    const feat = this.getFeatureFlag(key, distinctId, groups)
    return !!feat || defaultResult || false
  }

  groupIdentify({ groupType, groupKey, properties }: GroupIdentifyMessage): void {
    this._sharedClient.groupIdentify(groupType, groupKey, properties)
  }

  reloadFeatureFlags(): Promise<void> {
    throw new Error('Method not implemented.')
  }

  shutdown(): void {
    void this._sharedClient.shutdownAsync()
  }

  shutdownAsync(): Promise<void> {
    return this._sharedClient.shutdownAsync()
  }
}

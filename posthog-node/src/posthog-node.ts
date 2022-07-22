import { version } from '../package.json'
import undici from 'undici'
import {
  PostHogCore,
  PosthogCoreOptions,
  PostHogFetchOptions,
  PostHogFetchResponse,
  PostHogPersistedProperty,
  utils,
} from '../../posthog-core/src'

export type PostHogOptions = PosthogCoreOptions

const SHARED_PERSISTENCE_PROPERTIES = [PostHogPersistedProperty.Queue]

export class PostHog extends PostHogCore {
  private _sharedStorage: { [key: string]: any | undefined } = {}
  private _memoryStorage: { [key: string]: any | undefined } = {}

  constructor(globalStorage: { [key: string]: any | undefined }, apiKey: string, options: PostHogOptions = {}) {
    options.captureMode = options?.captureMode || 'json'
    options.preloadFeatureFlags = false // Don't preload as this makes no sense without a distinctId

    super(apiKey, options)
    this._sharedStorage = globalStorage

    this.scheduleFlushTimer(options.flushInterval ?? 10000)
  }

  scheduleFlushTimer(interval: number): void {
    if (interval && !this._flushTimer) {
      this._flushTimer = utils.safeSetTimeout(
        () =>
          this.flush(() => {
            this.scheduleFlushTimer(interval)
          }),
        interval
      )
    }
  }

  getPersistedProperty(key: PostHogPersistedProperty): any | undefined {
    const storage = SHARED_PERSISTENCE_PROPERTIES.includes(key) ? this._sharedStorage : this._memoryStorage
    return storage[key]
  }
  setPersistedProperty(key: PostHogPersistedProperty, value: any | null): void {
    const storage = SHARED_PERSISTENCE_PROPERTIES.includes(key) ? this._sharedStorage : this._memoryStorage
    storage[key] = value !== null ? value : undefined
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
export class PostHogGlobal {
  private _sharedStorage: { [key: string]: any | undefined } = {}
  private _sharedClient: PostHog

  constructor(private apiKey: string, private options?: PostHogOptions) {
    this._sharedClient = new PostHog(this._sharedStorage, apiKey, options)
  }

  user(distinctId: string): PostHog {
    const client = new PostHog(this._sharedStorage, this.apiKey, {
      ...(this.options || {}),
      flushInterval: 0,
    })
    client.setPersistedProperty(PostHogPersistedProperty.DistinctId, distinctId)
    return client
  }

  /**
   * @deprecated Since version 2.0.0. Use .user(distinctId: string).capture(event, properties)
   */
  capture(message: { distinctId: string; event: string; properties?: any }): this {
    this.user(message.distinctId).capture(message.event, message.properties)
    return this
  }

  shutdown(): void {
    void this._sharedClient.shutdownAsync()
  }

  shutdownAsync(): Promise<void> {
    return this._sharedClient.shutdownAsync()
  }

  // TODO: Implement previous global API, doing some sort of clever linking to the underlying "user" prop
}

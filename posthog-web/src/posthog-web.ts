import {
  PostHogCore,
  PostHogFetchOptions,
  PostHogFetchResponse,
  PostHogPersistedProperty,
} from '../../posthog-core/src'
import { getContext } from './context'
import { PostHogStorage, getStorage } from './storage'
import { version } from '../package.json'
import { PostHogOptions } from './types'

export class PostHog extends PostHogCore {
  private _storage: PostHogStorage
  private _storageCache: any
  private _storageKey: string

  constructor(apiKey: string, options?: PostHogOptions) {
    super(apiKey, options)

    // posthog-js stores options in one object on
    this._storageKey = options?.persistence_name ? `ph_${options.persistence_name}` : `ph_${apiKey}_posthog`

    const _window: Window | undefined = (typeof window !== 'undefined') ? window : undefined
    this._storage = getStorage(options?.persistence || 'localStorage', _window)
    this.setupBootstrap(options)

    if (options?.preloadFeatureFlags !== false) {
      this.reloadFeatureFlags()
    }
  }

  getPersistedProperty<T>(key: PostHogPersistedProperty): T | undefined {
    if (!this._storageCache) {
      this._storageCache = JSON.parse(this._storage.getItem(this._storageKey) || '{}') || {}
    }

    return this._storageCache[key]
  }

  setPersistedProperty<T>(key: PostHogPersistedProperty, value: T | null): void {
    if (!this._storageCache) {
      this._storageCache = JSON.parse(this._storage.getItem(this._storageKey) || '{}') || {}
    }

    if (value === null) {
      delete this._storageCache[key]
    } else {
      this._storageCache[key] = value
    }

    this._storage.setItem(this._storageKey, JSON.stringify(this._storageCache))
  }

  fetch(url: string, options: PostHogFetchOptions): Promise<PostHogFetchResponse> {
    // TODO: what to do here?
    // should we move this to core? https://github.com/PostHog/posthog-js-lite/blob/main/posthog-node/src/fetch.ts
    // and reuse it here? if window isn't available?
    return window.fetch(url, options)
  }

  getLibraryId(): string {
    return 'posthog-js-lite'
  }

  getLibraryVersion(): string {
    return version
  }

  getCustomUserAgent(): void {
    return
  }

  getCommonEventProperties(): any {
    const _window: Window | undefined = (typeof window !== 'undefined') ? window : undefined
    return {
      ...super.getCommonEventProperties(),
      ...getContext(_window),
    }
  }
}

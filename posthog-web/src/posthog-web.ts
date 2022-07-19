import {
  PostHogCore,
  PosthogCoreOptions,
  PostHogFetchOptions,
  PostHogFetchResponse,
  PostHogPersistedProperty,
} from '../../posthog-core'
import { getContext } from './context'
import { localStore, cookieStore, sessionStorage } from './storage'
import { version } from '../package.json'

export interface PostHogWebOptions extends PosthogCoreOptions {
  autocapture?: boolean
  persistence_name?: string
}

export class PostHogWeb extends PostHogCore {
  private _storage = localStore || sessionStorage || cookieStore
  private _storageCache: any
  private _storageKey: string

  constructor(apiKey: string, options?: PostHogWebOptions) {
    super(apiKey, options)

    // posthog-js stores options in one object on
    this._storageKey = options?.persistence_name ? `ph_${options.persistence_name}` : `ph_${apiKey}_posthog`
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
      this._storage.removeItem(this._storageKey)
    } else {
      this._storageCache[key] = value
      this._storage.setItem(this._storageKey, JSON.stringify(this._storageCache))
    }
  }


  fetch(url: string, options: PostHogFetchOptions): Promise<PostHogFetchResponse> {
    return window.fetch(url, options)
  }
  getLibraryId(): string {
    return 'posthog-web'
  }
  getLibraryVersion(): string {
    return version
  }
  getCustomUserAgent(): void {
    return
  }

  getCommonEventProperties(): any {
    return {
      ...super.getCommonEventProperties(),
      ...getContext(window),
    }
  }

  // CUSTOM
  optedIn() {
    return this.enabled
  }

  optIn() {
    this.enable()
  }

  optOut() {
    this.disable()
  }
}

import {
  PostHogCore,
  PosthogCoreOptions,
  PostHogStorage,
  PostHogFetchOptions,
  PostHogFetchResponse,
  PostHogPersistedProperty,
} from 'posthog-core'
// import { version } from '../package.json'
import { getContext } from './context'
import { localStore, cookieStore, sessionStorage } from './storage'

// TODO: Get this from package.json
const version = '2.0.0-alpha'

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

  getPersistedProperty(key: PostHogPersistedProperty): string | undefined {
    if (!this._storageCache) {
      this._storageCache = JSON.parse(this._storage.getItem(this._storageKey) || '{}')
    }

    return this._storageCache[key]
  }

  setPersistedProperty(key: PostHogPersistedProperty, value: string): void {
    if (!this._storageCache) {
      this._storageCache = JSON.parse(this._storage.getItem(this._storageKey) || '{}')
    }

    this._storageCache[key] = value
    this._storage.setItem(this._storageKey, JSON.stringify(this._storageCache))
  }

  storage(): PostHogStorage {
    return localStore || sessionStorage || cookieStore
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

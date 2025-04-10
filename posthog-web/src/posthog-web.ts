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
import { getFetch } from 'posthog-core/src/utils'
import { patch } from '../../posthog-core/src/patch'

export class PostHog extends PostHogCore {
  private _storage: PostHogStorage
  private _storageCache: any
  private _storageKey: string

  constructor(apiKey: string, options?: PostHogOptions) {
    super(apiKey, options)

    // posthog-js stores options in one object on
    this._storageKey = options?.persistence_name ? `ph_${options.persistence_name}` : `ph_${apiKey}_posthog`

    this._storage = getStorage(options?.persistence || 'localStorage', this.getWindow())
    this.setupBootstrap(options)

    if (options?.preloadFeatureFlags !== false) {
      this.reloadFeatureFlags()
    }

    if (options?.captureHistoryEvents && typeof window !== 'undefined') {
      this.setupHistoryEventTracking()
    }
  }

  private getWindow(): Window | undefined {
    return typeof window !== 'undefined' ? window : undefined
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
    const fetchFn = getFetch()

    if (!fetchFn) {
      // error will be handled by the caller (fetchWithRetry)
      return Promise.reject(new Error('Fetch API is not available in this environment.'))
    }

    return fetchFn(url, options)
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
    return {
      ...super.getCommonEventProperties(),
      ...getContext(this.getWindow()),
    }
  }

  // Setup tracking for the three SPA navigation types: pushState, replaceState, and popstate
  private setupHistoryEventTracking(): void {
    const window = this.getWindow()
    if (!window) {
      return
    }

    // Old fashioned, we could also use arrow functions but I think relying on the closure for a patch is more reliable
    // eslint-disable-next-line @typescript-eslint/no-this-alias
    const self = this

    // Use patch with proper History method types
    patch(window.history, 'pushState', (originalPushState) => {
      return function patchedPushState(history: History, state: any, title: string, url?: string | URL | null): void {
        (originalPushState as History['pushState']).call(history, state, title, url)
        self.captureNavigationEvent('pushState')
      }
    })

    patch(window.history, 'replaceState', (originalReplaceState) => {
      return function patchedReplaceState(history: History, state: any, title: string, url?: string | URL | null): void {
        (originalReplaceState as History['replaceState']).call(history, state, title, url)
        self.captureNavigationEvent('replaceState')
      }
    })

    // For popstate we need to listen to the event instead of overriding a method
    window.addEventListener('popstate', () => {
      this.captureNavigationEvent('popstate')
    })
  }

  // Capture navigation as pageview with only navigation_type
  // URL and pathname come from getCommonEventProperties()
  private captureNavigationEvent(navigationType: 'pushState' | 'replaceState' | 'popstate'): void {
    const window = this.getWindow()
    if (!window) {
      return
    }

    this.capture('$pageview', { navigation_type: navigationType })
  }
}

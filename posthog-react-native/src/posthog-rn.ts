import { AppState, Dimensions } from 'react-native'

import {
  PostHogCore,
  PosthogCoreOptions,
  PostHogFetchOptions,
  PostHogFetchResponse,
  PostHogPersistedProperty,
} from '../../posthog-core/src'
import { PostHogMemoryStorage } from '../../posthog-core/src/storage-memory'
import { getLegacyValues } from './legacy'
import { SemiAsyncStorage } from './storage'
import { version } from './version'
import { buildOptimisiticAsyncStorage, getAppProperties } from './native-deps'
import { PostHogAutocaptureOptions, PostHogCustomAppProperties, PostHogCustomAsyncStorage } from './types'
import { withReactNativeNavigation } from './frameworks/wix-navigation'

export type PostHogOptions = PosthogCoreOptions & {
  persistence?: 'memory' | 'file'
  customAppProperties?:
    | PostHogCustomAppProperties
    | ((properties: PostHogCustomAppProperties) => PostHogCustomAppProperties)
  customAsyncStorage?: PostHogCustomAsyncStorage
}

export class PostHog extends PostHogCore {
  private _persistence: PostHogOptions['persistence']
  private _memoryStorage = new PostHogMemoryStorage()
  private _semiAsyncStorage: SemiAsyncStorage
  private _appProperties: PostHogCustomAppProperties = {}

  /** Await this method to ensure that all state has been loaded from the async provider */
  static async initAsync(apiKey: string, options?: PostHogOptions): Promise<PostHog> {
    const storage = new SemiAsyncStorage(options?.customAsyncStorage || buildOptimisiticAsyncStorage())
    const posthog = new PostHog(apiKey, options, storage)
    await posthog._semiAsyncStorage.preloadAsync()
    return posthog
  }

  constructor(apiKey: string, options?: PostHogOptions, storage?: SemiAsyncStorage) {
    super(apiKey, options)
    this._persistence = options?.persistence

    // Either build the app properties from the existing ones
    this._appProperties =
      typeof options?.customAppProperties === 'function'
        ? options.customAppProperties(getAppProperties())
        : options?.customAppProperties || getAppProperties()

    this._semiAsyncStorage =
      storage || new SemiAsyncStorage(options?.customAsyncStorage || buildOptimisiticAsyncStorage())

    AppState.addEventListener('change', () => {
      this.flush()
    })

    // Ensure the async storage has been preloaded (this call is cached)

    const setupFromStorage = (): void => {
      this.setupBootstrap(options)

      // It is possible that the old library was used so we try to get the legacy distinctID
      if (!this._semiAsyncStorage.getItem(PostHogPersistedProperty.AnonymousId)) {
        getLegacyValues().then((legacyValues) => {
          if (legacyValues?.distinctId) {
            this._semiAsyncStorage.setItem(PostHogPersistedProperty.DistinctId, legacyValues.distinctId)
            this._semiAsyncStorage.setItem(PostHogPersistedProperty.AnonymousId, legacyValues.anonymousId)
          }
        })
      }
    }

    if (this._semiAsyncStorage.isPreloaded) {
      setupFromStorage()
    } else {
      void this._semiAsyncStorage.preloadAsync().then(() => {
        setupFromStorage()
      })
    }
  }

  getPersistedProperty<T>(key: PostHogPersistedProperty): T | undefined {
    if (this._persistence === 'memory') {
      return this._memoryStorage.getProperty(key)
    }
    return this._semiAsyncStorage.getItem(key) || undefined
  }
  setPersistedProperty<T>(key: PostHogPersistedProperty, value: T | null): void {
    if (this._persistence === 'memory') {
      return this._memoryStorage.setProperty(key, value)
    }
    return value !== null ? this._semiAsyncStorage.setItem(key, value) : this._semiAsyncStorage.removeItem(key)
  }

  fetch(url: string, options: PostHogFetchOptions): Promise<PostHogFetchResponse> {
    return fetch(url, options)
  }

  getLibraryId(): string {
    return 'posthog-react-native'
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
      ...this._appProperties,
      $screen_height: Dimensions.get('screen').height,
      $screen_width: Dimensions.get('screen').width,
    }
  }

  // Custom methods
  screen(name: string, properties?: any): this {
    return this.capture('$screen', {
      ...properties,
      $screen_name: name,
    })
  }

  initReactNativeNavigation(options: PostHogAutocaptureOptions): boolean {
    return withReactNativeNavigation(this, options)
  }
}

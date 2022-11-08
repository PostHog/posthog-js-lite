import { AppState, Dimensions, Platform } from 'react-native'

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
import { version } from '../package.json'
import { buildAppProperties, buildOptimisiticAsyncStorage } from './native-deps'
import { PostHogCustomAppProperties, PostHogCustomAsyncStorage } from './types'

export type PostHogOptions = PosthogCoreOptions & {
  persistence?: 'memory' | 'file'
  customAppProperties?: () => PostHogCustomAppProperties
  customAsyncStorage?: PostHogCustomAsyncStorage
}

export class PostHog extends PostHogCore {
  private _persistence: PostHogOptions['persistence']
  private _memoryStorage = new PostHogMemoryStorage()
  private _semiAsyncStorage: SemiAsyncStorage
  private _buildAppProperties = buildAppProperties

  constructor(apiKey: string, options?: PostHogOptions) {
    super(apiKey, options)
    this._persistence = options?.persistence
    this._buildAppProperties = options?.customAppProperties || buildAppProperties
    this._semiAsyncStorage = new SemiAsyncStorage(options?.customAsyncStorage || buildOptimisiticAsyncStorage())

    AppState.addEventListener('change', () => {
      this.flush()
    })

    // Ensure the async storage has been preloaded (this call is cached)

    // It is possible that the old library was used so we try to get the legacy distinctID
    void this._semiAsyncStorage.preloadAsync().then(() => {
      this.setupBootstrap(options)

      if (!this._semiAsyncStorage.getItem(PostHogPersistedProperty.AnonymousId)) {
        getLegacyValues().then((legacyValues) => {
          if (legacyValues?.distinctId) {
            this._semiAsyncStorage.setItem(PostHogPersistedProperty.DistinctId, legacyValues.distinctId)
            this._semiAsyncStorage.setItem(PostHogPersistedProperty.AnonymousId, legacyValues.anonymousId)
          }
        })
      }
    })
  }

  /** Await this method to ensure that all state has been loaded from the async provider */
  async initAsync(): Promise<void> {
    await this._semiAsyncStorage
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
      ...this._buildAppProperties(),
      $device_type: Platform.OS,
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
}

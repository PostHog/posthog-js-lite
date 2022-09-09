import { AppState, Dimensions, Platform } from 'react-native'
import * as ExpoApplication from 'expo-application'
import * as ExpoDevice from 'expo-device'
import * as ExpoLocalization from 'expo-localization'

import {
  PostHogCore,
  PosthogCoreOptions,
  PostHogFetchOptions,
  PostHogFetchResponse,
  PostHogPersistedProperty,
} from '../../posthog-core/src'
import { PostHogMemoryStorage } from '../../posthog-core/src/storage-memory'
import { getLegacyValues } from './legacy'
import { SemiAsyncStorage, preloadSemiAsyncStorage } from './storage'
import { version } from '../package.json'

export type PostHogOptions = PosthogCoreOptions & {
  persistence?: 'memory' | 'file'
}

export class PostHog extends PostHogCore {
  private _persistence: PostHogOptions['persistence']
  private _memoryStorage = new PostHogMemoryStorage()

  static initAsync(): Promise<void> {
    return preloadSemiAsyncStorage()
  }

  constructor(apiKey: string, options?: PostHogOptions) {
    super(apiKey, options)
    this._persistence = options?.persistence

    AppState.addEventListener('change', () => {
      this.flush()
    })

    // Ensure the async storage has been preloaded (this call is cached)

    // It is possible that the old library was used so we try to get the legacy distinctID
    void preloadSemiAsyncStorage().then(() => {
      // We run this extra here as the storage may have been reset...
      this.setupBootstrap(options)

      if (!SemiAsyncStorage.getItem(PostHogPersistedProperty.AnonymousId)) {
        getLegacyValues().then((legacyValues) => {
          if (legacyValues?.distinctId) {
            SemiAsyncStorage.setItem(PostHogPersistedProperty.DistinctId, legacyValues.distinctId)
            SemiAsyncStorage.setItem(PostHogPersistedProperty.AnonymousId, legacyValues.anonymousId)
          }
        })
      }
    })
  }

  getPersistedProperty<T>(key: PostHogPersistedProperty): T | undefined {
    if (this._persistence === 'memory') {
      return this._memoryStorage.getProperty(key)
    }
    return SemiAsyncStorage.getItem(key) || undefined
  }
  setPersistedProperty<T>(key: PostHogPersistedProperty, value: T | null): void {
    if (this._persistence === 'memory') {
      return this._memoryStorage.setProperty(key, value)
    }
    return value !== null ? SemiAsyncStorage.setItem(key, value) : SemiAsyncStorage.removeItem(key)
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
      $app_build: '1',
      $app_name: ExpoApplication.applicationName,
      $app_namespace: ExpoApplication.applicationId,
      $app_version: ExpoApplication.nativeApplicationVersion,
      $device_manufacturer: ExpoDevice.manufacturer,
      $device_name: ExpoDevice.modelName,
      $device_type: Platform.OS,
      $locale: ExpoLocalization.locale,
      $os_name: ExpoDevice.osName,
      $os_version: ExpoDevice.osVersion,
      $screen_height: Dimensions.get('screen').height,
      $screen_width: Dimensions.get('screen').width,
      $timezone: ExpoLocalization.timezone,
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

// NOTE: This ensures that we have the AsyncStorage loaded into memory hopefully before PostHog
// is used
void PostHog.initAsync()

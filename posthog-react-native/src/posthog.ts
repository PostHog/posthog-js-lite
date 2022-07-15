import { AppState, Dimensions } from 'react-native'
import * as ExpoApplication from 'expo-application'
import * as ExpoDevice from 'expo-device'

import {
  PostHogCore,
  PosthogCoreOptions,
  PostHogFetchOptions,
  PostHogFetchResponse,
  PostHogPersistedProperty,
} from 'posthog-core'
import { getLegacyValues } from './legacy'
import { SemiAsyncStorage, preloadSemiAsyncStorage } from './storage'
import { OptionalExpoLocalization } from './optional-imports'
// import { version } from '../package.json'

// TODO: Get this from package.json
const version = '2.0.0-alpha'

export interface PostHogReactNativeOptions extends PosthogCoreOptions {}

const STORAGE_PREFIX = '@posthog:'

export class PostHogReactNative extends PostHogCore {
  constructor(apiKey: string, options?: PostHogReactNativeOptions) {
    super(apiKey, options)

    AppState.addEventListener('change', (state) => {
      this.flush()
    })

    // Ensure the async storage has been preloaded (this call is cached)
    preloadSemiAsyncStorage()

    // It is possible that the old library was used so we try to get the legacy distinctID
    preloadSemiAsyncStorage().then(() => {
      const key = `${STORAGE_PREFIX}${PostHogPersistedProperty.DistinctId}`
      if (!SemiAsyncStorage.getItem(key)) {
        getLegacyValues().then((legacyValues) => {
          if (legacyValues?.distinctId) {
            SemiAsyncStorage.setItem(key, legacyValues.distinctId)
          }
        })
      }
    })
  }

  getPersistedProperty(key: PostHogPersistedProperty): string | undefined {
    return SemiAsyncStorage.getItem(`${STORAGE_PREFIX}${key}`) || undefined
  }
  setPersistedProperty(key: PostHogPersistedProperty, value: string): void {
    return SemiAsyncStorage.setItem(`${STORAGE_PREFIX}${key}`, value)
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
      $app_name: ExpoApplication?.applicationName,
      $app_namespace: ExpoApplication?.applicationId,
      $app_version: ExpoApplication?.nativeApplicationVersion,
      // "$device_id": "F31C35E8-5B28-4626-8AFC-213D1C655FF9",
      $device_manufacturer: ExpoDevice?.manufacturer,
      //     "$device_model": "x86_64",
      $device_name: ExpoDevice?.modelName,
      // "$device_type": "ios",
      $locale: OptionalExpoLocalization?.locale,
      //     "$network_cellular": false,
      //     "$network_wifi": true,
      $os_name: ExpoDevice?.osName,
      $os_version: ExpoDevice?.osVersion,
      $screen_height: Dimensions.get('screen').height,
      $screen_width: Dimensions.get('screen').width,
      $timezone: OptionalExpoLocalization?.timezone,
    }
  }

  // Custom methods
  screen(name: string, properties?: any) {
    this.capture('$screen', {
      ...properties,
      $screen_name: name,
    })
  }
}

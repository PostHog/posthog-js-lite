import { AppState, Dimensions } from 'react-native'
import * as ExpoApplication from 'expo-application'
import * as ExpoDevice from 'expo-device'

import {
  PostHogCore,
  PosthogCoreOptions,
  PostHogFetchOptions,
  PostHogFetchResponse,
  PostHogStorage,
  utils,
} from 'posthog-core'
import { getLegacyValues } from './legacy'
import { SemiAsyncStorage, preloadSemiAsyncStorage } from './storage'
import { OptionalExpoLocalization, OptionalExpoNetwork } from './optional-imports'
// import { version } from '../package.json'

// TODO: Get this from package.json
const version = '2.0.0-alpha'

export interface PostHogReactNativeOptions extends PosthogCoreOptions {}

const KEY_DISTINCT_ID = '@posthog:distinct_id'

export class PostHogReactNative extends PostHogCore {
  constructor(apiKey: string, options?: PostHogReactNativeOptions) {
    super(apiKey, options)

    AppState.addEventListener('change', (state) => {
      this.flush()
    })

    // Ensure the async storage has been preloaded (this call is cached)
    preloadSemiAsyncStorage()

    // It is possible that the old library was used so we try to get the legacy distinctID
    let existingDistinctId = this.storage().getItem(KEY_DISTINCT_ID)
    preloadSemiAsyncStorage().then(() => {
      getLegacyValues().then((legacyValues) => {
        if (!existingDistinctId) {
          if (legacyValues?.distinctId) {
            this.storage().setItem(KEY_DISTINCT_ID, legacyValues.distinctId)
            existingDistinctId = legacyValues.distinctId
          }
        }
      })
    })
  }

  storage(): PostHogStorage {
    return SemiAsyncStorage
  }

  fetch(url: string, options: PostHogFetchOptions): Promise<PostHogFetchResponse> {
    return fetch(url, options)
  }
  setImmediate(fn: () => void): void {
    setImmediate(fn)
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

  screen(name: string, properties?: any) {
    this.capture('$screen', {
      ...properties,
      $screen_name: name,
    })
  }

  getDistinctId(): string {
    const existingDistinctId = this.storage().getItem(KEY_DISTINCT_ID)
    return existingDistinctId || this.onSetDistinctId(utils.generateUUID())
  }

  onSetDistinctId(newDistinctId: string): string {
    this.storage().setItem(KEY_DISTINCT_ID, newDistinctId)
    return newDistinctId
  }
}

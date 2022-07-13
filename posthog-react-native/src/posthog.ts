import { AppState, Dimensions } from 'react-native'

import OptionalImports from './optional-imports'

const AsyncStorage = OptionalImports.OptionalAsyncStorage
const ExpoApplication = OptionalImports.OptionalExpoApplication
const ExpoDevice = OptionalImports.OptionalExpoDevice

import { PostHogCore, PosthogCoreOptions, PostHogFetchOptions, PostHogFetchResponse, utils } from 'posthog-core'
// import { version } from '../package.json'

// TODO: Get this from package.json
const version = '2.0.0-alpha'

export interface PostHogReactNativeOptions extends PosthogCoreOptions {
  /**
   * Whether the posthog client should automatically capture application lifecycle events, such as
   * "Application Installed", "Application Updated" and "Application Opened".
   *
   * Disabled by default.
   */
  captureApplicationLifecycleEvents?: boolean
}

const KEY_DISTINCT_ID = '@posthog:distinct_id'

export class PostHogReactNative extends PostHogCore {
  private _cachedDistinctId?: string

  constructor(apiKey: string, options?: PostHogReactNativeOptions) {
    super(apiKey, options)

    AppState.addEventListener('change', (state) => {
      this.flush()
    })
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
      //     "$locale": "de-US",
      //     "$network_cellular": false,
      //     "$network_wifi": true,
      $os_name: ExpoDevice?.osName,
      $os_version: ExpoDevice?.osVersion,
      $screen_height: Dimensions.get('screen').height,
      $screen_width: Dimensions.get('screen').width,
      //     "$timezone": "Europe/Berlin"
    }
  }

  screen(name: string, properties?: any) {
    this.capture('$screen', {
      ...properties,
      $screen_name: name,
    })
  }

  async getDistinctId(): Promise<string> {
    if (this._cachedDistinctId) return this._cachedDistinctId
    const existingDistinctId = await AsyncStorage?.getItem(KEY_DISTINCT_ID)
    return existingDistinctId || (await this.onSetDistinctId(utils.generateUUID()))
  }

  async onSetDistinctId(newDistinctId: string): Promise<string> {
    this._cachedDistinctId = newDistinctId

    AsyncStorage?.setItem(KEY_DISTINCT_ID, newDistinctId)

    return newDistinctId
  }
}

import AsyncStorage from '@react-native-async-storage/async-storage'
import * as Application from 'expo-application';
import * as Device from 'expo-device';
import {AppState, Dimensions} from 'react-native';

import {PostHogCore, PostHogCoreFetchRequest, PostHogCoreFetchResponse, PosthogCoreOptions} from 'posthog-core';
import {version} from '../package.json';
import { generateUUID } from 'posthog-core/src/utils';


export interface PostHogReactNativeOptions extends PosthogCoreOptions {
  /**
   * Whether the posthog client should automatically capture application lifecycle events, such as
   * "Application Installed", "Application Updated" and "Application Opened".
   *
   * Disabled by default.
   */
  captureApplicationLifecycleEvents?: boolean;
}

const KEY_DISTINCT_ID = '@posthog:distinct_id';

export class PostHogReactNative extends PostHogCore {
  private _cachedDistinctId?: string;

  constructor(apiKey: string, options?: PostHogReactNativeOptions) {
    super(apiKey, options);

    AppState.addEventListener('change', state => {
      this.flush((err, data) => {
        console.error(err);
        console.log(data);
      });
    });
  }

  fetch(req: PostHogCoreFetchRequest): Promise<PostHogCoreFetchResponse> {
    return fetch(req.url, {
      method: req.method,
      headers: req.headers,
      body: JSON.stringify(req.data),
    }).then(async res => ({
      status: res.status,
      data: await res.json(),
    }));
  }
  getLibraryId(): string {
    return 'posthog-react-native';
  }
  getLibraryVersion(): string {
    return version;
  }
  getCustomUserAgent(): void {
    return;
  }

  getCommonEventProperties(): any {
    return {
      ...super.getCommonEventProperties(),
      $app_build: '1',
      $app_name: Application.applicationName,
      $app_namespace: Application.applicationId,
      $app_version: Application.nativeApplicationVersion,
      // "$device_id": "F31C35E8-5B28-4626-8AFC-213D1C655FF9",
      $device_manufacturer: Device.manufacturer,
      //     "$device_model": "x86_64",
      $device_name: Device.modelName,
      // "$device_type": "ios",
      //     "$locale": "de-US",
      //     "$network_cellular": false,
      //     "$network_wifi": true,
      $os_name: Device.osName,
      $os_version: Device.osVersion,
      $screen_height: Dimensions.get('screen').height,
      $screen_width: Dimensions.get('screen').width,
      //     "$timezone": "Europe/Berlin"
    };
  }

  screen(name: string, properties?: any) {
    this.capture('$screen', {
      ...properties,
      $screen_name: name,
    });
  }

  async getDistinctId(): Promise<string> {
    if (this._cachedDistinctId) return this._cachedDistinctId;
    const existingDistinctId = await AsyncStorage.getItem(KEY_DISTINCT_ID);
    return existingDistinctId || (await this.onSetDistinctId(generateUUID()))
  }

  async onSetDistinctId(newDistinctId: string): Promise<string> {
    this._cachedDistinctId = newDistinctId;

    AsyncStorage.setItem(KEY_DISTINCT_ID, newDistinctId);

    return newDistinctId;
  }
}

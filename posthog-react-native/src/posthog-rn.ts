import { AppState, Dimensions, Linking } from 'react-native'

import {
  PostHogCaptureOptions,
  PostHogCore,
  PostHogCoreOptions,
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

export type PostHogOptions = PostHogCoreOptions & {
  persistence?: 'memory' | 'file'
  /** Allows you to provide your own implementation of the common information about your App or a function to modify the default App properties generated  */
  customAppProperties?:
    | PostHogCustomAppProperties
    | ((properties: PostHogCustomAppProperties) => PostHogCustomAppProperties)
  customAsyncStorage?: PostHogCustomAsyncStorage
  captureNativeAppLifecycleEvents?: boolean
}

export class PostHog extends PostHogCore {
  private _persistence: PostHogOptions['persistence']
  private _memoryStorage = new PostHogMemoryStorage()
  private _semiAsyncStorage?: SemiAsyncStorage
  private _appProperties: PostHogCustomAppProperties = {}

  constructor(apiKey: string, options?: PostHogOptions) {
    super(apiKey, options)
    this._isInitialized = false
    this._persistence = options?.persistence ?? 'file'

    // Either build the app properties from the existing ones
    this._appProperties =
      typeof options?.customAppProperties === 'function'
        ? options.customAppProperties(getAppProperties())
        : options?.customAppProperties || getAppProperties()

    AppState.addEventListener('change', () => {
      this.flush()
    })

    if (this._persistence === 'file') {
      this._semiAsyncStorage = new SemiAsyncStorage(options?.customAsyncStorage || buildOptimisiticAsyncStorage())
    }

    // Ensure the async storage has been preloaded (this call is cached)
    const setupAsync = async (): Promise<void> => {
      if (!this._semiAsyncStorage?.isPreloaded) {
        await this._semiAsyncStorage?.preloadAsync()
      }
      this.setupBootstrap(options)

      // It is possible that the old library was used so we try to get the legacy distinctID
      if (!this._semiAsyncStorage?.getItem(PostHogPersistedProperty.AnonymousId)) {
        const legacyValues = await getLegacyValues()
        if (legacyValues?.distinctId) {
          this._semiAsyncStorage?.setItem(PostHogPersistedProperty.DistinctId, legacyValues.distinctId)
          this._semiAsyncStorage?.setItem(PostHogPersistedProperty.AnonymousId, legacyValues.anonymousId)
        }
      }
    }

    this._initPromise = setupAsync()

    // Not everything needs to be in the init promise
    this._initPromise.then(async () => {
      this._isInitialized = true
      if (options?.preloadFeatureFlags !== false) {
        this.reloadFeatureFlags()
      }

      if (options?.captureNativeAppLifecycleEvents) {
        if (this._persistence === 'memory') {
          console.warn(
            'PostHog was initialised with persistence set to "memory", capturing native app events is not supported.'
          )
        } else {
          await this.captureNativeAppLifecycleEvents()
        }
      }

      await this.persistAppVersion()
    })
  }

  // NOTE: This is purely a helper method for testing purposes or those who wish to be certain the SDK is fully initialised
  public async ready(): Promise<void> {
    await this._initPromise
  }

  getPersistedProperty<T>(key: PostHogPersistedProperty): T | undefined {
    return this._semiAsyncStorage
      ? this._semiAsyncStorage.getItem(key) ?? undefined
      : this._memoryStorage.getProperty(key)
  }
  setPersistedProperty<T>(key: PostHogPersistedProperty, value: T | null): void {
    return this._semiAsyncStorage
      ? value !== null
        ? this._semiAsyncStorage.setItem(key, value)
        : this._semiAsyncStorage.removeItem(key)
      : this._memoryStorage.setProperty(key, value)
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
  async screen(name: string, properties?: { [key: string]: any }, options?: PostHogCaptureOptions): Promise<void> {
    await this._initPromise
    // Screen name is good to know for all other subsequent events
    this.registerForSession({
      $screen_name: name,
    })

    return this.capture(
      '$screen',
      {
        ...properties,
        $screen_name: name,
      },
      options
    )
  }

  initReactNativeNavigation(options: PostHogAutocaptureOptions): boolean {
    return withReactNativeNavigation(this, options)
  }

  private async captureNativeAppLifecycleEvents(): Promise<void> {
    // See the other implementations for reference:
    // ios: https://github.com/PostHog/posthog-ios/blob/3a6afc24d6bde730a19470d4e6b713f44d076ad9/PostHog/Classes/PHGPostHog.m#L140
    // android: https://github.com/PostHog/posthog-android/blob/09940e6921bafa9e01e7d68b8c9032671a21ae73/posthog/src/main/java/com/posthog/android/PostHog.java#L278
    // android: https://github.com/PostHog/posthog-android/blob/09940e6921bafa9e01e7d68b8c9032671a21ae73/posthog/src/main/java/com/posthog/android/PostHogActivityLifecycleCallbacks.java#L126

    const prevAppBuild = this.getPersistedProperty(PostHogPersistedProperty.InstalledAppBuild)
    const prevAppVersion = this.getPersistedProperty(PostHogPersistedProperty.InstalledAppVersion)
    const appBuild = this._appProperties.$app_build
    const appVersion = this._appProperties.$app_version

    if (!appBuild || !appVersion) {
      console.warn(
        'PostHog could not track installation/update/open, as the build and version were not set. ' +
          'This can happen if some dependencies are not installed correctly, or if you have provided' +
          'customAppProperties but not included $app_build or $app_version.'
      )
    }
    if (appBuild) {
      if (!prevAppBuild) {
        // new app install
        this.capture('Application Installed', {
          version: appVersion,
          build: appBuild,
        })
      } else if (prevAppBuild !== appBuild) {
        // app updated
        this.capture('Application Updated', {
          previous_version: prevAppVersion,
          previous_build: prevAppBuild,
          version: appVersion,
          build: appBuild,
        })
      }
    }

    const initialUrl = (await Linking.getInitialURL()) ?? undefined

    this.capture('Application Opened', {
      version: appVersion,
      build: appBuild,
      from_background: false,
      url: initialUrl,
    })

    AppState.addEventListener('change', (state) => {
      if (state === 'active') {
        this.capture('Application Opened', {
          version: appVersion,
          build: appBuild,
          from_background: true,
        })
      } else if (state === 'background') {
        this.capture('Application Backgrounded')
      }
    })
  }

  private async persistAppVersion(): Promise<void> {
    const appBuild = this._appProperties.$app_build
    const appVersion = this._appProperties.$app_version
    this.setPersistedProperty(PostHogPersistedProperty.InstalledAppBuild, appBuild)
    this.setPersistedProperty(PostHogPersistedProperty.InstalledAppVersion, appVersion)
  }
}

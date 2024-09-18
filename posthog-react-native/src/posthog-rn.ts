import { AppState, Dimensions, Linking, Platform } from 'react-native'

import {
  JsonType,
  PostHogCaptureOptions,
  PostHogCore,
  PostHogCoreOptions,
  PostHogFetchOptions,
  PostHogFetchResponse,
  PostHogPersistedProperty,
} from '../../posthog-core/src'
import { getLegacyValues } from './legacy'
import { PostHogRNStorage, PostHogRNSyncMemoryStorage } from './storage'
import { version } from './version'
import { buildOptimisiticAsyncStorage, getAppProperties } from './native-deps'
import {
  PostHogAutocaptureOptions,
  PostHogCustomAppProperties,
  PostHogCustomStorage,
  PostHogSessionReplayConfig,
} from './types'
import { withReactNativeNavigation } from './frameworks/wix-navigation'
import { OptionalReactNativeSessionReplay } from './optional/OptionalSessionReplay'

export type PostHogOptions = PostHogCoreOptions & {
  /** Allows you to provide the storage type. By default 'file'.
   * 'file' will try to load the best available storage, the provided 'customStorage', 'customAsyncStorage' or in-memory storage.
   */
  persistence?: 'memory' | 'file'
  /** Allows you to provide your own implementation of the common information about your App or a function to modify the default App properties generated */
  customAppProperties?:
    | PostHogCustomAppProperties
    | ((properties: PostHogCustomAppProperties) => PostHogCustomAppProperties)
  /** Allows you to provide a custom asynchronous storage such as async-storage, expo-file-system or a synchronous storage such as mmkv.
   * If not provided, PostHog will attempt to use the best available storage via optional peer dependencies (async-storage, expo-file-system).
   * If `persistence` is set to 'memory', this option will be ignored.
   */
  customStorage?: PostHogCustomStorage

  /** Captures native app lifecycle events such as Application Installed, Application Updated, Application Opened, Application Became Active and Application Backgrounded.
   * By default is false.
   * If you're already using the 'captureLifecycleEvents' options with 'withReactNativeNavigation' or 'PostHogProvider, you should not set this to true, otherwise you may see duplicated events.
   */
  captureNativeAppLifecycleEvents?: boolean

  /**
   * Enable Recording of Session Replays for Android and iOS
   * Requires Record user sessions to be enabled in the PostHog Project Settings
   * Experimental support
   * Defaults to false
   */
  sessionReplay?: boolean

  /**
   * Enable Recording of Session Replays for Android and iOS
   * Requires Record user sessions to be enabled in the PostHog Project Settings
   * Experimental support
   * Defaults to false
   */
  sessionReplayConfig?: PostHogSessionReplayConfig
}

export class PostHog extends PostHogCore {
  private _persistence: PostHogOptions['persistence']
  private _storage: PostHogRNStorage
  private _appProperties: PostHogCustomAppProperties = {}
  private _currentSessionId?: string | undefined

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
      void this.flush()
    })

    let storagePromise: Promise<void> | undefined

    if (this._persistence === 'file') {
      this._storage = new PostHogRNStorage(options?.customStorage ?? buildOptimisiticAsyncStorage())
      storagePromise = this._storage.preloadPromise
    } else {
      this._storage = new PostHogRNSyncMemoryStorage()
    }

    if (storagePromise) {
      storagePromise.then(() => {
        // This code is for migrating from V1 to V2 and tries its best to keep the existing anon/distinctIds
        // It only applies for async storage
        if (!this._storage.getItem(PostHogPersistedProperty.AnonymousId)) {
          void getLegacyValues().then((legacyValues) => {
            if (legacyValues?.distinctId) {
              this._storage?.setItem(PostHogPersistedProperty.DistinctId, legacyValues.distinctId)
              this._storage?.setItem(PostHogPersistedProperty.AnonymousId, legacyValues.anonymousId)
            }
          })
        }
      })
    }

    const initAfterStorage = (): void => {
      this.setupBootstrap(options)

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
          void this.captureNativeAppLifecycleEvents()
        }
      }

      void this.persistAppVersion()

      void this.startSessionReplay(options)
    }

    // For async storage, we wait for the storage to be ready before we start the SDK
    // For sync storage we can start the SDK immediately
    if (storagePromise) {
      this._initPromise = storagePromise.then(initAfterStorage)
    } else {
      this._initPromise = Promise.resolve()
      initAfterStorage()
    }
  }

  // NOTE: This is purely a helper method for testing purposes or those who wish to be certain the SDK is fully initialised
  public async ready(): Promise<void> {
    await this._initPromise
  }

  getPersistedProperty<T>(key: PostHogPersistedProperty): T | undefined {
    return this._storage.getItem(key) as T | undefined
  }

  setPersistedProperty<T>(key: PostHogPersistedProperty, value: T | null): void {
    return value !== null ? this._storage.setItem(key, value) : this._storage.removeItem(key)
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
  getCustomUserAgent(): string {
    if (Platform.OS === 'web') {
      return ''
    }
    return `${this.getLibraryId()}/${this.getLibraryVersion()}`
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

  getSessionId(): string {
    const sessionId = super.getSessionId()

    // only rotate if there is a new sessionId and it is different from the current one
    if (sessionId.length > 0 && this._currentSessionId && sessionId !== this._currentSessionId) {
      if (OptionalReactNativeSessionReplay) {
        try {
          OptionalReactNativeSessionReplay.endSession()
          OptionalReactNativeSessionReplay.startSession(sessionId)
          console.info('PostHog Debug', `Session replay started with sessionId ${sessionId}.`)
        } catch (e) {
          console.error('PostHog Debug', `Session replay failed to start with sessionId: ${e}.`)
        }
      }
      this._currentSessionId = sessionId
    }

    return sessionId
  }

  initReactNativeNavigation(options: PostHogAutocaptureOptions): boolean {
    return withReactNativeNavigation(this, options)
  }

  private async startSessionReplay(options?: PostHogOptions): Promise<void> {
    if (!options?.sessionReplay) {
      console.info('PostHog Debug', 'Session replay is not enabled.')
      return
    }

    const sdkReplayConfig = options?.sessionReplayConfig ?? {
      maskAllTextInputs: true,
      maskAllImages: true,
      captureLog: true,
      captureNetworkTelemetry: true,
      iOSdebouncerDelayMs: 1000,
      androidDebouncerDelayMs: 500,
    }

    console.log('PostHog Debug', `Session replay sdk config: ${JSON.stringify(sdkReplayConfig)}`)

    // if Decide has not returned yet, we will start session replay with default config.
    const sessionReplay = this.getPersistedProperty(PostHogPersistedProperty.SessionReplay) ?? {}

    // sessionReplay is always an object, if its a boolean, its false if disabled
    if (sessionReplay) {
      const decideReplayConfig = (sessionReplay as { [key: string]: JsonType }) ?? {}
      console.log('PostHog Debug', `Session replay decide cached config: ${JSON.stringify(decideReplayConfig)}`)

      if (OptionalReactNativeSessionReplay) {
        const sessionId = this.getSessionId()

        if (sessionId.length === 0) {
          console.warn('PostHog Debug', 'Session replay enabled but no sessionId found.')
          return
        }

        const sdkOptions = {
          apiKey: this.apiKey,
          host: this.host ?? 'https://us.i.posthog.com',
          debug: this.isDebug,
        }

        console.log('PostHog Debug', `Session replay sdk options: ${JSON.stringify(sdkOptions)}`)

        try {
          if (!(await OptionalReactNativeSessionReplay.isEnabled())) {
            await OptionalReactNativeSessionReplay.start(sessionId, sdkOptions, sdkReplayConfig, decideReplayConfig)
            console.info('PostHog Debug', `Session replay started with sessionId ${sessionId}.`)
          } else {
            console.log('PostHog Debug', `Session replay already started.`)
          }
        } catch (e) {
          console.error('PostHog Debug', `Session replay failed to start: ${e}.`)
        }
      } else {
        console.warn('PostHog Debug', 'Session replay enabled but not installed.')
      }
    } else {
      console.info('PostHog Debug', 'Session replay disabled.')
    }
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
        // version and build are deprecated, but we keep them for compatibility
        // use $app_version and $app_build instead
        this.capture('Application Installed', {
          version: appVersion,
          build: appBuild,
        })
      } else if (prevAppBuild !== appBuild) {
        // app updated
        // version and build are deprecated, but we keep them for compatibility
        // use $app_version and $app_build instead
        this.capture('Application Updated', {
          previous_version: prevAppVersion,
          previous_build: prevAppBuild,
          version: appVersion,
          build: appBuild,
        })
      }
    }

    const initialUrl = (await Linking.getInitialURL()) ?? undefined

    // version and build are deprecated, but we keep them for compatibility
    // use $app_version and $app_build instead
    this.capture('Application Opened', {
      version: appVersion,
      build: appBuild,
      url: initialUrl,
    })

    AppState.addEventListener('change', (state) => {
      if (state === 'active') {
        // version and build are deprecated, but we keep them for compatibility
        // use $app_version and $app_build instead
        this.capture('Application Became Active', {
          version: appVersion,
          build: appBuild,
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

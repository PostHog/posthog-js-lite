export type PostHogAutocaptureNavigationTrackerOptions = {
  routeToName?: (name: string, params: any) => string
  routeToProperties?: (name: string, params: any) => Record<string, any>
}

export type PostHogAutocaptureOptions = {
  // Touches
  captureTouches?: boolean
  customLabelProp?: string
  noCaptureProp?: string
  maxElementsCaptured?: number
  ignoreLabels?: string[]
  propsToCapture?: string[]

  // Navigation
  captureScreens?: boolean
  navigation?: PostHogAutocaptureNavigationTrackerOptions

  /** Captures app lifecycle events such as Application Installed, Application Updated, Application Opened, Application Became Active and Application Backgrounded.
   * By default is true.
   * If you're already using the 'captureNativeAppLifecycleEvents' client option, you don't need to set this.
   * If 'captureNativeAppLifecycleEvents' is set, the 'captureNativeAppLifecycleEvents' value has priority over this option.
   * Application Installed and Application Updated events are not supported with persistence set to 'memory'.
   */
  captureLifecycleEvents?: boolean
}

export interface PostHogCustomAppProperties {
  /** Build number like "1.2.2" or "122" */
  $app_build?: string | null
  /** Name of the app as displayed below the icon like "PostHog" */
  $app_name?: string | null
  /** Namespace of the app usually like "com.posthog.app" */
  $app_namespace?: string | null
  /** Human friendly app version like what a user would see in the app store like "1.2.2" */
  $app_version?: string | null
  /** Manufacturer like "Apple", "Samsung" or "Android" */
  $device_manufacturer?: string | null
  /** Readable model name like "iPhone 12" or "Samsung Galaxy S24" */
  $device_name?: string | null
  /** Model identifier like "iPhone13,2" or "SM-S921B" */
  $device_model?: string | null
  /** Device type ("Mobile" | "Desktop" | "Web") */
  $device_type?: string | null
  /** Operating system name like iOS or Android */
  $os_name?: string | null
  /** Operating system version "14.0" */
  $os_version?: string | null
  /** Locale (language) of the device like "en-US" */
  $locale?: string | null
  /** Timezone of the device like "Europe/Berlin" */
  $timezone?: string | null
}

export type PostHogSessionReplayConfig = {
  /**
   * Enable masking of all text and text input fields
   * Default: true
   */
  maskAllTextInputs?: boolean
  /**
   * Enable masking of all images to a placeholder
   * Default: true
   */
  maskAllImages?: boolean
  /**
   * Enable masking of all sandboxed system views
   * These may include UIImagePickerController, PHPickerViewController and CNContactPickerViewController
   * iOS only
   * Experimental support
   * Default: true
   */
  maskAllSandboxedViews?: boolean
  /**
   * Enable masking of images that likely originated from user's photo library
   * Experimental support (UIKit only)
   * iOS only
   * Default: false
   *
   * @deprecated This property has no effect and will be removed in the next major release. To learn how to manually mask user photos please see our Privacy controls documentation: https://posthog.com/docs/session-replay/privacy?tab=React+Native
   */
  maskPhotoLibraryImages?: boolean
  /**
   * Enable capturing of logcat as console events
   * Android only
   * Default: true
   */
  captureLog?: boolean
  /**
   * Deboucer delay used to reduce the number of snapshots captured and reduce performance impact
   * This is used for capturing the view as a screenshot
   * The lower the number more snapshots will be captured but higher the performance impact
   * Defaults to 1s on iOS
   */
  iOSdebouncerDelayMs?: number
  /**
   * Deboucer delay used to reduce the number of snapshots captured and reduce performance impact
   * This is used for capturing the view as a screenshot
   * The lower the number more snapshots will be captured but higher the performance impact
   * Defaults to 1000ms (1s)
   * Ps: it was 500ms (0.5s) by default until version 3.3.7
   */
  androidDebouncerDelayMs?: number
  /**
   * Enable capturing network telemetry
   * iOS only
   * Default: true
   */
  captureNetworkTelemetry?: boolean
}

export interface PostHogCustomStorage {
  getItem: (key: string) => string | null | Promise<string | null>
  setItem: (key: string, value: string) => void | Promise<void>
}

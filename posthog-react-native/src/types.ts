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

  // LifecycleEvents
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

export abstract class PostHogCustomAsyncStorage {
  abstract getItem: (key: string) => Promise<string | null>
  abstract setItem: (key: string, value: string) => Promise<void>
  abstract isSemiAsync(): boolean
}

export abstract class PostHogCustomSyncStorage {
  abstract getItem: (key: string) => string | null
  abstract setItem: (key: string, value: string) => void
  abstract isSemiAsync(): boolean
}

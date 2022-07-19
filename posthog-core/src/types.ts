export interface PosthogClient {
  fetch(url: string, options: PostHogFetchOptions): Promise<PostHogFetchResponse>
  getLibraryId(): string
  getLibraryVersion(): string
  getCustomUserAgent(): string | void

  // This is our abstracted storage. Each implementation should handle its own
  getPersistedProperty<T>(key: PostHogPersistedProperty): T | undefined
  setPersistedProperty<T>(key: PostHogPersistedProperty, value: T | null): void

  enabled: boolean
  enable(): void
  disable(): void
  on(event: string, cb: (e: any) => void): () => void
  reset(): void
  getDistinctId(): string
  register(properties: { [key: string]: any }): void

  identify(distinctId?: string, properties?: PostHogEventProperties): this
  capture(event: string, properties?: { [key: string]: any }): this
  alias(alias: string): this
  autocapture(eventType: string, elements: PostHogAutocaptureElement[], properties?: PostHogEventProperties): this
  groups(groups: { [type: string]: string }): this
  group(groupType: string, groupKey: string, groupProperties?: PostHogEventProperties): this
  groupIdentify(groupType: string, groupKey: string, groupProperties?: PostHogEventProperties): this

  /***
   *** FEATURE FLAGS
   ***/

  getFeatureFlag(key: string, defaultResult?: string | boolean): boolean | string | undefined
  getFeatureFlags(): PostHogDecideResponse['featureFlags'] | undefined

  isFeatureEnabled(key: string, defaultResult?: boolean): boolean

  reloadFeatureFlagsAsync(): Promise<PostHogDecideResponse['featureFlags']>

  onFeatureFlags(cb: (flags: PostHogDecideResponse['featureFlags']) => void): () => void
  overrideFeatureFlag(flags: PostHogDecideResponse['featureFlags'] | null): void

  enqueue(type: string, _message: any): void

  flushAsync(): Promise<any>

  flush(callback?: (err?: any, data?: any) => void): void

  shutdownAsync(): Promise<void>
  shutdown(): void
}

export type PosthogCoreOptions = {
  host?: string
  timeout?: number
  flushAt?: number
  flushInterval?: number
  personalApiKey?: string
  enable?: boolean
  captureMode?: 'json' | 'form'
  sendFeatureFlagEvent?: boolean
  preloadFeatureFlags?: boolean
  decidePollInterval?: number
}

export type PostHogStorage = {
  getItem: (key: string) => string | null | undefined
  setItem: (key: string, value: string) => void
  removeItem: (key: string) => void
  clear: () => void
  getAllKeys: () => readonly string[]
}

export enum PostHogPersistedProperty {
  DistinctId = 'distinct_id',
  Props = 'props',
  FeatureFlags = 'feature_flags',
  OverrideFeatureFlags = 'override_feature_flags',
  Queue = 'queue',
}

export type PostHogFetchOptions = {
  method: 'GET' | 'POST' | 'PUT' | 'PATCH'
  mode?: 'no-cors'
  credentials?: 'omit'
  headers: { [key: string]: string }
  body: string
}

export type PostHogFetchResponse = {
  status: number
  text: () => Promise<string>
}

export type PostHogQueueItem = {
  message: any
  callback?: (err: any) => void
}

export type PostHogEventProperties = {
  [key: string]: any
}

export type PostHogAutocaptureElement = {
  text?: string
  tag_name: string
  attr_class: string[]
  href?: string
  attr_id?: string
  nth_child: number
  nth_of_type: number
  attributes: {
    [key: string]: any
  }
  order: number
}

export type PostHogDecideResponse = {
  config: { enable_collect_everything: boolean }
  editorParams: { toolbarVersion: string; jsURL: string }
  isAuthenticated: true
  supportedCompression: string[]
  featureFlags: {
    [key: string]: string | boolean
  }
  sessionRecording: boolean
}

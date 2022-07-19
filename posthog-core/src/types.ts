

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


export enum PostHogPersistedProperty {
  DistinctId = 'distinct_id',
  Props = 'props',
  FeatureFlags = 'feature_flags',
  OverrideFeatureFlags = 'override_feature_flags',
  Queue = 'queue',
  OptedOut = 'opted_out',
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

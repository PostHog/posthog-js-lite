export type PosthogCoreOptions = {
  // PostHog API host (https://app.posthog.com by default)
  host?: string
  // The number of events to queue before sending to Posthog (flushing)
  flushAt?: number
  // The interval in milliseconds between periodic flushes
  flushInterval?: number
  // If set to false, tracking will be disabled until `optIn` is called
  enable?: boolean
  // Whether to track that `getFeatureFlag` was called (used by Expriements)
  sendFeatureFlagEvent?: boolean
  // Whether to load feature flags when initialised or not
  preloadFeatureFlags?: boolean
  // The interval in milliseconds between decide polls (refreshing feature flags)
  decidePollInterval?: number
  // How many times we will retry HTTP requests
  fetchRetryCount?: number
  // The delay between HTTP request retries
  fetchRetryDelay?: number
  // For Session Analysis how long before we expire a session (defaults to 30 mins)
  sessionExpirationTimeSeconds?: number
  // Whether to post events to PostHog in JSON or compressed format
  captureMode?: 'json' | 'form'
}

export enum PostHogPersistedProperty {
  DistinctId = 'distinct_id',
  Props = 'props',
  FeatureFlags = 'feature_flags',
  OverrideFeatureFlags = 'override_feature_flags',
  Queue = 'queue',
  OptedOut = 'opted_out',
  SessionId = 'session_id',
  SessionLastTimestamp = 'session_timestamp',
}

export type PostHogFetchOptions = {
  method?: 'GET' | 'POST' | 'PUT' | 'PATCH'
  mode?: 'no-cors'
  credentials?: 'omit'
  headers?: { [key: string]: string }
  body?: string
}

export type PostHogFetchResponse = {
  status: number
  text: () => Promise<string>
  json: () => Promise<any>
}

export type PostHogQueueItem = {
  message: any
  callback?: (err: any) => void
}

export type PostHogEventProperties = {
  [key: string]: any
}

export type PostHogAutocaptureElement = {
  $el_text?: string
  tag_name: string
  href?: string
  nth_child?: number
  nth_of_type?: number
  order?: number
} & {
  [key: string]: any
} // Any key prefixed with `attr__` can be added

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

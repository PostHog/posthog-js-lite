import { Survey } from './surveys-types'

export type PostHogCoreOptions = {
  /** PostHog API host, usually 'https://us.i.posthog.com' or 'https://eu.i.posthog.com' */
  host?: string
  /** The number of events to queue before sending to PostHog (flushing) */
  flushAt?: number
  /** The interval in milliseconds between periodic flushes */
  flushInterval?: number
  /** The maximum number of queued messages to be flushed as part of a single batch (must be higher than `flushAt`) */
  maxBatchSize?: number
  /** The maximum number of cached messages either in memory or on the local storage.
   * Defaults to 1000, (must be higher than `flushAt`)
   */
  maxQueueSize?: number
  /** If set to true the SDK is essentially disabled (useful for local environments where you don't want to track anything) */
  disabled?: boolean
  /** If set to false the SDK will not track until the `optIn` function is called. */
  defaultOptIn?: boolean
  /** Whether to track that `getFeatureFlag` was called (used by Experiments) */
  sendFeatureFlagEvent?: boolean
  /** Whether to load feature flags when initialized or not */
  preloadFeatureFlags?: boolean
  /** Whether to load remote config when initialized or not */
  disableRemoteConfig?: boolean
  /** Option to bootstrap the library with given distinctId and feature flags */
  bootstrap?: {
    distinctId?: string
    isIdentifiedId?: boolean
    featureFlags?: Record<string, boolean | string>
    featureFlagPayloads?: Record<string, JsonType>
  }
  /** How many times we will retry HTTP requests. Defaults to 3. */
  fetchRetryCount?: number
  /** The delay between HTTP request retries, Defaults to 3 seconds. */
  fetchRetryDelay?: number
  /** Timeout in milliseconds for any calls. Defaults to 10 seconds. */
  requestTimeout?: number
  /** Timeout in milliseconds for feature flag calls. Defaults to 10 seconds for stateful clients, and 3 seconds for stateless. */
  featureFlagsRequestTimeoutMs?: number
  /** Timeout in milliseconds for remote config calls. Defaults to 3 seconds. */
  remoteConfigRequestTimeoutMs?: number
  /** For Session Analysis how long before we expire a session (defaults to 30 mins) */
  sessionExpirationTimeSeconds?: number
  /** Whether to post events to PostHog in JSON or compressed format. Defaults to 'json' */
  captureMode?: 'json' | 'form'
  disableGeoip?: boolean
  /** Special flag to indicate ingested data is for a historical migration. */
  historicalMigration?: boolean
}

export enum PostHogPersistedProperty {
  AnonymousId = 'anonymous_id',
  DistinctId = 'distinct_id',
  Props = 'props',
  FeatureFlags = 'feature_flags',
  FeatureFlagPayloads = 'feature_flag_payloads',
  BootstrapFeatureFlags = 'bootstrap_feature_flags',
  BootstrapFeatureFlagPayloads = 'bootstrap_feature_flag_payloads',
  OverrideFeatureFlags = 'override_feature_flags',
  Queue = 'queue',
  OptedOut = 'opted_out',
  SessionId = 'session_id',
  SessionLastTimestamp = 'session_timestamp',
  PersonProperties = 'person_properties',
  GroupProperties = 'group_properties',
  InstalledAppBuild = 'installed_app_build', // only used by posthog-react-native
  InstalledAppVersion = 'installed_app_version', // only used by posthog-react-native
  SessionReplay = 'session_replay', // only used by posthog-react-native
  DecideEndpointWasHit = 'decide_endpoint_was_hit', // only used by posthog-react-native
  SurveyLastSeenDate = 'survey_last_seen_date', // only used by posthog-react-native
  SurveysSeen = 'surveys_seen', // only used by posthog-react-native
  Surveys = 'surveys', // only used by posthog-react-native
  RemoteConfig = 'remote_config',
}

export type PostHogFetchOptions = {
  method: 'GET' | 'POST' | 'PUT' | 'PATCH'
  mode?: 'no-cors'
  credentials?: 'omit'
  headers: { [key: string]: string }
  body?: string
  signal?: AbortSignal
}

// Check out posthog-js for these additional options and try to keep them in sync
export type PostHogCaptureOptions = {
  /** If provided overrides the auto-generated event ID */
  uuid?: string
  /** If provided overrides the auto-generated timestamp */
  timestamp?: Date
  disableGeoip?: boolean
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

export interface PostHogRemoteConfig {
  sessionRecording?:
    | boolean
    | {
        [key: string]: JsonType
      }

  /**
   * Whether surveys are enabled
   */
  surveys?: boolean | Survey[]

  /**
   * Indicates if the team has any flags enabled (if not we don't need to load them)
   */
  hasFeatureFlags?: boolean
}

export interface PostHogDecideResponse extends Omit<PostHogRemoteConfig, 'surveys'> {
  featureFlags: {
    [key: string]: string | boolean
  }
  featureFlagPayloads: {
    [key: string]: JsonType
  }
  errorsWhileComputingFlags: boolean
}

export type PostHogFlagsAndPayloadsResponse = {
  featureFlags: PostHogDecideResponse['featureFlags']
  featureFlagPayloads: PostHogDecideResponse['featureFlagPayloads']
}

export type JsonType = string | number | boolean | null | { [key: string]: JsonType } | Array<JsonType>

export type FetchLike = (url: string, options: PostHogFetchOptions) => Promise<PostHogFetchResponse>

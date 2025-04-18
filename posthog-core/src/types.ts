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
  /**
   * Whether to load remote config when initialized or not
   * Experimental support
   * Default: false - Remote config is loaded by default
   */
  disableRemoteConfig?: boolean
  /**
   * Whether to load surveys when initialized or not
   * Experimental support
   * Default: false - Surveys are loaded by default, but requires the `PostHogSurveyProvider` to be used
   */
  disableSurveys?: boolean
  /** Option to bootstrap the library with given distinctId and feature flags */
  bootstrap?: {
    distinctId?: string
    isIdentifiedId?: boolean
    featureFlags?: Record<string, FeatureFlagValue>
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

export type PostHogBackendOptions = PostHogCoreOptions & {
  persistence?: 'memory'
  personalApiKey?: string
  privacyMode?: boolean
  enableExceptionAutocapture?: boolean
  // The interval in milliseconds between polls for refreshing feature flag definitions. Defaults to 30 seconds.
  featureFlagsPollingInterval?: number
  // Maximum size of cache that deduplicates $feature_flag_called calls per user.
  maxCacheSize?: number
  fetch?: (url: string, options: PostHogFetchOptions) => Promise<PostHogFetchResponse>
}

export enum PostHogPersistedProperty {
  AnonymousId = 'anonymous_id',
  DistinctId = 'distinct_id',
  Props = 'props',
  FeatureFlagDetails = 'feature_flag_details',
  FeatureFlags = 'feature_flags',
  FeatureFlagPayloads = 'feature_flag_payloads',
  BootstrapFeatureFlagDetails = 'bootstrap_feature_flag_details',
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

export type PostHogRemoteConfig = {
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

export type FeatureFlagValue = string | boolean

export type PostHogDecideResponse = Omit<PostHogRemoteConfig, 'surveys' | 'hasFeatureFlags'> & {
  featureFlags: {
    [key: string]: FeatureFlagValue
  }
  featureFlagPayloads: {
    [key: string]: JsonType
  }
  flags: {
    [key: string]: FeatureFlagDetail
  }
  errorsWhileComputingFlags: boolean
  sessionRecording?:
    | boolean
    | {
        [key: string]: JsonType
      }
  quotaLimited?: string[]
  requestId?: string
}

export type PostHogFeatureFlagsResponse = PartialWithRequired<
  PostHogDecideResponse,
  'flags' | 'featureFlags' | 'featureFlagPayloads' | 'requestId'
>

/**
 * Creates a type with all properties of T, but makes only K properties required while the rest remain optional.
 *
 * @template T - The base type containing all properties
 * @template K - Union type of keys from T that should be required
 *
 * @example
 * interface User {
 *   id: number;
 *   name: string;
 *   email?: string;
 *   age?: number;
 * }
 *
 * // Makes 'id' and 'name' required, but 'email' and 'age' optional
 * type RequiredUser = PartialWithRequired<User, 'id' | 'name'>;
 *
 * const user: RequiredUser = {
 *   id: 1,      // Must be provided
 *   name: "John" // Must be provided
 *   // email and age are optional
 * };
 */
export type PartialWithRequired<T, K extends keyof T> = {
  [P in K]: T[P] // Required fields
} & {
  [P in Exclude<keyof T, K>]?: T[P] // Optional fields
}

/**
 * These are the fields we care about from PostHogDecideResponse for feature flags.
 */
export type PostHogFeatureFlagDetails = PartialWithRequired<
  PostHogDecideResponse,
  'flags' | 'featureFlags' | 'featureFlagPayloads' | 'requestId'
>

/**
 * Models the response from the v3 `/decide` endpoint.
 */
export type PostHogV3DecideResponse = Omit<PostHogDecideResponse, 'flags'>
export type PostHogV4DecideResponse = Omit<PostHogDecideResponse, 'featureFlags' | 'featureFlagPayloads'>

/**
 * The format of the flags object in persisted storage
 *
 * When we pull flags from persistence, we can normalize them to PostHogFeatureFlagDetails
 * so that we can support v3 and v4 of the API.
 */
export type PostHogFlagsStorageFormat = Pick<PostHogFeatureFlagDetails, 'flags'>

/**
 * Models legacy flags and payloads return type for many public methods.
 */
export type PostHogFlagsAndPayloadsResponse = Partial<
  Pick<PostHogDecideResponse, 'featureFlags' | 'featureFlagPayloads'>
>

export type JsonType = string | number | boolean | null | { [key: string]: JsonType } | Array<JsonType>

export type FetchLike = (url: string, options: PostHogFetchOptions) => Promise<PostHogFetchResponse>

export type FeatureFlagDetail = {
  key: string
  enabled: boolean
  variant: string | undefined
  reason: EvaluationReason | undefined
  metadata: FeatureFlagMetadata | undefined
}

export type FeatureFlagMetadata = {
  id: number | undefined
  version: number | undefined
  description: string | undefined
  // Payloads in the response are always JSON encoded as a string
  payload: string | undefined
}

export type EvaluationReason = {
  code: string | undefined
  condition_index: number | undefined
  description: string | undefined
}

// survey types
export type SurveyAppearance = {
  // keep in sync with frontend/src/types.ts -> SurveyAppearance
  backgroundColor?: string
  submitButtonColor?: string
  // deprecate submit button text eventually
  submitButtonText?: string
  submitButtonTextColor?: string
  ratingButtonColor?: string
  ratingButtonActiveColor?: string
  autoDisappear?: boolean
  displayThankYouMessage?: boolean
  thankYouMessageHeader?: string
  thankYouMessageDescription?: string
  thankYouMessageDescriptionContentType?: SurveyQuestionDescriptionContentType
  thankYouMessageCloseButtonText?: string
  borderColor?: string
  position?: SurveyPosition
  placeholder?: string
  shuffleQuestions?: boolean
  surveyPopupDelaySeconds?: number
  // widget options
  widgetType?: SurveyWidgetType
  widgetSelector?: string
  widgetLabel?: string
  widgetColor?: string
}

export enum SurveyPosition {
  Left = 'left',
  Right = 'right',
  Center = 'center',
}

export enum SurveyWidgetType {
  Button = 'button',
  Tab = 'tab',
  Selector = 'selector',
}

export enum SurveyType {
  Popover = 'popover',
  API = 'api',
  Widget = 'widget',
}

export type SurveyQuestion = BasicSurveyQuestion | LinkSurveyQuestion | RatingSurveyQuestion | MultipleSurveyQuestion

export enum SurveyQuestionDescriptionContentType {
  Html = 'html',
  Text = 'text',
}

type SurveyQuestionBase = {
  question: string
  id?: string // TODO: use this for the question id
  description?: string
  descriptionContentType?: SurveyQuestionDescriptionContentType
  optional?: boolean
  buttonText?: string
  originalQuestionIndex: number
  branching?: NextQuestionBranching | EndBranching | ResponseBasedBranching | SpecificQuestionBranching
}

export type BasicSurveyQuestion = SurveyQuestionBase & {
  type: SurveyQuestionType.Open
}

export type LinkSurveyQuestion = SurveyQuestionBase & {
  type: SurveyQuestionType.Link
  link?: string
}

export type RatingSurveyQuestion = SurveyQuestionBase & {
  type: SurveyQuestionType.Rating
  display: SurveyRatingDisplay
  scale: 3 | 5 | 7 | 10
  lowerBoundLabel: string
  upperBoundLabel: string
}

export enum SurveyRatingDisplay {
  Number = 'number',
  Emoji = 'emoji',
}

export type MultipleSurveyQuestion = SurveyQuestionBase & {
  type: SurveyQuestionType.SingleChoice | SurveyQuestionType.MultipleChoice
  choices: string[]
  hasOpenChoice?: boolean
  shuffleOptions?: boolean
}

export enum SurveyQuestionType {
  Open = 'open',
  MultipleChoice = 'multiple_choice',
  SingleChoice = 'single_choice',
  Rating = 'rating',
  Link = 'link',
}

export enum SurveyQuestionBranchingType {
  NextQuestion = 'next_question',
  End = 'end',
  ResponseBased = 'response_based',
  SpecificQuestion = 'specific_question',
}

export type NextQuestionBranching = {
  type: SurveyQuestionBranchingType.NextQuestion
}

export type EndBranching = {
  type: SurveyQuestionBranchingType.End
}

export type ResponseBasedBranching = {
  type: SurveyQuestionBranchingType.ResponseBased
  responseValues: Record<string, any>
}

export type SpecificQuestionBranching = {
  type: SurveyQuestionBranchingType.SpecificQuestion
  index: number
}

export type SurveyResponse = {
  surveys: Survey[]
}

export type SurveyCallback = (surveys: Survey[]) => void

export enum SurveyMatchType {
  Regex = 'regex',
  NotRegex = 'not_regex',
  Exact = 'exact',
  IsNot = 'is_not',
  Icontains = 'icontains',
  NotIcontains = 'not_icontains',
}

export type SurveyElement = {
  text?: string
  $el_text?: string
  tag_name?: string
  href?: string
  attr_id?: string
  attr_class?: string[]
  nth_child?: number
  nth_of_type?: number
  attributes?: Record<string, any>
  event_id?: number
  order?: number
  group_id?: number
}
export type SurveyRenderReason = {
  visible: boolean
  disabledReason?: string
}

export type Survey = {
  // Sync this with the backend's SurveyAPISerializer!
  id: string
  name: string
  description?: string
  type: SurveyType
  feature_flag_keys?:
    | {
        key: string
        value?: string
      }[]
  linked_flag_key?: string
  targeting_flag_key?: string
  internal_targeting_flag_key?: string
  questions: SurveyQuestion[]
  appearance?: SurveyAppearance
  conditions?: {
    url?: string
    selector?: string
    seenSurveyWaitPeriodInDays?: number
    urlMatchType?: SurveyMatchType
    events?: {
      repeatedActivation?: boolean
      values?: {
        name: string
      }[]
    }
    actions?: {
      values: SurveyActionType[]
    }
    deviceTypes?: string[]
    deviceTypesMatchType?: SurveyMatchType
  }
  start_date?: string
  end_date?: string
  current_iteration?: number
  current_iteration_start_date?: string
}

export type SurveyActionType = {
  id: number
  name?: string
  steps?: ActionStepType[]
}

/** Sync with plugin-server/src/types.ts */
export enum ActionStepStringMatching {
  Contains = 'contains',
  Exact = 'exact',
  Regex = 'regex',
}

export type ActionStepType = {
  event?: string
  selector?: string
  /** @deprecated Only `selector` should be used now. */
  tag_name?: string
  text?: string
  /** @default StringMatching.Exact */
  text_matching?: ActionStepStringMatching
  href?: string
  /** @default ActionStepStringMatching.Exact */
  href_matching?: ActionStepStringMatching
  url?: string
  /** @default StringMatching.Contains */
  url_matching?: ActionStepStringMatching
}

export interface IdentifyMessage {
  distinctId: string
  properties?: Record<string | number, any>
  disableGeoip?: boolean
}

export interface EventMessage extends IdentifyMessage {
  event: string
  groups?: Record<string, string | number> // Mapping of group type to group id
  sendFeatureFlags?: boolean
  timestamp?: Date
  uuid?: string
}

export interface GroupIdentifyMessage {
  groupType: string
  groupKey: string // Unique identifier for the group
  properties?: Record<string | number, any>
  distinctId?: string // optional distinctId to associate message with a person
  disableGeoip?: boolean
}

export * from './extensions/types'

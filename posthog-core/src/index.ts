import {
  PostHogFetchOptions,
  PostHogFetchResponse,
  PostHogQueueItem,
  PostHogAutocaptureElement,
  PostHogDecideResponse,
  PostHogCoreOptions,
  PostHogEventProperties,
  PostHogPersistedProperty,
  PostHogCaptureOptions,
  JsonType,
  PostHogRemoteConfig,
} from './types'
import {
  assert,
  currentISOTime,
  currentTimestamp,
  isError,
  removeTrailingSlash,
  retriable,
  RetriableOptions,
  safeSetTimeout,
} from './utils'
import { LZString } from './lz-string'
import { SimpleEventEmitter } from './eventemitter'
import { uuidv7 } from './vendor/uuidv7'

import { Survey, SurveyResponse } from './surveys-types'

export * as utils from './utils'

class PostHogFetchHttpError extends Error {
  name = 'PostHogFetchHttpError'

  constructor(public response: PostHogFetchResponse) {
    super('HTTP error while fetching PostHog: ' + response.status)
  }
}

class PostHogFetchNetworkError extends Error {
  name = 'PostHogFetchNetworkError'

  constructor(public error: unknown) {
    // TRICKY: "cause" is a newer property but is just ignored otherwise. Cast to any to ignore the type issue.
    // eslint-disable-next-line @typescript-eslint/prefer-ts-expect-error
    // @ts-ignore
    super('Network error while fetching PostHog', error instanceof Error ? { cause: error } : {})
  }
}

function isPostHogFetchError(err: any): boolean {
  return typeof err === 'object' && (err instanceof PostHogFetchHttpError || err instanceof PostHogFetchNetworkError)
}

enum QuotaLimitedFeature {
  FeatureFlags = 'feature_flags',
  Recordings = 'recordings',
}

export abstract class PostHogCoreStateless {
  // options
  readonly apiKey: string
  readonly host: string
  readonly flushAt: number
  readonly preloadFeatureFlags: boolean
  readonly disableSurveys: boolean
  private maxBatchSize: number
  private maxQueueSize: number
  private flushInterval: number
  private flushPromise: Promise<any> | null = null
  private requestTimeout: number
  private featureFlagsRequestTimeoutMs: number
  private remoteConfigRequestTimeoutMs: number
  private captureMode: 'form' | 'json'
  private removeDebugCallback?: () => void
  private disableGeoip: boolean
  private historicalMigration: boolean
  protected disabled

  private defaultOptIn: boolean
  private pendingPromises: Record<string, Promise<any>> = {}

  // internal
  protected _events = new SimpleEventEmitter()
  protected _flushTimer?: any
  protected _retryOptions: RetriableOptions
  protected _initPromise: Promise<void>
  protected _isInitialized: boolean = false
  protected _remoteConfigResponsePromise?: Promise<PostHogRemoteConfig | undefined>

  // Abstract methods to be overridden by implementations
  abstract fetch(url: string, options: PostHogFetchOptions): Promise<PostHogFetchResponse>
  abstract getLibraryId(): string
  abstract getLibraryVersion(): string
  abstract getCustomUserAgent(): string | void

  // This is our abstracted storage. Each implementation should handle its own
  abstract getPersistedProperty<T>(key: PostHogPersistedProperty): T | undefined
  abstract setPersistedProperty<T>(key: PostHogPersistedProperty, value: T | null): void

  constructor(apiKey: string, options?: PostHogCoreOptions) {
    assert(apiKey, "You must pass your PostHog project's api key.")

    this.apiKey = apiKey
    this.host = removeTrailingSlash(options?.host || 'https://us.i.posthog.com')
    this.flushAt = options?.flushAt ? Math.max(options?.flushAt, 1) : 20
    this.maxBatchSize = Math.max(this.flushAt, options?.maxBatchSize ?? 100)
    this.maxQueueSize = Math.max(this.flushAt, options?.maxQueueSize ?? 1000)
    this.flushInterval = options?.flushInterval ?? 10000
    this.captureMode = options?.captureMode || 'json'
    this.preloadFeatureFlags = options?.preloadFeatureFlags ?? true
    // If enable is explicitly set to false we override the optout
    this.defaultOptIn = options?.defaultOptIn ?? true
    this.disableSurveys = options?.disableSurveys ?? false

    this._retryOptions = {
      retryCount: options?.fetchRetryCount ?? 3,
      retryDelay: options?.fetchRetryDelay ?? 3000, // 3 seconds
      retryCheck: isPostHogFetchError,
    }
    this.requestTimeout = options?.requestTimeout ?? 10000 // 10 seconds
    this.featureFlagsRequestTimeoutMs = options?.featureFlagsRequestTimeoutMs ?? 3000 // 3 seconds
    this.remoteConfigRequestTimeoutMs = options?.remoteConfigRequestTimeoutMs ?? 3000 // 3 seconds
    this.disableGeoip = options?.disableGeoip ?? true
    this.disabled = options?.disabled ?? false
    this.historicalMigration = options?.historicalMigration ?? false
    // Init promise allows the derived class to block calls until it is ready
    this._initPromise = Promise.resolve()
    this._isInitialized = true
  }

  protected logMsgIfDebug(fn: () => void): void {
    if (this.isDebug) {
      fn()
    }
  }

  protected wrap(fn: () => void): void {
    if (this.disabled) {
      this.logMsgIfDebug(() => console.warn('[PostHog] The client is disabled'))
      return
    }

    if (this._isInitialized) {
      // NOTE: We could also check for the "opt in" status here...
      return fn()
    }

    this._initPromise.then(() => fn())
  }

  protected getCommonEventProperties(): any {
    return {
      $lib: this.getLibraryId(),
      $lib_version: this.getLibraryVersion(),
    }
  }

  public get optedOut(): boolean {
    return this.getPersistedProperty(PostHogPersistedProperty.OptedOut) ?? !this.defaultOptIn
  }

  async optIn(): Promise<void> {
    this.wrap(() => {
      this.setPersistedProperty(PostHogPersistedProperty.OptedOut, false)
    })
  }

  async optOut(): Promise<void> {
    this.wrap(() => {
      this.setPersistedProperty(PostHogPersistedProperty.OptedOut, true)
    })
  }

  on(event: string, cb: (...args: any[]) => void): () => void {
    return this._events.on(event, cb)
  }

  debug(enabled: boolean = true): void {
    this.removeDebugCallback?.()

    if (enabled) {
      const removeDebugCallback = this.on('*', (event, payload) => console.log('PostHog Debug', event, payload))
      this.removeDebugCallback = () => {
        removeDebugCallback()
        this.removeDebugCallback = undefined
      }
    }
  }

  get isDebug(): boolean {
    return !!this.removeDebugCallback
  }

  get isDisabled(): boolean {
    return this.disabled
  }

  private buildPayload(payload: { distinct_id: string; event: string; properties?: PostHogEventProperties }): any {
    return {
      distinct_id: payload.distinct_id,
      event: payload.event,
      properties: {
        ...(payload.properties || {}),
        ...this.getCommonEventProperties(), // Common PH props
      },
    }
  }

  protected addPendingPromise<T>(promise: Promise<T>): Promise<T> {
    const promiseUUID = uuidv7()
    this.pendingPromises[promiseUUID] = promise
    promise
      .catch(() => {})
      .finally(() => {
        delete this.pendingPromises[promiseUUID]
      })

    return promise
  }

  /***
   *** TRACKING
   ***/
  protected identifyStateless(
    distinctId: string,
    properties?: PostHogEventProperties,
    options?: PostHogCaptureOptions
  ): void {
    this.wrap(() => {
      // The properties passed to identifyStateless are event properties.
      // To add person properties, pass in all person properties to the `$set` and `$set_once` keys.

      const payload = {
        ...this.buildPayload({
          distinct_id: distinctId,
          event: '$identify',
          properties,
        }),
      }

      this.enqueue('identify', payload, options)
    })
  }

  protected captureStateless(
    distinctId: string,
    event: string,
    properties?: { [key: string]: any },
    options?: PostHogCaptureOptions
  ): void {
    this.wrap(() => {
      const payload = this.buildPayload({ distinct_id: distinctId, event, properties })
      this.enqueue('capture', payload, options)
    })
  }

  protected aliasStateless(
    alias: string,
    distinctId: string,
    properties?: { [key: string]: any },
    options?: PostHogCaptureOptions
  ): void {
    this.wrap(() => {
      const payload = this.buildPayload({
        event: '$create_alias',
        distinct_id: distinctId,
        properties: {
          ...(properties || {}),
          distinct_id: distinctId,
          alias,
        },
      })

      this.enqueue('alias', payload, options)
    })
  }

  /***
   *** GROUPS
   ***/
  protected groupIdentifyStateless(
    groupType: string,
    groupKey: string | number,
    groupProperties?: PostHogEventProperties,
    options?: PostHogCaptureOptions,
    distinctId?: string,
    eventProperties?: PostHogEventProperties
  ): void {
    this.wrap(() => {
      const payload = this.buildPayload({
        distinct_id: distinctId || `$${groupType}_${groupKey}`,
        event: '$groupidentify',
        properties: {
          $group_type: groupType,
          $group_key: groupKey,
          $group_set: groupProperties || {},
          ...(eventProperties || {}),
        },
      })

      this.enqueue('capture', payload, options)
    })
  }

  protected async getRemoteConfig(): Promise<PostHogRemoteConfig | undefined> {
    await this._initPromise

    let host = this.host

    if (host === 'https://us.i.posthog.com') {
      host = 'https://us-assets.i.posthog.com'
    } else if (host === 'https://eu.i.posthog.com') {
      host = 'https://eu-assets.i.posthog.com'
    }

    const url = `${host}/array/${this.apiKey}/config`
    const fetchOptions: PostHogFetchOptions = {
      method: 'GET',
      headers: { ...this.getCustomHeaders(), 'Content-Type': 'application/json' },
    }
    // Don't retry remote config API calls
    return this.fetchWithRetry(url, fetchOptions, { retryCount: 0 }, this.remoteConfigRequestTimeoutMs)
      .then((response) => response.json() as Promise<PostHogRemoteConfig>)
      .catch((error) => {
        this.logMsgIfDebug(() => console.error('Remote config could not be loaded', error))
        this._events.emit('error', error)
        return undefined
      })
  }

  /***
   *** FEATURE FLAGS
   ***/

  protected async getDecide(
    distinctId: string,
    groups: Record<string, string | number> = {},
    personProperties: Record<string, string> = {},
    groupProperties: Record<string, Record<string, string>> = {},
    extraPayload: Record<string, any> = {}
  ): Promise<PostHogDecideResponse | undefined> {
    await this._initPromise

    const url = `${this.host}/decide/?v=3`
    const fetchOptions: PostHogFetchOptions = {
      method: 'POST',
      headers: { ...this.getCustomHeaders(), 'Content-Type': 'application/json' },
      body: JSON.stringify({
        token: this.apiKey,
        distinct_id: distinctId,
        groups,
        person_properties: personProperties,
        group_properties: groupProperties,
        ...extraPayload,
      }),
    }
    // Don't retry /decide API calls
    return this.fetchWithRetry(url, fetchOptions, { retryCount: 0 }, this.featureFlagsRequestTimeoutMs)
      .then((response) => response.json() as Promise<PostHogDecideResponse>)
      .catch((error) => {
        this._events.emit('error', error)
        return undefined
      })
  }

  protected async getFeatureFlagStateless(
    key: string,
    distinctId: string,
    groups: Record<string, string> = {},
    personProperties: Record<string, string> = {},
    groupProperties: Record<string, Record<string, string>> = {},
    disableGeoip?: boolean
  ): Promise<{
    response: boolean | string | undefined
    requestId: string | undefined
  }> {
    await this._initPromise

    const decideResponse = await this.getFeatureFlagsStateless(
      distinctId,
      groups,
      personProperties,
      groupProperties,
      disableGeoip,
      [key]
    )
    const featureFlags = decideResponse.flags

    if (!featureFlags) {
      // If we haven't loaded flags yet, or errored out, we respond with undefined
      return {
        response: undefined,
        requestId: undefined,
      }
    }

    let response = featureFlags[key]
    // `/decide` v3 returns all flags

    if (response === undefined) {
      // For cases where the flag is unknown, return false
      response = false
    }

    // If we have flags we either return the value (true or string) or false
    return {
      response,
      requestId: decideResponse.requestId,
    }
  }

  protected async getFeatureFlagPayloadStateless(
    key: string,
    distinctId: string,
    groups: Record<string, string> = {},
    personProperties: Record<string, string> = {},
    groupProperties: Record<string, Record<string, string>> = {},
    disableGeoip?: boolean
  ): Promise<JsonType | undefined> {
    await this._initPromise

    const payloads = await this.getFeatureFlagPayloadsStateless(
      distinctId,
      groups,
      personProperties,
      groupProperties,
      disableGeoip,
      [key]
    )

    if (!payloads) {
      return undefined
    }

    const response = payloads[key]

    // Undefined means a loading or missing data issue. Null means evaluation happened and there was no match
    if (response === undefined) {
      return null
    }

    return response
  }

  protected async getFeatureFlagPayloadsStateless(
    distinctId: string,
    groups: Record<string, string> = {},
    personProperties: Record<string, string> = {},
    groupProperties: Record<string, Record<string, string>> = {},
    disableGeoip?: boolean,
    flagKeysToEvaluate?: string[]
  ): Promise<PostHogDecideResponse['featureFlagPayloads'] | undefined> {
    await this._initPromise

    const payloads = (
      await this.getFeatureFlagsAndPayloadsStateless(
        distinctId,
        groups,
        personProperties,
        groupProperties,
        disableGeoip,
        flagKeysToEvaluate
      )
    ).payloads

    return payloads
  }

  protected _parsePayload(response: any): any {
    try {
      return JSON.parse(response)
    } catch {
      return response
    }
  }

  protected async getFeatureFlagsStateless(
    distinctId: string,
    groups: Record<string, string | number> = {},
    personProperties: Record<string, string> = {},
    groupProperties: Record<string, Record<string, string>> = {},
    disableGeoip?: boolean,
    flagKeysToEvaluate?: string[]
  ): Promise<{
    flags: PostHogDecideResponse['featureFlags'] | undefined
    payloads: PostHogDecideResponse['featureFlagPayloads'] | undefined
    requestId: PostHogDecideResponse['requestId'] | undefined
  }> {
    await this._initPromise

    return await this.getFeatureFlagsAndPayloadsStateless(
      distinctId,
      groups,
      personProperties,
      groupProperties,
      disableGeoip,
      flagKeysToEvaluate
    )
  }

  protected async getFeatureFlagsAndPayloadsStateless(
    distinctId: string,
    groups: Record<string, string | number> = {},
    personProperties: Record<string, string> = {},
    groupProperties: Record<string, Record<string, string>> = {},
    disableGeoip?: boolean,
    flagKeysToEvaluate?: string[]
  ): Promise<{
    flags: PostHogDecideResponse['featureFlags'] | undefined
    payloads: PostHogDecideResponse['featureFlagPayloads'] | undefined
    requestId: PostHogDecideResponse['requestId'] | undefined
  }> {
    await this._initPromise

    const extraPayload: Record<string, any> = {}
    if (disableGeoip ?? this.disableGeoip) {
      extraPayload['geoip_disable'] = true
    }
    if (flagKeysToEvaluate) {
      extraPayload['flag_keys_to_evaluate'] = flagKeysToEvaluate
    }
    const decideResponse = await this.getDecide(distinctId, groups, personProperties, groupProperties, extraPayload)

    // Add check for quota limitation on feature flags
    if (decideResponse?.quotaLimited?.includes(QuotaLimitedFeature.FeatureFlags)) {
      console.warn(
        '[FEATURE FLAGS] Feature flags quota limit exceeded - feature flags unavailable. Learn more about billing limits at https://posthog.com/docs/billing/limits-alerts'
      )
      return {
        flags: undefined,
        payloads: undefined,
        requestId: decideResponse?.requestId,
      }
    }

    const flags = decideResponse?.featureFlags
    const payloads = decideResponse?.featureFlagPayloads

    let parsedPayloads = payloads

    if (payloads) {
      parsedPayloads = Object.fromEntries(Object.entries(payloads).map(([k, v]) => [k, this._parsePayload(v)]))
    }

    return {
      flags,
      payloads: parsedPayloads,
      requestId: decideResponse?.requestId,
    }
  }

  /***
   *** SURVEYS
   ***/

  public async getSurveysStateless(): Promise<SurveyResponse['surveys']> {
    await this._initPromise

    if (this.disableSurveys === true) {
      this.logMsgIfDebug(() => console.log('Loading surveys is disabled.'))
      return []
    }

    const url = `${this.host}/api/surveys/?token=${this.apiKey}`
    const fetchOptions: PostHogFetchOptions = {
      method: 'GET',
      headers: { ...this.getCustomHeaders(), 'Content-Type': 'application/json' },
    }

    const response = await this.fetchWithRetry(url, fetchOptions)
      .then((response) => {
        if (response.status !== 200 || !response.json) {
          const msg = `Surveys API could not be loaded: ${response.status}`
          const error = new Error(msg)
          this.logMsgIfDebug(() => console.error(error))

          this._events.emit('error', new Error(msg))
          return undefined
        }

        return response.json() as Promise<SurveyResponse>
      })
      .catch((error) => {
        this.logMsgIfDebug(() => console.error('Surveys API could not be loaded', error))

        this._events.emit('error', error)
        return undefined
      })

    const newSurveys = response?.surveys

    if (newSurveys) {
      this.logMsgIfDebug(() => console.log('PostHog Debug', 'Surveys fetched from API: ', JSON.stringify(newSurveys)))
    }

    return newSurveys ?? []
  }

  /***
   *** QUEUEING AND FLUSHING
   ***/
  protected enqueue(type: string, _message: any, options?: PostHogCaptureOptions): void {
    this.wrap(() => {
      if (this.optedOut) {
        this._events.emit(type, `Library is disabled. Not sending event. To re-enable, call posthog.optIn()`)
        return
      }

      const message = {
        ..._message,
        type: type,
        library: this.getLibraryId(),
        library_version: this.getLibraryVersion(),
        timestamp: options?.timestamp ? options?.timestamp : currentISOTime(),
        uuid: options?.uuid ? options.uuid : uuidv7(),
      }

      const addGeoipDisableProperty = options?.disableGeoip ?? this.disableGeoip
      if (addGeoipDisableProperty) {
        if (!message.properties) {
          message.properties = {}
        }
        message['properties']['$geoip_disable'] = true
      }

      if (message.distinctId) {
        message.distinct_id = message.distinctId
        delete message.distinctId
      }

      const queue = this.getPersistedProperty<PostHogQueueItem[]>(PostHogPersistedProperty.Queue) || []

      if (queue.length >= this.maxQueueSize) {
        queue.shift()
        this.logMsgIfDebug(() => console.info('Queue is full, the oldest event is dropped.'))
      }

      queue.push({ message })
      this.setPersistedProperty<PostHogQueueItem[]>(PostHogPersistedProperty.Queue, queue)

      this._events.emit(type, message)

      // Flush queued events if we meet the flushAt length
      if (queue.length >= this.flushAt) {
        this.flushBackground()
      }

      if (this.flushInterval && !this._flushTimer) {
        this._flushTimer = safeSetTimeout(() => this.flushBackground(), this.flushInterval)
      }
    })
  }

  private clearFlushTimer(): void {
    if (this._flushTimer) {
      clearTimeout(this._flushTimer)
      this._flushTimer = undefined
    }
  }

  /**
   * Helper for flushing the queue in the background
   * Avoids unnecessary promise errors
   */
  private flushBackground(): void {
    void this.flush().catch(() => {})
  }

  async flush(): Promise<any[]> {
    if (!this.flushPromise) {
      this.flushPromise = this._flush().finally(() => {
        this.flushPromise = null
      })
      this.addPendingPromise(this.flushPromise)
    }
    return this.flushPromise
  }

  protected getCustomHeaders(): { [key: string]: string } {
    // Don't set the user agent if we're not on a browser. The latest spec allows
    // the User-Agent header (see https://fetch.spec.whatwg.org/#terminology-headers
    // and https://developer.mozilla.org/en-US/docs/Web/API/XMLHttpRequest/setRequestHeader),
    // but browsers such as Chrome and Safari have not caught up.
    const customUserAgent = this.getCustomUserAgent()
    const headers: { [key: string]: string } = {}
    if (customUserAgent && customUserAgent !== '') {
      headers['User-Agent'] = customUserAgent
    }
    return headers
  }

  private async _flush(): Promise<any[]> {
    this.clearFlushTimer()
    await this._initPromise

    const queue = this.getPersistedProperty<PostHogQueueItem[]>(PostHogPersistedProperty.Queue) || []

    if (!queue.length) {
      return []
    }

    const items = queue.slice(0, this.maxBatchSize)
    const messages = items.map((item) => item.message)

    const persistQueueChange = (): void => {
      const refreshedQueue = this.getPersistedProperty<PostHogQueueItem[]>(PostHogPersistedProperty.Queue) || []
      this.setPersistedProperty<PostHogQueueItem[]>(PostHogPersistedProperty.Queue, refreshedQueue.slice(items.length))
    }

    const data: Record<string, any> = {
      api_key: this.apiKey,
      batch: messages,
      sent_at: currentISOTime(),
    }

    if (this.historicalMigration) {
      data.historical_migration = true
    }

    const payload = JSON.stringify(data)

    const url =
      this.captureMode === 'form'
        ? `${this.host}/e/?ip=1&_=${currentTimestamp()}&v=${this.getLibraryVersion()}`
        : `${this.host}/batch/`

    const fetchOptions: PostHogFetchOptions =
      this.captureMode === 'form'
        ? {
            method: 'POST',
            mode: 'no-cors',
            credentials: 'omit',
            headers: { ...this.getCustomHeaders(), 'Content-Type': 'application/x-www-form-urlencoded' },
            body: `data=${encodeURIComponent(LZString.compressToBase64(payload))}&compression=lz64`,
          }
        : {
            method: 'POST',
            headers: { ...this.getCustomHeaders(), 'Content-Type': 'application/json' },
            body: payload,
          }

    try {
      await this.fetchWithRetry(url, fetchOptions)
    } catch (err) {
      // depending on the error type, eg a malformed JSON or broken queue, it'll always return an error
      // and this will be an endless loop, in this case, if the error isn't a network issue, we always remove the items from the queue
      if (!(err instanceof PostHogFetchNetworkError)) {
        persistQueueChange()
      }
      this._events.emit('error', err)

      throw err
    }

    persistQueueChange()
    this._events.emit('flush', messages)

    return messages
  }

  private async fetchWithRetry(
    url: string,
    options: PostHogFetchOptions,
    retryOptions?: Partial<RetriableOptions>,
    requestTimeout?: number
  ): Promise<PostHogFetchResponse> {
    ;(AbortSignal as any).timeout ??= function timeout(ms: number) {
      const ctrl = new AbortController()
      setTimeout(() => ctrl.abort(), ms)
      return ctrl.signal
    }

    return await retriable(
      async () => {
        let res: PostHogFetchResponse | null = null
        try {
          res = await this.fetch(url, {
            signal: (AbortSignal as any).timeout(requestTimeout ?? this.requestTimeout),
            ...options,
          })
        } catch (e) {
          // fetch will only throw on network errors or on timeouts
          throw new PostHogFetchNetworkError(e)
        }
        // If we're in no-cors mode, we can't access the response status
        // We only throw on HTTP errors if we're not in no-cors mode
        // https://developer.mozilla.org/en-US/docs/Web/API/Request/mode#no-cors
        const isNoCors = options.mode === 'no-cors'
        if (!isNoCors && (res.status < 200 || res.status >= 400)) {
          throw new PostHogFetchHttpError(res)
        }
        return res
      },
      { ...this._retryOptions, ...retryOptions }
    )
  }

  async shutdown(shutdownTimeoutMs: number = 30000): Promise<void> {
    // A little tricky - we want to have a max shutdown time and enforce it, even if that means we have some
    // dangling promises. We'll keep track of the timeout and resolve/reject based on that.

    await this._initPromise
    let hasTimedOut = false
    this.clearFlushTimer()

    const doShutdown = async (): Promise<void> => {
      try {
        await Promise.all(Object.values(this.pendingPromises))

        while (true) {
          const queue = this.getPersistedProperty<PostHogQueueItem[]>(PostHogPersistedProperty.Queue) || []

          if (queue.length === 0) {
            break
          }

          // flush again to make sure we send all events, some of which might've been added
          // while we were waiting for the pending promises to resolve
          // For example, see sendFeatureFlags in posthog-node/src/posthog-node.ts::capture
          await this.flush()

          if (hasTimedOut) {
            break
          }
        }
      } catch (e) {
        if (!isPostHogFetchError(e)) {
          throw e
        }
        this.logMsgIfDebug(() => console.error('Error while shutting down PostHog', e))
      }
    }

    return Promise.race([
      new Promise<void>((_, reject) => {
        safeSetTimeout(() => {
          this.logMsgIfDebug(() => console.error('Timed out while shutting down PostHog'))
          hasTimedOut = true
          reject('Timeout while shutting down PostHog. Some events may not have been sent.')
        }, shutdownTimeoutMs)
      }),
      doShutdown(),
    ])
  }
}

export abstract class PostHogCore extends PostHogCoreStateless {
  // options
  private sendFeatureFlagEvent: boolean
  private flagCallReported: { [key: string]: boolean } = {}

  // internal
  protected _decideResponsePromise?: Promise<PostHogDecideResponse | undefined> // TODO: come back to this, fix typing
  protected _sessionExpirationTimeSeconds: number
  protected sessionProps: PostHogEventProperties = {}

  constructor(apiKey: string, options?: PostHogCoreOptions) {
    // Default for stateful mode is to not disable geoip. Only override if explicitly set
    const disableGeoipOption = options?.disableGeoip ?? false

    // Default for stateful mode is to timeout at 10s. Only override if explicitly set
    const featureFlagsRequestTimeoutMs = options?.featureFlagsRequestTimeoutMs ?? 10000 // 10 seconds

    super(apiKey, { ...options, disableGeoip: disableGeoipOption, featureFlagsRequestTimeoutMs })

    this.sendFeatureFlagEvent = options?.sendFeatureFlagEvent ?? true
    this._sessionExpirationTimeSeconds = options?.sessionExpirationTimeSeconds ?? 1800 // 30 minutes
  }

  protected setupBootstrap(options?: Partial<PostHogCoreOptions>): void {
    const bootstrap = options?.bootstrap
    if (!bootstrap) {
      return
    }

    // bootstrap options are only set if no persisted values are found
    // this is to prevent overwriting existing values
    if (bootstrap.distinctId) {
      if (bootstrap.isIdentifiedId) {
        const distinctId = this.getPersistedProperty(PostHogPersistedProperty.DistinctId)

        if (!distinctId) {
          this.setPersistedProperty(PostHogPersistedProperty.DistinctId, bootstrap.distinctId)
        }
      } else {
        const anonymousId = this.getPersistedProperty(PostHogPersistedProperty.AnonymousId)

        if (!anonymousId) {
          this.setPersistedProperty(PostHogPersistedProperty.AnonymousId, bootstrap.distinctId)
        }
      }
    }

    const bootstrapfeatureFlags = bootstrap.featureFlags
    if (bootstrapfeatureFlags && Object.keys(bootstrapfeatureFlags).length) {
      const bootstrapFlags = Object.keys(bootstrapfeatureFlags)
        .filter((flag) => !!bootstrapfeatureFlags[flag])
        .reduce(
          (res: Record<string, string | boolean>, key) => ((res[key] = bootstrapfeatureFlags[key] || false), res),
          {}
        )

      if (Object.keys(bootstrapFlags).length) {
        this.setPersistedProperty(PostHogPersistedProperty.BootstrapFeatureFlags, bootstrapFlags)

        const currentFlags =
          this.getPersistedProperty<PostHogDecideResponse['featureFlags']>(PostHogPersistedProperty.FeatureFlags) || {}
        const newFeatureFlags = { ...bootstrapFlags, ...currentFlags }
        this.setKnownFeatureFlags(newFeatureFlags)
      }

      const bootstrapFlagPayloads = bootstrap.featureFlagPayloads
      if (bootstrapFlagPayloads && Object.keys(bootstrapFlagPayloads).length) {
        this.setPersistedProperty(PostHogPersistedProperty.BootstrapFeatureFlagPayloads, bootstrapFlagPayloads)

        const currentFlagPayloads =
          this.getPersistedProperty<PostHogDecideResponse['featureFlagPayloads']>(
            PostHogPersistedProperty.FeatureFlagPayloads
          ) || {}
        const newFeatureFlagPayloads = { ...bootstrapFlagPayloads, ...currentFlagPayloads }
        this.setKnownFeatureFlagPayloads(newFeatureFlagPayloads)
      }
    }
  }

  // NOTE: Props are lazy loaded from localstorage hence the complex getter setter logic
  private get props(): PostHogEventProperties {
    if (!this._props) {
      this._props = this.getPersistedProperty<PostHogEventProperties>(PostHogPersistedProperty.Props)
    }
    return this._props || {}
  }

  private set props(val: PostHogEventProperties | undefined) {
    this._props = val
  }

  private clearProps(): void {
    this.props = undefined
    this.sessionProps = {}
    this.flagCallReported = {}
  }

  private _props: PostHogEventProperties | undefined

  on(event: string, cb: (...args: any[]) => void): () => void {
    return this._events.on(event, cb)
  }

  reset(propertiesToKeep?: PostHogPersistedProperty[]): void {
    this.wrap(() => {
      const allPropertiesToKeep = [PostHogPersistedProperty.Queue, ...(propertiesToKeep || [])]

      // clean up props
      this.clearProps()

      for (const key of <(keyof typeof PostHogPersistedProperty)[]>Object.keys(PostHogPersistedProperty)) {
        if (!allPropertiesToKeep.includes(PostHogPersistedProperty[key])) {
          this.setPersistedProperty((PostHogPersistedProperty as any)[key], null)
        }
      }

      this.reloadFeatureFlags()
    })
  }

  protected getCommonEventProperties(): any {
    const featureFlags = this.getFeatureFlags()

    const featureVariantProperties: Record<string, string | boolean> = {}
    if (featureFlags) {
      for (const [feature, variant] of Object.entries(featureFlags)) {
        featureVariantProperties[`$feature/${feature}`] = variant
      }
    }
    return {
      $active_feature_flags: featureFlags ? Object.keys(featureFlags) : undefined,
      ...featureVariantProperties,
      ...super.getCommonEventProperties(),
    }
  }

  private enrichProperties(properties?: PostHogEventProperties): any {
    return {
      ...this.props, // Persisted properties first
      ...this.sessionProps, // Followed by session properties
      ...(properties || {}), // Followed by user specified properties
      ...this.getCommonEventProperties(), // Followed by FF props
      $session_id: this.getSessionId(),
    }
  }

  /**
   * * @returns {string} The stored session ID for the current session. This may be an empty string if the client is not yet fully initialized.
   */
  getSessionId(): string {
    if (!this._isInitialized) {
      return ''
    }

    let sessionId = this.getPersistedProperty<string>(PostHogPersistedProperty.SessionId)
    const sessionTimestamp = this.getPersistedProperty<number>(PostHogPersistedProperty.SessionLastTimestamp) || 0
    if (!sessionId || Date.now() - sessionTimestamp > this._sessionExpirationTimeSeconds * 1000) {
      sessionId = uuidv7()
      this.setPersistedProperty(PostHogPersistedProperty.SessionId, sessionId)
    }
    this.setPersistedProperty(PostHogPersistedProperty.SessionLastTimestamp, Date.now())

    return sessionId
  }

  resetSessionId(): void {
    this.wrap(() => {
      this.setPersistedProperty(PostHogPersistedProperty.SessionId, null)
      this.setPersistedProperty(PostHogPersistedProperty.SessionLastTimestamp, null)
    })
  }

  /**
   * * @returns {string} The stored anonymous ID. This may be an empty string if the client is not yet fully initialized.
   */
  getAnonymousId(): string {
    if (!this._isInitialized) {
      return ''
    }

    let anonId = this.getPersistedProperty<string>(PostHogPersistedProperty.AnonymousId)
    if (!anonId) {
      anonId = uuidv7()
      this.setPersistedProperty(PostHogPersistedProperty.AnonymousId, anonId)
    }
    return anonId
  }

  /**
   * * @returns {string} The stored distinct ID. This may be an empty string if the client is not yet fully initialized.
   */
  getDistinctId(): string {
    if (!this._isInitialized) {
      return ''
    }

    return this.getPersistedProperty<string>(PostHogPersistedProperty.DistinctId) || this.getAnonymousId()
  }

  async unregister(property: string): Promise<void> {
    this.wrap(() => {
      delete this.props[property]
      this.setPersistedProperty<PostHogEventProperties>(PostHogPersistedProperty.Props, this.props)
    })
  }

  async register(properties: { [key: string]: any }): Promise<void> {
    this.wrap(() => {
      this.props = {
        ...this.props,
        ...properties,
      }
      this.setPersistedProperty<PostHogEventProperties>(PostHogPersistedProperty.Props, this.props)
    })
  }

  registerForSession(properties: { [key: string]: any }): void {
    this.sessionProps = {
      ...this.sessionProps,
      ...properties,
    }
  }

  unregisterForSession(property: string): void {
    delete this.sessionProps[property]
  }

  /***
   *** TRACKING
   ***/
  identify(distinctId?: string, properties?: PostHogEventProperties, options?: PostHogCaptureOptions): void {
    this.wrap(() => {
      const previousDistinctId = this.getDistinctId()
      distinctId = distinctId || previousDistinctId

      if (properties?.$groups) {
        this.groups(properties.$groups)
      }

      // promote $set and $set_once to top level
      const userPropsOnce = properties?.$set_once
      delete properties?.$set_once

      // if no $set is provided we assume all properties are $set
      const userProps = properties?.$set || properties

      const allProperties = this.enrichProperties({
        $anon_distinct_id: this.getAnonymousId(),
        $set: userProps,
        $set_once: userPropsOnce,
      })

      if (distinctId !== previousDistinctId) {
        // We keep the AnonymousId to be used by decide calls and identify to link the previousId
        this.setPersistedProperty(PostHogPersistedProperty.AnonymousId, previousDistinctId)
        this.setPersistedProperty(PostHogPersistedProperty.DistinctId, distinctId)
        this.reloadFeatureFlags()
      }

      super.identifyStateless(distinctId, allProperties, options)
    })
  }

  capture(event: string, properties?: { [key: string]: any }, options?: PostHogCaptureOptions): void {
    this.wrap(() => {
      const distinctId = this.getDistinctId()

      if (properties?.$groups) {
        this.groups(properties.$groups)
      }

      const allProperties = this.enrichProperties(properties)

      super.captureStateless(distinctId, event, allProperties, options)
    })
  }

  alias(alias: string): void {
    this.wrap(() => {
      const distinctId = this.getDistinctId()
      const allProperties = this.enrichProperties({})

      super.aliasStateless(alias, distinctId, allProperties)
    })
  }

  autocapture(
    eventType: string,
    elements: PostHogAutocaptureElement[],
    properties: PostHogEventProperties = {},
    options?: PostHogCaptureOptions
  ): void {
    this.wrap(() => {
      const distinctId = this.getDistinctId()
      const payload = {
        distinct_id: distinctId,
        event: '$autocapture',
        properties: {
          ...this.enrichProperties(properties),
          $event_type: eventType,
          $elements: elements,
        },
      }

      this.enqueue('autocapture', payload, options)
    })
  }

  /***
   *** GROUPS
   ***/

  groups(groups: { [type: string]: string | number }): void {
    this.wrap(() => {
      // Get persisted groups
      const existingGroups = this.props.$groups || {}

      this.register({
        $groups: {
          ...existingGroups,
          ...groups,
        },
      })

      if (Object.keys(groups).find((type) => existingGroups[type] !== groups[type])) {
        this.reloadFeatureFlags()
      }
    })
  }

  group(
    groupType: string,
    groupKey: string | number,
    groupProperties?: PostHogEventProperties,
    options?: PostHogCaptureOptions
  ): void {
    this.wrap(() => {
      this.groups({
        [groupType]: groupKey,
      })

      if (groupProperties) {
        this.groupIdentify(groupType, groupKey, groupProperties, options)
      }
    })
  }

  groupIdentify(
    groupType: string,
    groupKey: string | number,
    groupProperties?: PostHogEventProperties,
    options?: PostHogCaptureOptions
  ): void {
    this.wrap(() => {
      const distinctId = this.getDistinctId()
      const eventProperties = this.enrichProperties({})
      super.groupIdentifyStateless(groupType, groupKey, groupProperties, options, distinctId, eventProperties)
    })
  }

  /***
   * PROPERTIES
   ***/
  setPersonPropertiesForFlags(properties: { [type: string]: string }): void {
    this.wrap(() => {
      // Get persisted person properties
      const existingProperties =
        this.getPersistedProperty<Record<string, string>>(PostHogPersistedProperty.PersonProperties) || {}

      this.setPersistedProperty<PostHogEventProperties>(PostHogPersistedProperty.PersonProperties, {
        ...existingProperties,
        ...properties,
      })
    })
  }

  resetPersonPropertiesForFlags(): void {
    this.wrap(() => {
      this.setPersistedProperty<PostHogEventProperties>(PostHogPersistedProperty.PersonProperties, null)
    })
  }

  /** @deprecated - Renamed to setPersonPropertiesForFlags */
  personProperties(properties: { [type: string]: string }): void {
    return this.setPersonPropertiesForFlags(properties)
  }

  setGroupPropertiesForFlags(properties: { [type: string]: Record<string, string> }): void {
    this.wrap(() => {
      // Get persisted group properties
      const existingProperties =
        this.getPersistedProperty<Record<string, Record<string, string>>>(PostHogPersistedProperty.GroupProperties) ||
        {}

      if (Object.keys(existingProperties).length !== 0) {
        Object.keys(existingProperties).forEach((groupType) => {
          existingProperties[groupType] = {
            ...existingProperties[groupType],
            ...properties[groupType],
          }
          delete properties[groupType]
        })
      }

      this.setPersistedProperty<PostHogEventProperties>(PostHogPersistedProperty.GroupProperties, {
        ...existingProperties,
        ...properties,
      })
    })
  }

  resetGroupPropertiesForFlags(): void {
    this.wrap(() => {
      this.setPersistedProperty<PostHogEventProperties>(PostHogPersistedProperty.GroupProperties, null)
    })
  }

  /** @deprecated - Renamed to setGroupPropertiesForFlags */
  groupProperties(properties: { [type: string]: Record<string, string> }): void {
    this.wrap(() => {
      this.setGroupPropertiesForFlags(properties)
    })
  }

  private async remoteConfigAsync(): Promise<PostHogRemoteConfig | undefined> {
    await this._initPromise
    if (this._remoteConfigResponsePromise) {
      return this._remoteConfigResponsePromise
    }
    return this._remoteConfigAsync()
  }

  /***
   *** FEATURE FLAGS
   ***/
  private async decideAsync(sendAnonDistinctId: boolean = true): Promise<PostHogDecideResponse | undefined> {
    await this._initPromise
    if (this._decideResponsePromise) {
      return this._decideResponsePromise
    }
    return this._decideAsync(sendAnonDistinctId)
  }

  private cacheSessionReplay(response?: PostHogRemoteConfig): void {
    const sessionReplay = response?.sessionRecording
    if (sessionReplay) {
      this.setPersistedProperty(PostHogPersistedProperty.SessionReplay, sessionReplay)
      this.logMsgIfDebug(() => console.log('PostHog Debug', 'Session replay config: ', JSON.stringify(sessionReplay)))
    } else {
      this.logMsgIfDebug(() => console.info('PostHog Debug', 'Session replay config disabled.'))
      this.setPersistedProperty(PostHogPersistedProperty.SessionReplay, null)
    }
  }

  private async _remoteConfigAsync(): Promise<PostHogRemoteConfig | undefined> {
    this._remoteConfigResponsePromise = this._initPromise
      .then(() => {
        let remoteConfig = this.getPersistedProperty<Omit<PostHogRemoteConfig, 'surveys'>>(
          PostHogPersistedProperty.RemoteConfig
        )

        this.logMsgIfDebug(() => console.log('PostHog Debug', 'Cached remote config: ', JSON.stringify(remoteConfig)))

        return super.getRemoteConfig().then((response) => {
          if (response) {
            const remoteConfigWithoutSurveys = { ...response }
            delete remoteConfigWithoutSurveys.surveys

            this.logMsgIfDebug(() =>
              console.log('PostHog Debug', 'Fetched remote config: ', JSON.stringify(remoteConfigWithoutSurveys))
            )

            const surveys = response.surveys

            let hasSurveys = true

            if (!Array.isArray(surveys)) {
              // If surveys is not an array, it means there are no surveys (its a boolean instead)
              this.logMsgIfDebug(() => console.log('PostHog Debug', 'There are no surveys.'))
              hasSurveys = false
            } else {
              this.logMsgIfDebug(() =>
                console.log('PostHog Debug', 'Surveys fetched from remote config: ', JSON.stringify(surveys))
              )
            }

            if (this.disableSurveys === false && hasSurveys) {
              this.setPersistedProperty<SurveyResponse['surveys']>(
                PostHogPersistedProperty.Surveys,
                surveys as Survey[]
              )
            } else {
              this.setPersistedProperty<SurveyResponse['surveys']>(PostHogPersistedProperty.Surveys, null)
            }

            // we cache the surveys in its own storage key
            this.setPersistedProperty<Omit<PostHogRemoteConfig, 'surveys'>>(
              PostHogPersistedProperty.RemoteConfig,
              remoteConfigWithoutSurveys
            )

            this.cacheSessionReplay(response)

            // we only dont load flags if the remote config has no feature flags
            if (response.hasFeatureFlags === false) {
              // resetting flags to empty object
              this.setKnownFeatureFlags({})
              this.setKnownFeatureFlagPayloads({})

              this.logMsgIfDebug(() => console.warn('Remote config has no feature flags, will not load feature flags.'))
            } else if (this.preloadFeatureFlags !== false) {
              this.reloadFeatureFlags()
            }

            remoteConfig = response
          }

          return remoteConfig
        })
      })
      .finally(() => {
        this._remoteConfigResponsePromise = undefined
      })
    return this._remoteConfigResponsePromise
  }

  private async _decideAsync(sendAnonDistinctId: boolean = true): Promise<PostHogDecideResponse | undefined> {
    this._decideResponsePromise = this._initPromise
      .then(async () => {
        const distinctId = this.getDistinctId()
        const groups = this.props.$groups || {}
        const personProperties =
          this.getPersistedProperty<Record<string, string>>(PostHogPersistedProperty.PersonProperties) || {}
        const groupProperties =
          this.getPersistedProperty<Record<string, Record<string, string>>>(PostHogPersistedProperty.GroupProperties) ||
          {}

        const extraProperties = {
          $anon_distinct_id: sendAnonDistinctId ? this.getAnonymousId() : undefined,
        }

        const res = await super.getDecide(distinctId, groups, personProperties, groupProperties, extraProperties)
        // Add check for quota limitation on feature flags
        if (res?.quotaLimited?.includes(QuotaLimitedFeature.FeatureFlags)) {
          // Unset all feature flags by setting to null
          this.setKnownFeatureFlags(null)
          this.setKnownFeatureFlagPayloads(null)
          console.warn(
            '[FEATURE FLAGS] Feature flags quota limit exceeded - unsetting all flags. Learn more about billing limits at https://posthog.com/docs/billing/limits-alerts'
          )
          return res
        }
        if (res?.featureFlags) {
          // clear flag call reported if we have new flags since they might have changed
          if (this.sendFeatureFlagEvent) {
            this.flagCallReported = {}
          }

          let newFeatureFlags = res.featureFlags
          let newFeatureFlagPayloads = res.featureFlagPayloads
          if (res.errorsWhileComputingFlags) {
            // if not all flags were computed, we upsert flags instead of replacing them
            const currentFlags = this.getPersistedProperty<PostHogDecideResponse['featureFlags']>(
              PostHogPersistedProperty.FeatureFlags
            )

            this.logMsgIfDebug(() =>
              console.log('PostHog Debug', 'Cached feature flags: ', JSON.stringify(currentFlags))
            )

            const currentFlagPayloads = this.getPersistedProperty<PostHogDecideResponse['featureFlagPayloads']>(
              PostHogPersistedProperty.FeatureFlagPayloads
            )
            newFeatureFlags = { ...currentFlags, ...res.featureFlags }
            newFeatureFlagPayloads = { ...currentFlagPayloads, ...res.featureFlagPayloads }
          }
          this.setKnownFeatureFlags(newFeatureFlags)
          this.setKnownFeatureFlagPayloads(
            Object.fromEntries(Object.entries(newFeatureFlagPayloads || {}).map(([k, v]) => [k, this._parsePayload(v)]))
          )
          // Mark that we hit the /decide endpoint so we can capture this in the $feature_flag_called event
          this.setPersistedProperty(PostHogPersistedProperty.DecideEndpointWasHit, true)

          this.cacheSessionReplay(res)
        }
        return res
      })
      .finally(() => {
        this._decideResponsePromise = undefined
      })
    return this._decideResponsePromise
  }

  private setKnownFeatureFlags(featureFlags: PostHogDecideResponse['featureFlags'] | null): void {
    this.wrap(() => {
      this.setPersistedProperty<PostHogDecideResponse['featureFlags']>(
        PostHogPersistedProperty.FeatureFlags,
        featureFlags
      )
      this._events.emit('featureflags', featureFlags)
    })
  }

  private setKnownFeatureFlagPayloads(featureFlagPayloads: PostHogDecideResponse['featureFlagPayloads'] | null): void {
    this.wrap(() => {
      this.setPersistedProperty<PostHogDecideResponse['featureFlagPayloads']>(
        PostHogPersistedProperty.FeatureFlagPayloads,
        featureFlagPayloads
      )
    })
  }

  getFeatureFlag(key: string): boolean | string | undefined {
    const featureFlags = this.getFeatureFlags()

    if (!featureFlags) {
      // If we haven't loaded flags yet, or errored out, we respond with undefined
      return undefined
    }

    let response = featureFlags[key]
    // `/decide` v3 returns all flags

    if (response === undefined) {
      // For cases where the flag is unknown, return false
      response = false
    }

    if (this.sendFeatureFlagEvent && !this.flagCallReported[key]) {
      this.flagCallReported[key] = true
      this.capture('$feature_flag_called', {
        $feature_flag: key,
        $feature_flag_response: response,
        $feature_flag_bootstrapped_response: this.getPersistedProperty<PostHogDecideResponse['featureFlags']>(
          PostHogPersistedProperty.BootstrapFeatureFlags
        )?.[key],
        $feature_flag_bootstrapped_payload: this.getPersistedProperty<PostHogDecideResponse['featureFlagPayloads']>(
          PostHogPersistedProperty.BootstrapFeatureFlagPayloads
        )?.[key],
        // If we haven't yet received a response from the /decide endpoint, we must have used the bootstrapped value
        $used_bootstrap_value: !this.getPersistedProperty(PostHogPersistedProperty.DecideEndpointWasHit),
      })
    }

    // If we have flags we either return the value (true or string) or false
    return response
  }

  getFeatureFlagPayload(key: string): JsonType | undefined {
    const payloads = this.getFeatureFlagPayloads()

    if (!payloads) {
      return undefined
    }

    const response = payloads[key]

    // Undefined means a loading or missing data issue. Null means evaluation happened and there was no match
    if (response === undefined) {
      return null
    }

    return response
  }

  getFeatureFlagPayloads(): PostHogDecideResponse['featureFlagPayloads'] | undefined {
    const payloads = this.getPersistedProperty<PostHogDecideResponse['featureFlagPayloads']>(
      PostHogPersistedProperty.FeatureFlagPayloads
    )

    return payloads
  }

  getFeatureFlags(): PostHogDecideResponse['featureFlags'] | undefined {
    // NOTE: We don't check for _initPromise here as the function is designed to be
    // callable before the state being loaded anyways
    let flags = this.getPersistedProperty<PostHogDecideResponse['featureFlags']>(PostHogPersistedProperty.FeatureFlags)
    const overriddenFlags = this.getPersistedProperty<PostHogDecideResponse['featureFlags']>(
      PostHogPersistedProperty.OverrideFeatureFlags
    )

    if (!overriddenFlags) {
      return flags
    }

    flags = flags || {}

    for (const key in overriddenFlags) {
      if (!overriddenFlags[key]) {
        delete flags[key]
      } else {
        flags[key] = overriddenFlags[key]
      }
    }

    return flags
  }

  getFeatureFlagsAndPayloads(): {
    flags: PostHogDecideResponse['featureFlags'] | undefined
    payloads: PostHogDecideResponse['featureFlagPayloads'] | undefined
  } {
    const flags = this.getFeatureFlags()
    const payloads = this.getFeatureFlagPayloads()

    return {
      flags,
      payloads,
    }
  }

  isFeatureEnabled(key: string): boolean | undefined {
    const response = this.getFeatureFlag(key)
    if (response === undefined) {
      return undefined
    }
    return !!response
  }

  // Used when we want to trigger the reload but we don't care about the result
  reloadFeatureFlags(cb?: (err?: Error, flags?: PostHogDecideResponse['featureFlags']) => void): void {
    this.decideAsync()
      .then((res) => {
        cb?.(undefined, res?.featureFlags)
      })
      .catch((e) => {
        cb?.(e, undefined)
        if (!cb) {
          this.logMsgIfDebug(() => console.log('[PostHog] Error reloading feature flags', e))
        }
      })
  }

  async reloadRemoteConfigAsync(): Promise<PostHogRemoteConfig | undefined> {
    return await this.remoteConfigAsync()
  }

  async reloadFeatureFlagsAsync(
    sendAnonDistinctId: boolean = true
  ): Promise<PostHogDecideResponse['featureFlags'] | undefined> {
    return (await this.decideAsync(sendAnonDistinctId))?.featureFlags
  }

  onFeatureFlags(cb: (flags: PostHogDecideResponse['featureFlags']) => void): () => void {
    return this.on('featureflags', async () => {
      const flags = this.getFeatureFlags()
      if (flags) {
        cb(flags)
      }
    })
  }

  onFeatureFlag(key: string, cb: (value: string | boolean) => void): () => void {
    return this.on('featureflags', async () => {
      const flagResponse = this.getFeatureFlag(key)
      if (flagResponse !== undefined) {
        cb(flagResponse)
      }
    })
  }

  async overrideFeatureFlag(flags: PostHogDecideResponse['featureFlags'] | null): Promise<void> {
    this.wrap(() => {
      if (flags === null) {
        return this.setPersistedProperty(PostHogPersistedProperty.OverrideFeatureFlags, null)
      }
      return this.setPersistedProperty(PostHogPersistedProperty.OverrideFeatureFlags, flags)
    })
  }

  /***
   *** ERROR TRACKING
   ***/
  captureException(error: unknown, additionalProperties?: { [key: string]: any }): void {
    const properties: { [key: string]: any } = {
      $exception_level: 'error',
      $exception_list: [
        {
          type: isError(error) ? error.name : 'Error',
          value: isError(error) ? error.message : error,
          mechanism: {
            handled: true,
            synthetic: false,
          },
        },
      ],
      ...additionalProperties,
    }

    properties.$exception_personURL = new URL(
      `/project/${this.apiKey}/person/${this.getDistinctId()}`,
      this.host
    ).toString()

    this.capture('$exception', properties)
  }

  /**
   * Capture written user feedback for a LLM trace. Numeric values are converted to strings.
   * @param traceId The trace ID to capture feedback for.
   * @param userFeedback The feedback to capture.
   */
  captureTraceFeedback(traceId: string | number, userFeedback: string): void {
    this.capture('$ai_feedback', {
      $ai_feedback_text: userFeedback,
      $ai_trace_id: String(traceId),
    })
  }

  /**
   * Capture a metric for a LLM trace. Numeric values are converted to strings.
   * @param traceId The trace ID to capture the metric for.
   * @param metricName The name of the metric to capture.
   * @param metricValue The value of the metric to capture.
   */
  captureTraceMetric(traceId: string | number, metricName: string, metricValue: string | number | boolean): void {
    this.capture('$ai_metric', {
      $ai_metric_name: metricName,
      $ai_metric_value: String(metricValue),
      $ai_trace_id: String(traceId),
    })
  }
}

export * from './types'
export { LZString }

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
} from './types'
import {
  assert,
  currentISOTime,
  currentTimestamp,
  removeTrailingSlash,
  retriable,
  RetriableOptions,
  safeSetTimeout,
} from './utils'
export * as utils from './utils'
import { LZString } from './lz-string'
import { SimpleEventEmitter } from './eventemitter'
import { uuidv7 } from './vendor/uuidv7'

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
    // @ts-ignore
    super('Network error while fetching PostHog', error instanceof Error ? { cause: error } : {})
  }
}

function isPostHogFetchError(err: any): boolean {
  return typeof err === 'object' && (err.name === 'PostHogFetchHttpError' || err.name === 'PostHogFetchNetworkError')
}

export abstract class PostHogCoreStateless {
  // options
  private apiKey: string
  host: string
  private flushAt: number
  private flushInterval: number
  private requestTimeout: number
  private captureMode: 'form' | 'json'
  private removeDebugCallback?: () => void
  private disableGeoip: boolean = true
  public disabled = false

  private defaultOptIn: boolean = true
  private pendingPromises: Record<string, Promise<any>> = {}

  // internal
  protected _events = new SimpleEventEmitter()
  protected _flushTimer?: any
  protected _retryOptions: RetriableOptions
  protected _initPromise: Promise<any>
  protected _isInitialized: boolean = false

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
    this.host = removeTrailingSlash(options?.host || 'https://app.posthog.com')
    this.flushAt = options?.flushAt ? Math.max(options?.flushAt, 1) : 20
    this.flushInterval = options?.flushInterval ?? 10000
    this.captureMode = options?.captureMode || 'form'

    // If enable is explicitly set to false we override the optout
    this.defaultOptIn = options?.defaultOptIn ?? true

    this._retryOptions = {
      retryCount: options?.fetchRetryCount ?? 3,
      retryDelay: options?.fetchRetryDelay ?? 3000,
      retryCheck: isPostHogFetchError,
    }
    this.requestTimeout = options?.requestTimeout ?? 10000 // 10 seconds
    this.disableGeoip = options?.disableGeoip ?? true
    this.disabled = options?.disabled ?? false
    // Init promise allows the derived class to block calls until it is ready
    this._initPromise = Promise.resolve()
    this._isInitialized = true
  }

  protected wrap(fn: () => void): void {
    if (this.disabled) {
      if (this.isDebug) {
        console.warn('[PostHog] The client is disabled')
      }
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

  protected addPendingPromise(promise: Promise<any>): void {
    const promiseUUID = uuidv7()
    this.pendingPromises[promiseUUID] = promise
    promise.finally(() => {
      delete this.pendingPromises[promiseUUID]
    })
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
      // To add person properties, pass in all person properties to the `$set` key.

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
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        token: this.apiKey,
        distinct_id: distinctId,
        groups,
        person_properties: personProperties,
        group_properties: groupProperties,
        ...extraPayload,
      }),
    }
    return this.fetchWithRetry(url, fetchOptions)
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
  ): Promise<boolean | string | undefined> {
    await this._initPromise

    const featureFlags = await this.getFeatureFlagsStateless(
      distinctId,
      groups,
      personProperties,
      groupProperties,
      disableGeoip
    )

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

    // If we have flags we either return the value (true or string) or false
    return response
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
      disableGeoip
    )

    if (!payloads) {
      return undefined
    }

    const response = payloads[key]

    // Undefined means a loading or missing data issue. Null means evaluation happened and there was no match
    if (response === undefined) {
      return null
    }

    return this._parsePayload(response)
  }

  protected async getFeatureFlagPayloadsStateless(
    distinctId: string,
    groups: Record<string, string> = {},
    personProperties: Record<string, string> = {},
    groupProperties: Record<string, Record<string, string>> = {},
    disableGeoip?: boolean
  ): Promise<PostHogDecideResponse['featureFlagPayloads'] | undefined> {
    await this._initPromise

    const payloads = (
      await this.getFeatureFlagsAndPayloadsStateless(
        distinctId,
        groups,
        personProperties,
        groupProperties,
        disableGeoip
      )
    ).payloads

    if (payloads) {
      return Object.fromEntries(Object.entries(payloads).map(([k, v]) => [k, this._parsePayload(v)]))
    }
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
    disableGeoip?: boolean
  ): Promise<PostHogDecideResponse['featureFlags'] | undefined> {
    await this._initPromise

    return (
      await this.getFeatureFlagsAndPayloadsStateless(
        distinctId,
        groups,
        personProperties,
        groupProperties,
        disableGeoip
      )
    ).flags
  }

  protected async getFeatureFlagsAndPayloadsStateless(
    distinctId: string,
    groups: Record<string, string | number> = {},
    personProperties: Record<string, string> = {},
    groupProperties: Record<string, Record<string, string>> = {},
    disableGeoip?: boolean
  ): Promise<{
    flags: PostHogDecideResponse['featureFlags'] | undefined
    payloads: PostHogDecideResponse['featureFlagPayloads'] | undefined
  }> {
    await this._initPromise

    const extraPayload: Record<string, any> = {}
    if (disableGeoip ?? this.disableGeoip) {
      extraPayload['geoip_disable'] = true
    }
    const decideResponse = await this.getDecide(distinctId, groups, personProperties, groupProperties, extraPayload)

    const flags = decideResponse?.featureFlags
    const payloads = decideResponse?.featureFlagPayloads

    return {
      flags,
      payloads,
    }
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

      queue.push({ message })
      this.setPersistedProperty<PostHogQueueItem[]>(PostHogPersistedProperty.Queue, queue)

      this._events.emit(type, message)

      // Flush queued events if we meet the flushAt length
      if (queue.length >= this.flushAt) {
        this.flush()
      }

      if (this.flushInterval && !this._flushTimer) {
        this._flushTimer = safeSetTimeout(() => this.flush(), this.flushInterval)
      }
    })
  }

  async flushAsync(): Promise<any> {
    await this._initPromise

    return new Promise((resolve, reject) => {
      this.flush((err, data) => {
        return err ? reject(err) : resolve(data)
      })
    })
  }

  flush(callback?: (err?: any, data?: any) => void): void {
    this.wrap(() => {
      if (this._flushTimer) {
        clearTimeout(this._flushTimer)
        this._flushTimer = null
      }

      const queue = this.getPersistedProperty<PostHogQueueItem[]>(PostHogPersistedProperty.Queue) || []

      if (!queue.length) {
        return callback?.()
      }

      const items = queue.splice(0, this.flushAt)
      this.setPersistedProperty<PostHogQueueItem[]>(PostHogPersistedProperty.Queue, queue)

      const messages = items.map((item) => item.message)

      const data = {
        api_key: this.apiKey,
        batch: messages,
        sent_at: currentISOTime(),
      }

      const done = (err?: any): void => {
        if (err) {
          this._events.emit('error', err)
        }
        callback?.(err, messages)
        this._events.emit('flush', messages)
      }

      // Don't set the user agent if we're not on a browser. The latest spec allows
      // the User-Agent header (see https://fetch.spec.whatwg.org/#terminology-headers
      // and https://developer.mozilla.org/en-US/docs/Web/API/XMLHttpRequest/setRequestHeader),
      // but browsers such as Chrome and Safari have not caught up.
      const customUserAgent = this.getCustomUserAgent()
      const headers: { [key: string]: string } = {}
      if (customUserAgent) {
        headers['user-agent'] = customUserAgent
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
              headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
              body: `data=${encodeURIComponent(LZString.compressToBase64(payload))}&compression=lz64`,
            }
          : {
              method: 'POST',
              headers: { 'Content-Type': 'application/json' },
              body: payload,
            }
      const requestPromise = this.fetchWithRetry(url, fetchOptions)
      this.addPendingPromise(
        requestPromise
          .then(() => done())
          .catch((err) => {
            done(err)
          })
      )
    })
  }

  private async fetchWithRetry(
    url: string,
    options: PostHogFetchOptions,
    retryOptions?: RetriableOptions
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
            signal: (AbortSignal as any).timeout(this.requestTimeout),
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

  async shutdownAsync(): Promise<void> {
    await this._initPromise

    clearTimeout(this._flushTimer)
    try {
      await this.flushAsync()
      await Promise.all(
        Object.values(this.pendingPromises).map((x) =>
          x.catch(() => {
            // ignore errors as we are shutting down and can't deal with them anyways.
          })
        )
      )
      // flush again to make sure we send all events, some of which might've been added
      // while we were waiting for the pending promises to resolve
      // For example, see sendFeatureFlags in posthog-node/src/posthog-node.ts::capture
      await this.flushAsync()
    } catch (e) {
      if (!isPostHogFetchError(e)) {
        throw e
      }
      console.error('Error while shutting down PostHog', e)
    }
  }

  shutdown(): void {
    void this.shutdownAsync()
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

    super(apiKey, { ...options, disableGeoip: disableGeoipOption })

    this.sendFeatureFlagEvent = options?.sendFeatureFlagEvent ?? true
    this._sessionExpirationTimeSeconds = options?.sessionExpirationTimeSeconds ?? 1800 // 30 minutes
  }

  protected setupBootstrap(options?: Partial<PostHogCoreOptions>): void {
    if (options?.bootstrap?.distinctId) {
      if (options?.bootstrap?.isIdentifiedId) {
        this.setPersistedProperty(PostHogPersistedProperty.DistinctId, options.bootstrap.distinctId)
      } else {
        this.setPersistedProperty(PostHogPersistedProperty.AnonymousId, options.bootstrap.distinctId)
      }
    }

    if (options?.bootstrap?.featureFlags) {
      const activeFlags = Object.keys(options.bootstrap?.featureFlags || {})
        .filter((flag) => !!options.bootstrap?.featureFlags?.[flag])
        .reduce(
          (res: Record<string, string | boolean>, key) => (
            (res[key] = options.bootstrap?.featureFlags?.[key] || false), res
          ),
          {}
        )
      this.setKnownFeatureFlags(activeFlags)
      options?.bootstrap.featureFlagPayloads && this.setKnownFeatureFlagPayloads(options?.bootstrap.featureFlagPayloads)
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

      const allProperties = this.enrichProperties({
        ...properties,
        $anon_distinct_id: this.getAnonymousId(),
        $set: properties,
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
      this.setPersistedProperty<PostHogEventProperties>(PostHogPersistedProperty.PersonProperties, {})
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
      this.setPersistedProperty<PostHogEventProperties>(PostHogPersistedProperty.GroupProperties, {})
    })
  }

  /** @deprecated - Renamed to setGroupPropertiesForFlags */
  groupProperties(properties: { [type: string]: Record<string, string> }): void {
    this.wrap(() => {
      this.setGroupPropertiesForFlags(properties)
    })
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

  private async _decideAsync(sendAnonDistinctId: boolean = true): Promise<PostHogDecideResponse | undefined> {
    this._decideResponsePromise = this._initPromise
      .then(() => {
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

        return super.getDecide(distinctId, groups, personProperties, groupProperties, extraProperties).then((res) => {
          if (res?.featureFlags) {
            let newFeatureFlags = res.featureFlags
            let newFeatureFlagPayloads = res.featureFlagPayloads
            if (res.errorsWhileComputingFlags) {
              // if not all flags were computed, we upsert flags instead of replacing them
              const currentFlags = this.getPersistedProperty<PostHogDecideResponse['featureFlags']>(
                PostHogPersistedProperty.FeatureFlags
              )
              const currentFlagPayloads = this.getPersistedProperty<PostHogDecideResponse['featureFlagPayloads']>(
                PostHogPersistedProperty.FeatureFlagPayloads
              )
              newFeatureFlags = { ...currentFlags, ...res.featureFlags }
              newFeatureFlagPayloads = { ...currentFlagPayloads, ...res.featureFlagPayloads }
            }
            this.setKnownFeatureFlags(newFeatureFlags)
            this.setKnownFeatureFlagPayloads(newFeatureFlagPayloads)
          }

          return res
        })
      })
      .finally(() => {
        this._decideResponsePromise = undefined
      })
    return this._decideResponsePromise
  }

  private setKnownFeatureFlags(featureFlags: PostHogDecideResponse['featureFlags']): void {
    this.wrap(() => {
      this.setPersistedProperty<PostHogDecideResponse['featureFlags']>(
        PostHogPersistedProperty.FeatureFlags,
        featureFlags
      )
      this._events.emit('featureflags', featureFlags)
    })
  }

  private setKnownFeatureFlagPayloads(featureFlagPayloads: PostHogDecideResponse['featureFlagPayloads']): void {
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

    return this._parsePayload(response)
  }

  getFeatureFlagPayloads(): PostHogDecideResponse['featureFlagPayloads'] | undefined {
    const payloads = this.getPersistedProperty<PostHogDecideResponse['featureFlagPayloads']>(
      PostHogPersistedProperty.FeatureFlagPayloads
    )
    if (payloads) {
      return Object.fromEntries(Object.entries(payloads).map(([k, v]) => [k, this._parsePayload(v)]))
    }
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
          console.log('[PostHog] Error reloading feature flags', e)
        }
      })
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
}

export * from './types'
export { LZString }

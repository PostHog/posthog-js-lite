import {
  PostHogFetchOptions,
  PostHogFetchResponse,
  PostHogQueueItem,
  PostHogAutocaptureElement,
  PostHogDecideResponse,
  PosthogCoreOptions,
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
  private debugMode: boolean = false
  private disableGeoip: boolean = true

  private _optoutOverride: boolean | undefined
  private pendingPromises: Record<string, Promise<any>> = {}

  // internal
  protected _events = new SimpleEventEmitter()
  protected _flushTimer?: any
  protected _retryOptions: RetriableOptions
  protected _initPromise: Promise<any>

  // Abstract methods to be overridden by implementations
  abstract fetch(url: string, options: PostHogFetchOptions): Promise<PostHogFetchResponse>
  abstract getLibraryId(): string
  abstract getLibraryVersion(): string
  abstract getCustomUserAgent(): string | void

  // This is our abstracted storage. Each implementation should handle its own
  abstract getPersistedProperty<T>(key: PostHogPersistedProperty): T | undefined
  abstract setPersistedProperty<T>(key: PostHogPersistedProperty, value: T | null): void

  constructor(apiKey: string, options?: PosthogCoreOptions) {
    assert(apiKey, "You must pass your PostHog project's api key.")

    this.apiKey = apiKey
    this.host = removeTrailingSlash(options?.host || 'https://app.posthog.com')
    this.flushAt = options?.flushAt ? Math.max(options?.flushAt, 1) : 20
    this.flushInterval = options?.flushInterval ?? 10000
    this.captureMode = options?.captureMode || 'form'

    // If enable is explicitly set to false we override the optout
    this._optoutOverride = options?.enable === false

    this._retryOptions = {
      retryCount: options?.fetchRetryCount ?? 3,
      retryDelay: options?.fetchRetryDelay ?? 3000,
      retryCheck: isPostHogFetchError,
    }
    this.requestTimeout = options?.requestTimeout ?? 10000 // 10 seconds
    this.disableGeoip = options?.disableGeoip ?? true
    // Init promise allows the derived class to block calls until it is ready
    this._initPromise = Promise.resolve()
  }

  protected getCommonEventProperties(): any {
    return {
      $lib: this.getLibraryId(),
      $lib_version: this.getLibraryVersion(),
    }
  }

  public get optedOut(): boolean {
    return this.getPersistedProperty(PostHogPersistedProperty.OptedOut) ?? this._optoutOverride ?? false
  }

  async optIn(): Promise<void> {
    await this._initPromise
    this.setPersistedProperty(PostHogPersistedProperty.OptedOut, false)
  }

  async optOut(): Promise<void> {
    await this._initPromise
    this.setPersistedProperty(PostHogPersistedProperty.OptedOut, true)
  }

  on(event: string, cb: (...args: any[]) => void): () => void {
    return this._events.on(event, cb)
  }

  debug(enabled: boolean = true): void {
    this.removeDebugCallback?.()

    this.debugMode = enabled

    if (enabled) {
      this.removeDebugCallback = this.on('*', (event, payload) => console.log('PostHog Debug', event, payload))
    }
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
  protected async identifyStateless(
    distinctId: string,
    properties?: PostHogEventProperties,
    options?: PostHogCaptureOptions
  ): Promise<void> {
    await this._initPromise

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
  }

  protected async captureStateless(
    distinctId: string,
    event: string,
    properties?: { [key: string]: any },
    options?: PostHogCaptureOptions
  ): Promise<void> {
    await this._initPromise
    const payload = this.buildPayload({ distinct_id: distinctId, event, properties })
    this.enqueue('capture', payload, options)
  }

  protected async aliasStateless(
    alias: string,
    distinctId: string,
    properties?: { [key: string]: any },
    options?: PostHogCaptureOptions
  ): Promise<void> {
    await this._initPromise

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
  }

  /***
   *** GROUPS
   ***/
  protected async groupIdentifyStateless(
    groupType: string,
    groupKey: string | number,
    groupProperties?: PostHogEventProperties,
    options?: PostHogCaptureOptions,
    distinctId?: string,
    eventProperties?: PostHogEventProperties
  ): Promise<void> {
    await this._initPromise

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
  protected async enqueue(type: string, _message: any, options?: PostHogCaptureOptions): Promise<void> {
    await this._initPromise

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
  }

  async flushAsync(): Promise<any> {
    await this._initPromise

    return new Promise((resolve, reject) => {
      this.flush((err, data) => {
        return err ? reject(err) : resolve(data)
      })
    })
  }

  async flush(callback?: (err?: any, data?: any) => void): Promise<void> {
    await this._initPromise

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

  constructor(apiKey: string, options?: PosthogCoreOptions) {
    // Default for stateful mode is to not disable geoip. Only override if explicitly set
    const disableGeoipOption = options?.disableGeoip ?? false

    super(apiKey, { ...options, disableGeoip: disableGeoipOption })

    this.sendFeatureFlagEvent = options?.sendFeatureFlagEvent ?? true
    this._sessionExpirationTimeSeconds = options?.sessionExpirationTimeSeconds ?? 1800 // 30 minutes
  }

  protected async setupBootstrap(options?: Partial<PosthogCoreOptions>): Promise<void> {
    await this._initPromise

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

  async reset(propertiesToKeep?: PostHogPersistedProperty[]): Promise<void> {
    await this._initPromise

    const allPropertiesToKeep = [PostHogPersistedProperty.Queue, ...(propertiesToKeep || [])]

    // clean up props
    this.clearProps()

    for (const key of <(keyof typeof PostHogPersistedProperty)[]>Object.keys(PostHogPersistedProperty)) {
      if (!allPropertiesToKeep.includes(PostHogPersistedProperty[key])) {
        this.setPersistedProperty((PostHogPersistedProperty as any)[key], null)
      }
    }
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

  getSessionId(): string | undefined {
    // TODO: What to do about the _initPromise?

    let sessionId = this.getPersistedProperty<string>(PostHogPersistedProperty.SessionId)
    const sessionTimestamp = this.getPersistedProperty<number>(PostHogPersistedProperty.SessionLastTimestamp) || 0
    if (!sessionId || Date.now() - sessionTimestamp > this._sessionExpirationTimeSeconds * 1000) {
      sessionId = uuidv7()
      this.setPersistedProperty(PostHogPersistedProperty.SessionId, sessionId)
    }
    this.setPersistedProperty(PostHogPersistedProperty.SessionLastTimestamp, Date.now())

    return sessionId
  }

  async resetSessionId(): Promise<void> {
    await this._initPromise
    this.setPersistedProperty(PostHogPersistedProperty.SessionId, null)
  }

  getAnonymousId(): string {
    // TODO: What to do about the _initPromise?

    let anonId = this.getPersistedProperty<string>(PostHogPersistedProperty.AnonymousId)
    if (!anonId) {
      anonId = uuidv7()
      this.setPersistedProperty(PostHogPersistedProperty.AnonymousId, anonId)
    }
    return anonId
  }

  getDistinctId(): string {
    // TODO: What to do about the _initPromise?

    return this.getPersistedProperty<string>(PostHogPersistedProperty.DistinctId) || this.getAnonymousId()
  }

  async unregister(property: string): Promise<void> {
    await this._initPromise
    delete this.props[property]
    this.setPersistedProperty<PostHogEventProperties>(PostHogPersistedProperty.Props, this.props)
  }

  async register(properties: { [key: string]: any }): Promise<void> {
    await this._initPromise

    this.props = {
      ...this.props,
      ...properties,
    }
    this.setPersistedProperty<PostHogEventProperties>(PostHogPersistedProperty.Props, this.props)
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
  async identify(
    distinctId?: string,
    properties?: PostHogEventProperties,
    options?: PostHogCaptureOptions
  ): Promise<void> {
    await this._initPromise

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
  }

  async capture(event: string, properties?: { [key: string]: any }, options?: PostHogCaptureOptions): Promise<void> {
    await this._initPromise

    const distinctId = this.getDistinctId()

    if (properties?.$groups) {
      this.groups(properties.$groups)
    }

    const allProperties = this.enrichProperties(properties)

    super.captureStateless(distinctId, event, allProperties, options)
  }

  async alias(alias: string): Promise<void> {
    const distinctId = this.getDistinctId()
    const allProperties = this.enrichProperties({})

    super.aliasStateless(alias, distinctId, allProperties)
  }

  async autocapture(
    eventType: string,
    elements: PostHogAutocaptureElement[],
    properties: PostHogEventProperties = {},
    options?: PostHogCaptureOptions
  ): Promise<void> {
    await this._initPromise

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
  }

  /***
   *** GROUPS
   ***/

  async groups(groups: { [type: string]: string | number }): Promise<void> {
    await this._initPromise

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
  }

  async group(
    groupType: string,
    groupKey: string | number,
    groupProperties?: PostHogEventProperties,
    options?: PostHogCaptureOptions
  ): Promise<void> {
    await this._initPromise

    this.groups({
      [groupType]: groupKey,
    })

    if (groupProperties) {
      this.groupIdentify(groupType, groupKey, groupProperties, options)
    }
  }

  async groupIdentify(
    groupType: string,
    groupKey: string | number,
    groupProperties?: PostHogEventProperties,
    options?: PostHogCaptureOptions
  ): Promise<void> {
    await this._initPromise

    const distinctId = this.getDistinctId()
    const eventProperties = this.enrichProperties({})
    super.groupIdentifyStateless(groupType, groupKey, groupProperties, options, distinctId, eventProperties)
  }

  /***
   * PROPERTIES
   ***/
  async setPersonPropertiesForFlags(properties: { [type: string]: string }): Promise<void> {
    await this._initPromise

    // Get persisted person properties
    const existingProperties =
      this.getPersistedProperty<Record<string, string>>(PostHogPersistedProperty.PersonProperties) || {}

    this.setPersistedProperty<PostHogEventProperties>(PostHogPersistedProperty.PersonProperties, {
      ...existingProperties,
      ...properties,
    })
  }

  async resetPersonPropertiesForFlags(): Promise<void> {
    await this._initPromise
    this.setPersistedProperty<PostHogEventProperties>(PostHogPersistedProperty.PersonProperties, {})
  }

  /** @deprecated - Renamed to setPersonPropertiesForFlags */
  async personProperties(properties: { [type: string]: string }): Promise<void> {
    await this._initPromise
    return this.setPersonPropertiesForFlags(properties)
  }

  async setGroupPropertiesForFlags(properties: { [type: string]: Record<string, string> }): Promise<void> {
    await this._initPromise

    // Get persisted group properties
    const existingProperties =
      this.getPersistedProperty<Record<string, Record<string, string>>>(PostHogPersistedProperty.GroupProperties) || {}

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
  }

  async resetGroupPropertiesForFlags(): Promise<void> {
    await this._initPromise

    this.setPersistedProperty<PostHogEventProperties>(PostHogPersistedProperty.GroupProperties, {})
  }

  /** @deprecated - Renamed to setGroupPropertiesForFlags */
  async groupProperties(properties: { [type: string]: Record<string, string> }): Promise<void> {
    await this._initPromise

    return this.setGroupPropertiesForFlags(properties)
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
    await this._initPromise

    const distinctId = this.getDistinctId()
    const groups = this.props.$groups || {}
    const personProperties =
      this.getPersistedProperty<Record<string, string>>(PostHogPersistedProperty.PersonProperties) || {}
    const groupProperties =
      this.getPersistedProperty<Record<string, Record<string, string>>>(PostHogPersistedProperty.GroupProperties) || {}

    const extraProperties = {
      $anon_distinct_id: sendAnonDistinctId ? this.getAnonymousId() : undefined,
    }

    this._decideResponsePromise = super
      .getDecide(distinctId, groups, personProperties, groupProperties, extraProperties)
      .then((res) => {
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
      .finally(() => {
        this._decideResponsePromise = undefined
      })
    return this._decideResponsePromise
  }

  private setKnownFeatureFlags(featureFlags: PostHogDecideResponse['featureFlags']): void {
    this.setPersistedProperty<PostHogDecideResponse['featureFlags']>(
      PostHogPersistedProperty.FeatureFlags,
      featureFlags
    )
    this._events.emit('featureflags', featureFlags)
  }

  private setKnownFeatureFlagPayloads(featureFlagPayloads: PostHogDecideResponse['featureFlagPayloads']): void {
    this.setPersistedProperty<PostHogDecideResponse['featureFlagPayloads']>(
      PostHogPersistedProperty.FeatureFlagPayloads,
      featureFlagPayloads
    )
  }

  async getFeatureFlag(key: string): Promise<boolean | string | undefined> {
    await this._initPromise

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

  async getFeatureFlagPayload(key: string): Promise<JsonType | undefined> {
    await this._initPromise

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

  async getFeatureFlagPayloads(): Promise<PostHogDecideResponse['featureFlagPayloads'] | undefined> {
    await this._initPromise

    const payloads = this.getPersistedProperty<PostHogDecideResponse['featureFlagPayloads']>(
      PostHogPersistedProperty.FeatureFlagPayloads
    )
    if (payloads) {
      return Object.fromEntries(Object.entries(payloads).map(([k, v]) => [k, this._parsePayload(v)]))
    }
    return payloads
  }

  async getFeatureFlags(): Promise<PostHogDecideResponse['featureFlags'] | undefined> {
    await this._initPromise

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

  async getFeatureFlagsAndPayloads(): Promise<{
    flags: PostHogDecideResponse['featureFlags'] | undefined
    payloads: PostHogDecideResponse['featureFlagPayloads'] | undefined
  }> {
    await this._initPromise

    const flags = await this.getFeatureFlags()
    const payloads = await this.getFeatureFlagPayloads()

    return {
      flags,
      payloads,
    }
  }

  async isFeatureEnabled(key: string): Promise<boolean | undefined> {
    await this._initPromise

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
    await this._initPromise
    return (await this.decideAsync(sendAnonDistinctId))?.featureFlags
  }

  onFeatureFlags(cb: (flags: PostHogDecideResponse['featureFlags']) => void): () => void {
    return this.on('featureflags', async () => {
      const flags = await this.getFeatureFlags()
      if (flags) {
        cb(flags)
      }
    })
  }

  onFeatureFlag(key: string, cb: (value: string | boolean) => void): () => void {
    return this.on('featureflags', async () => {
      const flagResponse = await this.getFeatureFlag(key)
      if (flagResponse !== undefined) {
        cb(flagResponse)
      }
    })
  }

  async overrideFeatureFlag(flags: PostHogDecideResponse['featureFlags'] | null): Promise<void> {
    await this._initPromise

    if (flags === null) {
      return this.setPersistedProperty(PostHogPersistedProperty.OverrideFeatureFlags, null)
    }
    return this.setPersistedProperty(PostHogPersistedProperty.OverrideFeatureFlags, flags)
  }
}

export * from './types'
export { LZString }

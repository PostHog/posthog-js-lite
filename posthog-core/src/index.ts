import {
  PostHogFetchOptions,
  PostHogFetchResponse,
  PostHogQueueItem,
  PostHogAutocaptureElement,
  PostHogDecideResponse,
  PosthogCoreOptions,
  PostHogEventProperties,
  PostHogPersistedProperty,
} from './types'
import {
  assert,
  currentISOTime,
  currentTimestamp,
  generateUUID,
  removeTrailingSlash,
  retriable,
  RetriableOptions,
  safeSetTimeout,
} from './utils'
export * as utils from './utils'
import { LZString } from './lz-string'
import { SimpleEventEmitter } from './eventemitter'

export abstract class PostHogCore {
  // options
  private apiKey: string
  private host: string
  private flushAt: number
  private flushInterval: number
  private captureMode: 'form' | 'json'
  private sendFeatureFlagEvent: boolean
  private flagCallReported: { [key: string]: boolean } = {}
  private removeDebugCallback?: () => void

  // internal
  protected _events = new SimpleEventEmitter()
  protected _flushTimer?: any
  protected _decideResponsePromise?: Promise<PostHogDecideResponse>
  protected _retryOptions: RetriableOptions
  protected _sessionExpirationTimeSeconds: number

  // Abstract methods to be overridden by implementations
  abstract fetch(url: string, options: PostHogFetchOptions): Promise<PostHogFetchResponse>
  abstract getLibraryId(): string
  abstract getLibraryVersion(): string
  abstract getCustomUserAgent(): string | void

  // This is our abstracted storage. Each implementation should handle its own
  abstract getPersistedProperty<T>(key: PostHogPersistedProperty): T | undefined
  abstract setPersistedProperty<T>(key: PostHogPersistedProperty, value: T | null): void

  private _optoutOverride: boolean | undefined

  constructor(apiKey: string, options?: PosthogCoreOptions) {
    assert(apiKey, "You must pass your PostHog project's api key.")

    this.apiKey = apiKey
    this.host = removeTrailingSlash(options?.host || 'https://app.posthog.com')
    this.flushAt = options?.flushAt ? Math.max(options?.flushAt, 1) : 20
    this.flushInterval = options?.flushInterval ?? 10000
    this.captureMode = options?.captureMode || 'form'
    this.sendFeatureFlagEvent = options?.sendFeatureFlagEvent ?? true
    // If enable is explicitly set to false we override the optout
    this._optoutOverride = options?.enable === false
    this._retryOptions = {
      retryCount: options?.fetchRetryCount ?? 3,
      retryDelay: options?.fetchRetryDelay ?? 3000,
    }
    this._sessionExpirationTimeSeconds = options?.sessionExpirationTimeSeconds ?? 1800 // 30 minutes

    // NOTE: It is important we don't initiate anything in the constructor as some async IO may still be underway on the parent
    if (options?.preloadFeatureFlags !== false) {
      safeSetTimeout(() => {
        void this.reloadFeatureFlagsAsync()
      }, 1)
    }
  }

  protected getCommonEventProperties(): any {
    const featureFlags = this.getFeatureFlags()
    return {
      $lib: this.getLibraryId(),
      $lib_version: this.getLibraryVersion(),
      $active_feature_flags: featureFlags ? Object.keys(featureFlags) : undefined,
      $enabled_feature_flags: featureFlags,
    }
  }

  // NOTE: Props are lazy loaded from localstorage hence the complex getter setter logic
  private get props(): PostHogEventProperties {
    if (!this._props) {
      this._props = this.getPersistedProperty<PostHogEventProperties>(PostHogPersistedProperty.Props)
    }
    return this._props || {}
  }

  private set props(val: PostHogEventProperties) {
    this._props = val
  }

  private _props: PostHogEventProperties | undefined

  public get optedOut(): boolean {
    return this.getPersistedProperty(PostHogPersistedProperty.OptedOut) ?? this._optoutOverride ?? false
  }

  optIn(): void {
    this.setPersistedProperty(PostHogPersistedProperty.OptedOut, false)
  }

  optOut(): void {
    this.setPersistedProperty(PostHogPersistedProperty.OptedOut, true)
  }

  on(event: string, cb: (...args: any[]) => void): () => void {
    return this._events.on(event, cb)
  }

  reset(): void {
    for (const key in PostHogPersistedProperty) {
      this.setPersistedProperty((PostHogPersistedProperty as any)[key], null)
    }
  }

  debug(enabled: boolean = true): void {
    this.removeDebugCallback?.()

    if (enabled) {
      this.removeDebugCallback = this.on('*', (event, payload) => console.log('PostHog Debug', event, payload))
    }
  }

  private buildPayload(payload: { event: string; properties?: PostHogEventProperties; distinct_id?: string }): any {
    return {
      distinct_id: payload.distinct_id || this.getDistinctId(),
      event: payload.event,
      properties: {
        ...this.props, // Persisted properties first
        ...(payload.properties || {}), // Followed by user specified properties
        ...this.getCommonEventProperties(), // Followed by common PH props
        $session_id: this.getSessionId(),
      },
    }
  }

  getSessionId(): string | undefined {
    let sessionId = this.getPersistedProperty<string>(PostHogPersistedProperty.SessionId)
    const sessionTimestamp = this.getPersistedProperty<number>(PostHogPersistedProperty.SessionLastTimestamp) || 0
    if (!sessionId || Date.now() - sessionTimestamp > this._sessionExpirationTimeSeconds * 1000) {
      sessionId = generateUUID(globalThis)
      this.setPersistedProperty(PostHogPersistedProperty.SessionId, sessionId)
    }
    this.setPersistedProperty(PostHogPersistedProperty.SessionLastTimestamp, Date.now())

    return sessionId
  }

  resetSessionId(): void {
    this.setPersistedProperty(PostHogPersistedProperty.SessionId, null)
  }

  getAnonymousId(): string {
    let anonId = this.getPersistedProperty<string>(PostHogPersistedProperty.AnonymousId)
    if (!anonId) {
      anonId = generateUUID(globalThis)
      this.setPersistedProperty(PostHogPersistedProperty.AnonymousId, anonId)
    }
    return anonId
  }

  getDistinctId(): string {
    return this.getPersistedProperty<string>(PostHogPersistedProperty.DistinctId) || this.getAnonymousId()
  }

  register(properties: { [key: string]: any }): void {
    this.props = {
      ...this.props,
      ...properties,
    }
    this.setPersistedProperty<PostHogEventProperties>(PostHogPersistedProperty.Props, this.props)
  }

  unregister(property: string): void {
    delete this.props[property]
    this.setPersistedProperty<PostHogEventProperties>(PostHogPersistedProperty.Props, this.props)
  }

  /***
   *** TRACKING
   ***/
  identify(distinctId?: string, properties?: PostHogEventProperties): this {
    const previousDistinctId = this.getDistinctId()
    distinctId = distinctId || previousDistinctId

    if (properties?.$groups) {
      this.groups(properties.$groups)
    }

    const payload = {
      ...this.buildPayload({
        distinct_id: distinctId,
        event: '$identify',
        properties: {
          ...(properties || {}),
          $anon_distinct_id: this.getAnonymousId(),
        },
      }),
      $set: properties,
    }

    if (distinctId !== previousDistinctId) {
      // We keep the AnonymousId to be used by decide calls and identify to link the previousId
      this.setPersistedProperty(PostHogPersistedProperty.AnonymousId, previousDistinctId)
      this.setPersistedProperty(PostHogPersistedProperty.DistinctId, distinctId)

      if (this.getFeatureFlags()) {
        void this.reloadFeatureFlagsAsync()
      }
    }

    this.enqueue('identify', payload)
    return this
  }

  capture(event: string, properties?: { [key: string]: any }): this {
    if (properties?.$groups) {
      this.groups(properties.$groups)
    }

    const payload = this.buildPayload({ event, properties })
    this.enqueue('capture', payload)
    return this
  }

  alias(alias: string): this {
    const distinctId = this.getDistinctId()

    const payload = this.buildPayload({
      event: '$create_alias',
      properties: {
        distinct_id: distinctId,
        alias,
      },
    })

    this.enqueue('alias', payload)
    return this
  }

  autocapture(eventType: string, elements: PostHogAutocaptureElement[], properties: PostHogEventProperties = {}): this {
    const payload = this.buildPayload({
      event: '$autocapture',
      properties: {
        ...properties,
        $event_type: eventType,
        $elements: elements,
      },
    })

    this.enqueue('autocapture', payload)
    return this
  }

  /***
   *** GROUPS
   ***/

  groups(groups: { [type: string]: string | number }): this {
    // Get persisted groups
    const existingGroups = this.props.$groups || {}

    // NOTE: Should we do the same for groups listed in identify / capture?
    this.register({
      $groups: {
        ...existingGroups,
        ...groups,
      },
    })

    if (Object.keys(groups).find((type) => existingGroups[type] !== groups[type]) && this.getFeatureFlags()) {
      void this.reloadFeatureFlagsAsync()
    }

    return this
  }

  group(groupType: string, groupKey: string | number, groupProperties?: PostHogEventProperties): this {
    this.groups({
      [groupType]: groupKey,
    })

    if (groupProperties) {
      this.groupIdentify(groupType, groupKey, groupProperties)
    }

    return this
  }

  groupIdentify(groupType: string, groupKey: string | number, groupProperties?: PostHogEventProperties): this {
    const payload = {
      event: '$groupidentify',
      distinctId: `$${groupType}_${groupKey}`,
      properties: {
        $group_type: groupType,
        $group_key: groupKey,
        $group_set: groupProperties || {},
        ...this.getCommonEventProperties(),
      },
    }

    this.enqueue('capture', payload)
    return this
  }

  /***
   *** FEATURE FLAGS
   ***/
  private decideAsync(): Promise<PostHogDecideResponse> {
    if (this._decideResponsePromise) {
      return this._decideResponsePromise
    }
    return this._decideAsync()
  }

  private async _decideAsync(): Promise<PostHogDecideResponse> {
    const url = `${this.host}/decide/?v=2`

    const distinctId = this.getDistinctId()
    const groups = this.props.$groups || {}

    const fetchOptions: PostHogFetchOptions = {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        token: this.apiKey,
        distinct_id: distinctId,
        $anon_distinct_id: this.getAnonymousId(),
        groups,
      }),
    }

    this._decideResponsePromise = this.fetchWithRetry(url, fetchOptions)
      .then((r) => r.json() as Promise<PostHogDecideResponse>)
      .then((res) => {
        if (res.featureFlags) {
          this.setPersistedProperty<PostHogDecideResponse['featureFlags']>(
            PostHogPersistedProperty.FeatureFlags,
            res.featureFlags
          )
          this._events.emit('featureflags', res.featureFlags)
        }

        return res
      })
      .finally(() => {
        this._decideResponsePromise = undefined
      })
    return this._decideResponsePromise
  }

  getFeatureFlag(key: string, defaultResult: string | boolean = false): boolean | string | undefined {
    const featureFlags = this.getFeatureFlags()

    if (!featureFlags) {
      // If we haven't loaded flags yet we respond undefined to indicate this
      return undefined
    }

    if (this.sendFeatureFlagEvent && !this.flagCallReported[key]) {
      this.flagCallReported[key] = true
      this.capture('$feature_flag_called', {
        $feature_flag: key,
        $feature_flag_response: featureFlags[key],
      })
    }

    // If we have flags we either return the value (true or string) or the defaultResult
    return featureFlags[key] ?? defaultResult
  }

  getFeatureFlags(): PostHogDecideResponse['featureFlags'] | undefined {
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

  isFeatureEnabled(key: string, defaultResult: boolean = false): boolean {
    const flag = this.getFeatureFlag(key, defaultResult) ?? defaultResult
    return !!flag
  }

  async reloadFeatureFlagsAsync(): Promise<PostHogDecideResponse['featureFlags']> {
    return (await this.decideAsync()).featureFlags
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

  overrideFeatureFlag(flags: PostHogDecideResponse['featureFlags'] | null): void {
    if (flags === null) {
      return this.setPersistedProperty(PostHogPersistedProperty.OverrideFeatureFlags, null)
    }
    return this.setPersistedProperty(PostHogPersistedProperty.OverrideFeatureFlags, flags)
  }

  /***
   *** QUEUEING AND FLUSHING
   ***/
  private enqueue(type: string, _message: any): void {
    if (this.optedOut) {
      return
    }
    const message = {
      ..._message,
      type: type,
      library: this.getLibraryId(),
      library_version: this.getLibraryVersion(),
      timestamp: _message.timestamp ? _message.timestamp : currentISOTime(),
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

  flushAsync(): Promise<any> {
    return new Promise((resolve, reject) => {
      this.flush((err, data) => (err ? reject(err) : resolve(data)))
    })
  }

  flush(callback?: (err?: any, data?: any) => void): void {
    if (this.optedOut) {
      return callback && safeSetTimeout(callback, 0)
    }

    if (this._flushTimer) {
      clearTimeout(this._flushTimer)
      this._flushTimer = null
    }

    const queue = this.getPersistedProperty<PostHogQueueItem[]>(PostHogPersistedProperty.Queue) || []

    if (!queue.length) {
      return callback && safeSetTimeout(callback, 0)
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

    this.fetchWithRetry(url, fetchOptions)
      .then(() => done())
      .catch((err) => {
        if (err.response) {
          const error = new Error(err.response.statusText)
          return done(error)
        }

        done(err)
      })
  }

  private async fetchWithRetry(
    url: string,
    options: PostHogFetchOptions,
    retryOptions?: RetriableOptions
  ): Promise<PostHogFetchResponse> {
    return retriable(() => this.fetch(url, options), retryOptions || this._retryOptions)
  }

  async shutdownAsync(): Promise<void> {
    clearTimeout(this._flushTimer)
    await this.flushAsync()
  }

  shutdown(): void {
    void this.shutdownAsync()
  }
}

export * from './types'
export { LZString }

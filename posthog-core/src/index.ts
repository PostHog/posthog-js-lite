import {
  PostHogFetchOptions,
  PostHogFetchResponse,
  PostHogQueueItem,
  PostHogAutocaptureElement,
  PostHogDecideResponse,
  PosthogCoreOptions,
  PostHogEventProperties,
  PostHogPersistedProperty,
  PosthogCaptureOptions,
  JsonType,
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

export abstract class PostHogCoreStateless {
  // options
  private apiKey: string
  host: string
  private flushAt: number
  private flushInterval: number
  private requestTimeout: number
  private captureMode: 'form' | 'json'
  private removeDebugCallback?: () => void

  private _optoutOverride: boolean | undefined

  // internal
  protected _events = new SimpleEventEmitter()
  protected _flushTimer?: any
  // protected _decideResponsePromise?: Promise<PostHogDecideResponse>
  protected _retryOptions: RetriableOptions

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
    }
    this.requestTimeout = options?.requestTimeout ?? 10000 // 10 seconds
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

  optIn(): void {
    this.setPersistedProperty(PostHogPersistedProperty.OptedOut, false)
  }

  optOut(): void {
    this.setPersistedProperty(PostHogPersistedProperty.OptedOut, true)
  }

  on(event: string, cb: (...args: any[]) => void): () => void {
    return this._events.on(event, cb)
  }

  debug(enabled: boolean = true): void {
    this.removeDebugCallback?.()

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

  /***
   *** TRACKING
   ***/
  identifyStateless(distinctId: string, properties?: PostHogEventProperties, options?: PosthogCaptureOptions): this {
    // This identify doesn't add anything to set, you have to do it yourself!
    const payload = {
      ...this.buildPayload({
        distinct_id: distinctId,
        event: '$identify',
        properties,
      }),
    }

    this.enqueue('identify', payload, options)
    return this
  }

  captureStateless(
    distinctId: string,
    event: string,
    properties?: { [key: string]: any },
    options?: PosthogCaptureOptions
  ): this {
    const payload = this.buildPayload({ distinct_id: distinctId, event, properties })
    this.enqueue('capture', payload, options)

    return this
  }

  aliasStateless(alias: string, distinctId: string, properties?: { [key: string]: any }): this {
    const payload = this.buildPayload({
      event: '$create_alias',
      distinct_id: distinctId,
      properties: {
        ...(properties || {}),
        distinct_id: distinctId,
        alias,
      },
    })

    this.enqueue('alias', payload)
    return this
  }

  /***
   *** GROUPS
   ***/
  groupIdentifyStateless(
    groupType: string,
    groupKey: string | number,
    groupProperties?: PostHogEventProperties,
    options?: PosthogCaptureOptions,
    distinctId?: string,
    eventProperties?: PostHogEventProperties
  ): this {
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
    return this
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
        console.error('Error fetching feature flags', error)
        return undefined
      })
  }

  // Probably the core shouldn't implement getFeatureFlag, because it's a responsibility of the inheritor to determine what to do around this?
  // like sending feature_flag_called events.
  // and async vs non-async in stateful core
  async getFeatureFlagStateless(
    key: string,
    distinctId: string,
    groups: Record<string, string> = {},
    personProperties: Record<string, string> = {},
    groupProperties: Record<string, Record<string, string>> = {}
  ): Promise<boolean | string | undefined> {
    const featureFlags = await this.getFeatureFlagsStateless(distinctId, groups, personProperties, groupProperties)

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

  async getFeatureFlagPayloadStateless(
    key: string,
    distinctId: string,
    groups: Record<string, string> = {},
    personProperties: Record<string, string> = {},
    groupProperties: Record<string, Record<string, string>> = {}
  ): Promise<JsonType | undefined> {
    const payloads = await this.getFeatureFlagPayloadsStateless(distinctId, groups, personProperties, groupProperties)

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

  async getFeatureFlagPayloadsStateless(
    distinctId: string,
    groups: Record<string, string> = {},
    personProperties: Record<string, string> = {},
    groupProperties: Record<string, Record<string, string>> = {}
  ): Promise<PostHogDecideResponse['featureFlagPayloads'] | undefined> {
    const payloads = (
      await this.getFeatureFlagsAndPayloadsStateless(distinctId, groups, personProperties, groupProperties)
    ).payloads

    if (payloads) {
      return Object.fromEntries(Object.entries(payloads).map(([k, v]) => [k, this._parsePayload(v)]))
    }
    return payloads
  }

  _parsePayload(response: any): any {
    try {
      return JSON.parse(response)
    } catch {
      return response
    }
  }

  async getFeatureFlagsStateless(
    distinctId: string,
    groups: Record<string, string | number> = {},
    personProperties: Record<string, string> = {},
    groupProperties: Record<string, Record<string, string>> = {}
  ): Promise<PostHogDecideResponse['featureFlags'] | undefined> {
    return (await this.getFeatureFlagsAndPayloadsStateless(distinctId, groups, personProperties, groupProperties)).flags
  }

  async getFeatureFlagsAndPayloadsStateless(
    distinctId: string,
    groups: Record<string, string | number> = {},
    personProperties: Record<string, string> = {},
    groupProperties: Record<string, Record<string, string>> = {}
  ): Promise<{
    flags: PostHogDecideResponse['featureFlags'] | undefined
    payloads: PostHogDecideResponse['featureFlagPayloads'] | undefined
  }> {
    const decideResponse = await this.getDecide(distinctId, groups, personProperties, groupProperties)

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
  protected enqueue(type: string, _message: any, options?: PosthogCaptureOptions): void {
    if (this.optedOut) {
      this._events.emit(type, `Library is disabled. Not sending event. To re-enable, call posthog.enable()`)
      return
    }

    const message = {
      ..._message,
      type: type,
      library: this.getLibraryId(),
      library_version: this.getLibraryVersion(),
      timestamp: options?.timestamp ? options?.timestamp : currentISOTime(),
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
      this.flush((err, data) => {
        return err ? reject(err) : resolve(data)
      })
    })
  }

  flush(callback?: (err?: any, data?: any) => void): void {
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
    ;(AbortSignal as any).timeout ??= function timeout(ms: number) {
      const ctrl = new AbortController()
      setTimeout(() => ctrl.abort(), ms)
      return ctrl.signal
    }

    return retriable(
      () =>
        this.fetch(url, {
          signal: (AbortSignal as any).timeout(this.requestTimeout),
          ...options,
        }),
      retryOptions || this._retryOptions
    )
  }

  async shutdownAsync(): Promise<void> {
    clearTimeout(this._flushTimer)
    await this.flushAsync()
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

  constructor(apiKey: string, options?: PosthogCoreOptions) {
    super(apiKey, options)

    this.sendFeatureFlagEvent = options?.sendFeatureFlagEvent ?? true
    this._sessionExpirationTimeSeconds = options?.sessionExpirationTimeSeconds ?? 1800 // 30 minutes

    // NOTE: It is important we don't initiate anything in the constructor as some async IO may still be underway on the parent
    if (options?.preloadFeatureFlags !== false) {
      safeSetTimeout(() => {
        this.reloadFeatureFlags()
      }, 1)
    }
  }

  protected setupBootstrap(options?: Partial<PosthogCoreOptions>): void {
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
  }

  private _props: PostHogEventProperties | undefined

  on(event: string, cb: (...args: any[]) => void): () => void {
    return this._events.on(event, cb)
  }

  reset(propertiesToKeep?: PostHogPersistedProperty[]): void {
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
      ...(properties || {}), // Followed by user specified properties
      ...this.getCommonEventProperties(), // Followed by FF props
      $session_id: this.getSessionId(),
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

  private checkForOptOut(): boolean {
    return this.optedOut
  }

  /***
   *** TRACKING
   ***/
  identify(distinctId?: string, properties?: PostHogEventProperties, options?: PosthogCaptureOptions): this {
    if (this.checkForOptOut()) {
      return this
    }

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

      if (this.getFeatureFlags()) {
        this.reloadFeatureFlags()
      }
    }

    super.identifyStateless(distinctId, allProperties, options)

    return this
  }

  capture(event: string, properties?: { [key: string]: any }, options?: PosthogCaptureOptions): this {
    if (this.checkForOptOut()) {
      return this
    }

    const distinctId = this.getDistinctId()

    if (properties?.$groups) {
      this.groups(properties.$groups)
    }

    const allProperties = this.enrichProperties(properties)

    super.captureStateless(distinctId, event, allProperties, options)

    return this
  }

  alias(alias: string): this {
    if (this.checkForOptOut()) {
      return this
    }

    const distinctId = this.getDistinctId()

    const allProperties = this.enrichProperties({})

    super.aliasStateless(alias, distinctId, allProperties)
    return this
  }

  autocapture(
    eventType: string,
    elements: PostHogAutocaptureElement[],
    properties: PostHogEventProperties = {},
    options?: PosthogCaptureOptions
  ): this {
    if (this.checkForOptOut()) {
      return this
    }

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
    return this
  }

  /***
   *** GROUPS
   ***/

  groups(groups: { [type: string]: string | number }): this {
    // Get persisted groups
    const existingGroups = this.props.$groups || {}

    this.register({
      $groups: {
        ...existingGroups,
        ...groups,
      },
    })

    if (Object.keys(groups).find((type) => existingGroups[type] !== groups[type]) && this.getFeatureFlags()) {
      this.reloadFeatureFlags()
    }

    return this
  }

  group(
    groupType: string,
    groupKey: string | number,
    groupProperties?: PostHogEventProperties,
    options?: PosthogCaptureOptions
  ): this {
    this.groups({
      [groupType]: groupKey,
    })

    if (groupProperties) {
      this.groupIdentify(groupType, groupKey, groupProperties, options)
    }

    return this
  }

  groupIdentify(
    groupType: string,
    groupKey: string | number,
    groupProperties?: PostHogEventProperties,
    options?: PosthogCaptureOptions
  ): this {
    if (this.checkForOptOut()) {
      return this
    }

    const distinctId = this.getDistinctId()

    const eventProperties = this.enrichProperties({})

    super.groupIdentifyStateless(groupType, groupKey, groupProperties, options, distinctId, eventProperties)

    return this
  }

  /***
   * PROPERTIES
   ***/
  personProperties(properties: { [type: string]: string }): this {
    // Get persisted person properties
    const existingProperties =
      this.getPersistedProperty<Record<string, string>>(PostHogPersistedProperty.PersonProperties) || {}

    this.setPersistedProperty<PostHogEventProperties>(PostHogPersistedProperty.PersonProperties, {
      ...existingProperties,
      ...properties,
    })

    return this
  }

  groupProperties(properties: { [type: string]: Record<string, string> }): this {
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
    return this
  }

  /***
   *** FEATURE FLAGS
   ***/
  private decideAsync(sendAnonDistinctId: boolean = true): Promise<PostHogDecideResponse | undefined> {
    if (this._decideResponsePromise) {
      return this._decideResponsePromise
    }
    return this._decideAsync(sendAnonDistinctId)
  }

  private async _decideAsync(sendAnonDistinctId: boolean = true): Promise<PostHogDecideResponse | undefined> {
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

  overrideFeatureFlag(flags: PostHogDecideResponse['featureFlags'] | null): void {
    if (flags === null) {
      return this.setPersistedProperty(PostHogPersistedProperty.OverrideFeatureFlags, null)
    }
    return this.setPersistedProperty(PostHogPersistedProperty.OverrideFeatureFlags, flags)
  }
}

export * from './types'
export { LZString }

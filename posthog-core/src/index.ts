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

  // internal
  private _events = new SimpleEventEmitter()
  private _queue: PostHogQueueItem[] = []
  private _flushTimer?: any
  private _decideResponsePromise?: Promise<PostHogDecideResponse>
  private _decideResponse?: PostHogDecideResponse
  private _decideTimer?: any
  private _decidePollInterval: number

  // Abstract methods to be overridden by implementations
  abstract fetch(url: string, options: PostHogFetchOptions): Promise<PostHogFetchResponse>
  abstract getLibraryId(): string
  abstract getLibraryVersion(): string
  abstract getCustomUserAgent(): string | void

  // This is our abstracted storage. Each implementation should handle its own
  abstract getPersistedProperty(key: PostHogPersistedProperty): string | undefined
  abstract setPersistedProperty(key: PostHogPersistedProperty, value: string): void

  public enabled = true

  constructor(apiKey: string, options?: PosthogCoreOptions) {
    assert(apiKey, "You must pass your PostHog project's api key.")

    this.apiKey = apiKey
    this.host = removeTrailingSlash(options?.host || 'https://app.posthog.com')
    this.flushAt = options?.flushAt ? Math.max(options?.flushAt, 1) : 20
    this.flushInterval = options?.flushInterval ?? 10000
    this.captureMode = options?.captureMode || 'form'
    this.sendFeatureFlagEvent = options?.sendFeatureFlagEvent ?? true
    this._decidePollInterval = Math.max(0, options?.decidePollInterval ?? 30000)

    // NOTE: It is important we don't initiate anything in the constructor as some async IO may still be underway on the parent
    if (options?.preloadFeatureFlags !== false) {
      setTimeout(() => {
        void this.reloadFeatureFlagsAsync()
      }, 1)
    }
  }

  protected getCommonEventProperties(): any {
    const featueFlags = this.getFeatureFlags()
    return {
      $lib: this.getLibraryId(),
      $lib_version: this.getLibraryVersion(),
      $active_feature_flags: featueFlags ? Object.keys(featueFlags) : undefined,
      $enabled_feature_flags: featueFlags,
    }
  }

  // NOTE: Props are lazy loaded from localstorage hence the complex getter setter logic
  private get props() {
    if (!this._props) {
      this._props = JSON.parse(this.getPersistedProperty(PostHogPersistedProperty.Props) || '{}')
    }
    return this._props || {}
  }

  private set props(val: { [key: string]: any }) {
    this._props = val
  }

  private _props: { [key: string]: any } | undefined

  enable() {
    this.enabled = true
  }

  disable() {
    this.enabled = false
  }

  on(event: string, cb: (e: any) => void) {
    return this._events.on(event, cb)
  }

  private buildPayload(payload: { event: string; properties?: PostHogEventProperties; distinct_id?: string }) {
    return {
      distinct_id: payload.distinct_id || this.getDistinctId(),
      event: payload.event,
      properties: {
        ...this.props, // Persisted properties first
        ...(payload.properties || {}), // Followed by user specified properties
        ...this.getCommonEventProperties(), // Followed by common PH props
      },
    }
  }

  getDistinctId(): string {
    let distinctId = this.getPersistedProperty(PostHogPersistedProperty.DistinctId)
    if (!distinctId) {
      distinctId = generateUUID(globalThis)
      this.setPersistedProperty(PostHogPersistedProperty.DistinctId, distinctId)
    }
    return distinctId
  }

  register(properties: { [key: string]: any }) {
    this.props = {
      ...this.props,
      ...properties,
    }
    this.setPersistedProperty(PostHogPersistedProperty.Props, JSON.stringify(this.props))
  }

  /***
   *** TRACKING
   ***/
  identify(distinctId?: string, properties?: PostHogEventProperties, callback?: () => void) {
    distinctId = distinctId || this.getDistinctId()

    if (properties?.$groups) {
      this.groups(properties.$groups)
    }

    const payload = {
      ...this.buildPayload({
        distinct_id: distinctId,
        event: '$identify',
        properties: {
          ...(properties || {}),
          $anon_distinct_id: this.getDistinctId(),
        },
      }),
      $set: properties,
    }

    if (distinctId !== this.getDistinctId()) {
      this.setPersistedProperty(PostHogPersistedProperty.DistinctId, distinctId)
    }

    this.enqueue('identify', payload, callback)
    return this
  }

  capture(event: string, properties?: { [key: string]: any }, callback?: () => void) {
    // NOTE: Legacy nodejs implementation uses groups
    if (properties && properties['groups']) {
      properties.$groups = properties.groups
      delete properties.groups
    }

    if (properties?.$groups) {
      this.groups(properties.$groups)
    }

    const payload = this.buildPayload({ event, properties })
    this.enqueue('capture', payload, callback)
    return this
  }

  alias(alias: string, callback?: () => void) {
    const distinctId = this.getDistinctId()

    const payload = this.buildPayload({
      event: '$create_alias',
      properties: {
        distinct_id: distinctId,
        alias,
      },
    })

    this.enqueue('alias', payload, callback)
    return this
  }

  autocapture(
    eventType: string,
    elements: PostHogAutocaptureElement[],
    properties?: PostHogEventProperties,
    callback?: () => void
  ) {
    const payload = this.buildPayload({
      event: '$autocapture',
      properties: {
        $event_type: eventType,
        $elements: elements,
      },
    })

    this.enqueue('autocapture', payload, callback)
    return this
  }

  /***
   *** GROUPS
   ***/

  groups(groups: { [type: string]: string }) {
    // Get persisted groups
    const existingGroups = this.props.$groups || {}

    // NOTE: Should we do the same for groups listed in identify / capture?
    this.register({
      $groups: {
        ...existingGroups,
        ...groups,
      },
    })

    if (Object.keys(groups).find((type) => existingGroups[type] !== groups[type]) && this._decideResponsePromise) {
      void this.reloadFeatureFlagsAsync()
    }
  }

  group(groupType: string, groupKey: string, groupProperties?: PostHogEventProperties) {
    this.groups({
      [groupType]: groupKey,
    })

    if (groupProperties) {
      this.groupIdentify(groupType, groupKey, groupProperties)
    }
  }

  groupIdentify(groupType: string, groupKey: string, groupProperties?: PostHogEventProperties, callback?: () => void) {
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

    this.enqueue('capture', payload, callback)
    return this
  }

  /***
   *** FEATUE FLAGS
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
      body: JSON.stringify({ groups, distinct_id: distinctId, token: this.apiKey }),
    }

    this._decideResponsePromise = this.fetchWithRetry(url, fetchOptions)
      .then((r) => r.json() as PostHogDecideResponse)
      .then((res) => {
        this._decideResponse = res

        if (res.featureFlags) {
          this.setPersistedProperty(PostHogPersistedProperty.FeatueFlags, JSON.stringify(res.featureFlags))
        }

        this._events.emit('featureflags', res.featureFlags)
        return res
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

  getFeatureFlags() {
    const persistedFlags = this.getPersistedProperty(PostHogPersistedProperty.FeatueFlags)

    return persistedFlags ? (JSON.parse(persistedFlags) as PostHogDecideResponse['featureFlags']) : undefined
  }

  isFeatureEnabled(key: string, defaultResult: boolean = false) {
    const flag = this.getFeatureFlag(key, defaultResult) ?? defaultResult
    return !!flag
  }

  async reloadFeatureFlagsAsync() {
    clearTimeout(this._decideTimer)
    this._decideTimer = setTimeout(() => this.reloadFeatureFlagsAsync(), this._decidePollInterval)
    this._decideResponsePromise = undefined
    return (await this.decideAsync()).featureFlags
  }

  // When listening to feature flags polling is active
  onFeatureFlags(cb: (flags: PostHogDecideResponse['featureFlags']) => void) {
    if (!this._decideTimer) void this.reloadFeatureFlagsAsync()

    return this.on('featureflags', async () => {
      const flags = this.getFeatureFlags()
      if (flags) cb(flags)
    })
  }

  /***
   *** QUEUEING AND FLUSHING
   ***/
  enqueue(type: string, _message: any, callback?: () => void) {
    if (!this.enabled) {
      return callback && safeSetTimeout(callback, 0)
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

    this._queue.push({ message, callback })
    this._events.emit(type, message)

    // Flush queued events if we meet the flushAt length
    if (this._queue.length >= this.flushAt) {
      this.flush()
    }

    if (this.flushInterval && !this._flushTimer) {
      this._flushTimer = setTimeout(() => this.flush(), this.flushInterval)
    }
  }

  flushAsync(): Promise<any> {
    return new Promise((resolve, reject) => {
      this.flush((err, data) => (err ? reject(err) : resolve(data)))
    })
  }

  flush(callback?: (err?: any, data?: any) => void) {
    if (!this.enabled) {
      return callback && safeSetTimeout(callback, 0)
    }

    if (this._flushTimer) {
      clearTimeout(this._flushTimer)
      this._flushTimer = null
    }

    if (!this._queue.length) {
      return callback && safeSetTimeout(callback, 0)
    }

    const items = this._queue.splice(0, this.flushAt)
    const callbacks = items.map((item) => item.callback)
    const messages = items.map((item) => item.message)

    const data = {
      api_key: this.apiKey,
      batch: messages,
      sent_at: currentISOTime(),
    }

    const done = (err?: any) => {
      callbacks.forEach((cb) => cb?.(err))
      callback?.(err, data)
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

  private async fetchWithRetry(url: string, options: PostHogFetchOptions): Promise<any> {
    // TODO: Enable retries
    return this.fetch(url, options)
    return retriable(() => this.fetch(url, options))
  }

  async shutdownAsync() {
    clearTimeout(this._decideTimer)
    clearTimeout(this._flushTimer)
    await this.flushAsync()
  }

  shutdown() {
    void this.shutdownAsync()
  }
}

export * from './types'
export { LZString }

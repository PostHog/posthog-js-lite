import {
  PostHogCore,
  PosthogCoreOptions,
  PostHogStorage,
  utils,
  PostHogFetchOptions,
  PostHogFetchResponse,
} from 'posthog-core'
// import { version } from '../package.json'
import { getContext } from './context'
import { localStore, cookieStore, sessionStorage } from './storage'

// TODO: Get this from package.json
const version = '2.0.0-alpha'

export interface PostHogWebOptions extends PosthogCoreOptions {
  autocapture?: boolean
}

const KEY_DISTINCT_ID = '@posthog:distinct_id'

export class PostHogWeb extends PostHogCore {
  private _cachedDistinctId?: string

  storage(): PostHogStorage {
    return localStore || sessionStorage || cookieStore
  }

  fetch(url: string, options: PostHogFetchOptions): Promise<PostHogFetchResponse> {
    return window.fetch(url, options)
  }
  setImmediate(fn: () => void): void {
    window.setTimeout(fn, 1)
  }
  getLibraryId(): string {
    return 'posthog-web'
  }
  getLibraryVersion(): string {
    return version
  }
  getCustomUserAgent(): void {
    return
  }

  getCommonEventProperties(): any {
    return {
      ...super.getCommonEventProperties(),
      ...getContext(window),
    }
  }

  getDistinctId(): string {
    if (!this._cachedDistinctId) {
      // TODO: Check and set local storage
      this._cachedDistinctId = this.storage().getItem(KEY_DISTINCT_ID) || utils.generateUUID(globalThis)
    }

    return this._cachedDistinctId
  }

  onSetDistinctId(newDistinctId: string): string {
    this._cachedDistinctId = newDistinctId
    this.storage().setItem(KEY_DISTINCT_ID, newDistinctId)
    return newDistinctId
  }

  // CUSTOM
  optedIn() {
    return this.enabled
  }

  optIn() {
    this.enable()
  }

  optOut() {
    this.disable()
  }
}

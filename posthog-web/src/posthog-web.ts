import { PostHogCore, PosthogCoreOptions } from 'posthog-core'
// import { version } from '../package.json'
import { generateUUID } from 'posthog-core/src/utils'
import { getContext } from './context'
import { PostHogFetchOptions, PostHogFetchResponse } from 'posthog-core/src/types'

// TODO: Get this from package.json
const version = '2.0.0-alpha'

export interface PostHogWebOptions extends PosthogCoreOptions {
  autocapture?: boolean
}

const KEY_DISTINCT_ID = '@posthog:distinct_id'

export class PostHogWeb extends PostHogCore {
  private _cachedDistinctId?: string

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

  async getDistinctId(): Promise<string> {
    if (!this._cachedDistinctId) {
      // TODO: Check and set local storage
      this._cachedDistinctId = localStorage.getItem(KEY_DISTINCT_ID) || generateUUID(globalThis)
    }

    return this._cachedDistinctId
  }

  async onSetDistinctId(newDistinctId: string): Promise<string> {
    this._cachedDistinctId = newDistinctId
    localStorage.setItem(KEY_DISTINCT_ID, newDistinctId)
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

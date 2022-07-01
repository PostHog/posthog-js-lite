import { PostHogCore, PostHogCoreFetchRequest, PostHogCoreFetchResponse, PosthogCoreOptions } from 'posthog-core'
import { version } from '../package.json'
import { generateUUID } from 'posthog-core/src/utils'
import { getContext } from './context'

export interface PostHogWebOptions extends PosthogCoreOptions {
  autocapture?: boolean
}

const KEY_DISTINCT_ID = '@posthog:distinct_id'

export class PostHogWeb extends PostHogCore {
  private _cachedDistinctId?: string

  fetch(req: PostHogCoreFetchRequest): Promise<PostHogCoreFetchResponse> {
    return window
      .fetch(req.url, {
        method: req.method,
        headers: req.headers,
        body: JSON.stringify(req.data),
      })
      .then(async (res) => ({
        status: res.status,
        data: await res.json(),
      }))
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

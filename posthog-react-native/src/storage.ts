import { PostHogStorage } from './types'

const POSTHOG_STORAGE_KEY = '.posthog-rn.json'
const POSTHOG_STORAGE_VERSION = 'v1'

type PostHogStorageContents = { [key: string]: any }

export abstract class SemiAsyncStorage {
  getItem: (key: string) => string | null | undefined
  setItem: (key: string, value: string) => void
  /**
   * This must be implemented pre load all keys from the async storage into memory. before initizing the core. As core expects a synchronous storage.
   */
  preloadAsync: () => Promise<void>
  /**
   * This must be set as true after `preloadAsync` is called.
   */
  isPreloaded: boolean
}
// NOTE: The core prefers a synchronous storage so we mimic this by pre-loading all keys, in `preloadAsync`
export class PostHogSemiAsyncStorage implements SemiAsyncStorage {
  private _memoryCache: PostHogStorageContents = {}
  private _preloadSemiAsyncStoragePromise: Promise<void> | undefined
  private _asyncStorage: PostHogStorage
  public isPreloaded = false

  constructor(asyncStorage: PostHogStorage) {
    this._asyncStorage = asyncStorage
  }

  preloadAsync() {
    if (this.isPreloaded) {
      return Promise.resolve()
    }

    if (this._preloadSemiAsyncStoragePromise) {
      return this._preloadSemiAsyncStoragePromise
    }

    this._preloadSemiAsyncStoragePromise = this._asyncStorage.getItem(POSTHOG_STORAGE_KEY).then((res) => {
      try {
        const data = res ? JSON.parse(res).content : {}

        for (const key in data) {
          this._memoryCache[key] = data[key]
        }
      } catch (e) {
        console.warn(
          "PostHog failed to load persisted data from storage. This is likely because the storage format is. We'll reset the storage.",
          e
        )
      } finally {
        this.isPreloaded = true
      }
    })

    this._preloadSemiAsyncStoragePromise.finally(() => {
      this._preloadSemiAsyncStoragePromise = undefined
    })

    return this._preloadSemiAsyncStoragePromise
  }

  persist(): void {
    const payload = {
      version: POSTHOG_STORAGE_VERSION,
      content: this._memoryCache,
    }

    void this._asyncStorage.setItem(POSTHOG_STORAGE_KEY, JSON.stringify(payload))
  }

  getItem(key: string): any | null | undefined {
    return this._memoryCache[key]
  }
  setItem(key: string, value: any): void {
    if (value === null) {
      delete this._memoryCache[key]
    } else {
      this._memoryCache[key] = value
    }
    this.persist()
  }
}

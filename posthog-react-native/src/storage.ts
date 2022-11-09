import { PostHogCustomAsyncStorage } from './types'

const POSTHOG_STORAGE_KEY = '.posthog-rn.json'
const POSTHOG_STORAGE_VERSION = 'v1'

type PostHogStorageContents = { [key: string]: any }

// NOTE: The core prefers a synchronous storage so we mimic this by pre-loading all keys
export class SemiAsyncStorage {
  private _memoryCache: PostHogStorageContents = {}
  private _preloadSemiAsyncStoragePromise: Promise<void> | undefined
  private _asyncStorage: PostHogCustomAsyncStorage
  public isPreloaded = false

  constructor(asyncStorage: PostHogCustomAsyncStorage) {
    this._asyncStorage = asyncStorage
  }

  preloadAsync(): Promise<void> {
    if (this._preloadSemiAsyncStoragePromise) {
      return this._preloadSemiAsyncStoragePromise
    }
    this._preloadSemiAsyncStoragePromise = this._asyncStorage.getItem(POSTHOG_STORAGE_KEY).then((res) => {
      try {
        const data = res ? JSON.parse(res).content : {}

        for (const key in data) {
          this._memoryCache[key] = data[key]
        }

        this.isPreloaded = true
      } catch (e) {
        console.warn(
          "PostHog failed to load persisted data from storage. This is likely because the storage format is. We'll reset the storage.",
          e
        )
      }
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
    this._memoryCache[key] = value
    this.persist()
  }
  removeItem(key: string): void {
    delete this._memoryCache[key]
    this.persist()
  }
  clear(): void {
    for (const key in this._memoryCache) {
      delete this._memoryCache[key]
    }
    this.persist()
  }
  getAllKeys(): readonly string[] {
    return Object.keys(this._memoryCache)
  }
}

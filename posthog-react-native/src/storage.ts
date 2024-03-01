import { PostHogCustomAsyncStorage, PostHogCustomSyncStorage } from './types'

const POSTHOG_STORAGE_KEY = '.posthog-rn.json'
const POSTHOG_STORAGE_VERSION = 'v1'

type PostHogStorageContents = { [key: string]: any }

export class Storage {
  memoryCache: PostHogStorageContents = {}
  storage: PostHogCustomAsyncStorage | PostHogCustomSyncStorage
  isPreloaded = false

  constructor(storage: PostHogCustomAsyncStorage | PostHogCustomSyncStorage) {
    this.storage = storage
  }

  isSemiAsync(): boolean {
    return this.storage.isSemiAsync()
  }

  persist(): void {
    const payload = {
      version: POSTHOG_STORAGE_VERSION,
      content: this.memoryCache,
    }

    void this.storage.setItem(POSTHOG_STORAGE_KEY, JSON.stringify(payload))
  }

  getItem(key: string): any | null | undefined {
    return this.memoryCache[key]
  }
  setItem(key: string, value: any): void {
    this.memoryCache[key] = value
    this.persist()
  }
  removeItem(key: string): void {
    delete this.memoryCache[key]
    this.persist()
  }
  clear(): void {
    for (const key in this.memoryCache) {
      delete this.memoryCache[key]
    }
    this.persist()
  }
  getAllKeys(): readonly string[] {
    return Object.keys(this.memoryCache)
  }

  populateMemoryCache(res: string | null): void {
    try {
      const data = res ? JSON.parse(res).content : {}

      for (const key in data) {
        this.memoryCache[key] = data[key]
      }
    } catch (e) {
      console.warn(
        "PostHog failed to load persisted data from storage. This is likely because the storage format is. We'll reset the storage.",
        e
      )
    } finally {
      this.isPreloaded = true
    }
  }
}

// NOTE: The core prefers a synchronous storage so we mimic this by pre-loading all keys
export class SemiAsyncStorage extends Storage {
  private _preloadSemiAsyncStoragePromise: Promise<void> | undefined
  private _storage: PostHogCustomAsyncStorage

  constructor(storage: PostHogCustomAsyncStorage) {
    super(storage)
    this._storage = storage
  }

  preloadAsync(): Promise<void> {
    if (this.isPreloaded) {
      return Promise.resolve()
    }

    if (this._preloadSemiAsyncStoragePromise) {
      return this._preloadSemiAsyncStoragePromise
    }

    this._preloadSemiAsyncStoragePromise = this._storage.getItem(POSTHOG_STORAGE_KEY).then((res) => {
      this.populateMemoryCache(res)
    })

    this._preloadSemiAsyncStoragePromise.finally(() => {
      this._preloadSemiAsyncStoragePromise = undefined
    })

    return this._preloadSemiAsyncStoragePromise
  }
}

export class SyncStorage extends Storage {
  private _storage: PostHogCustomSyncStorage
  constructor(storage: PostHogCustomSyncStorage) {
    super(storage)
    this._storage = storage
  }

  preload(): void {
    if (this.isPreloaded) {
      return
    }

    const res = this._storage.getItem(POSTHOG_STORAGE_KEY)
    this.populateMemoryCache(res)
  }
}

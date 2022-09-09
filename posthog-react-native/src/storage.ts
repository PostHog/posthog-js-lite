import * as FileSystem from 'expo-file-system'

const POSTHOG_STORAGE_KEY = '.posthog-rn.json'
const POSTHOG_STORAGE_VERSION = 'v1'

type PostHogStorageContents = { [key: string]: any }

const loadStorageAsync = async (): Promise<PostHogStorageContents> => {
  const uri = (FileSystem.documentDirectory || '') + POSTHOG_STORAGE_KEY
  // If we change POSTHOG_STORAGE_VERSION then we should migrate the persisted data here
  try {
    const stringContent = await FileSystem.readAsStringAsync(uri)
    return JSON.parse(stringContent).content
  } catch (e) {
    return {}
  }
}

const persitStorageAsync = async (content: PostHogStorageContents): Promise<void> => {
  const uri = (FileSystem.documentDirectory || '') + POSTHOG_STORAGE_KEY
  const data = {
    version: POSTHOG_STORAGE_VERSION,
    content,
  }

  await FileSystem.writeAsStringAsync(uri, JSON.stringify(data)).catch((e) => {
    console.error('PostHog failed to persist data to storage', e)
  })
}

// NOTE: The core prefers a synchronous storage so we mimic this by pre-loading all keys
const _memoryCache: PostHogStorageContents = {}
export const SemiAsyncStorage = {
  getItem: function (key: string): any | null | undefined {
    return _memoryCache[key]
  },
  setItem: function (key: string, value: any): void {
    _memoryCache[key] = value
    void persitStorageAsync(_memoryCache)
  },
  removeItem: function (key: string): void {
    delete _memoryCache[key]
    void persitStorageAsync(_memoryCache)
  },
  clear: function (): void {
    for (const key in _memoryCache) {
      delete _memoryCache[key]
    }
    void persitStorageAsync(_memoryCache)
  },
  getAllKeys: function (): readonly string[] {
    return Object.keys(_memoryCache)
  },
}

let _preloadSemiAsyncStoragePromise: Promise<void> | undefined

export const preloadSemiAsyncStorage = (): Promise<void> => {
  if (_preloadSemiAsyncStoragePromise) {
    return _preloadSemiAsyncStoragePromise
  }
  _preloadSemiAsyncStoragePromise = loadStorageAsync().then((res) => {
    for (const key in res) {
      _memoryCache[key] = res[key]
    }
  })

  return _preloadSemiAsyncStoragePromise
}

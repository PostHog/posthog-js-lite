import type AsyncStorage from '@react-native-async-storage/async-storage'
import { PostHogStorage } from 'posthog-core'

// NOTE: Should we use AsyncStorage? We are at risk of using the same store as the
// rest of the app which could get wiped by the user
let _AsyncStorage: typeof AsyncStorage

try {
  try {
    _AsyncStorage = require('@react-native-async-storage/async-storage').default
  } catch (e) {
    _AsyncStorage = require('react-native').AsyncStorage
    if (!_AsyncStorage) {
      throw new Error('Missing')
    }
  }
} catch (e) {
  throw new Error(
    'PostHog is missing a required dependency of AsyncStorage. To fix this run `npm i -s @react-native-async-storage/async-storage`'
  )
}

// NOTE: The core prefers a synchronous storage so we mimic this by pre-loading all keys
const _memoryCache: { [key: string]: string } = {}
export const SemiAsyncStorage: PostHogStorage = {
  getItem: function (key: string): string | null | undefined {
    return _memoryCache[key]
  },
  setItem: function (key: string, value: string): void {
    _memoryCache[key] = value
    void _AsyncStorage.setItem(key, value)
  },
  removeItem: function (key: string): void {
    delete _memoryCache[key]
    void _AsyncStorage.removeItem(key)
  },
  clear: function (): void {
    for (let key in _memoryCache) {
      delete _memoryCache[key]
    }
    void _AsyncStorage.clear()
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
  _preloadSemiAsyncStoragePromise = _AsyncStorage
    .getAllKeys()
    .then(_AsyncStorage.multiGet)
    .then((res) => {
      res.forEach(([key, value]) => {
        if (value !== null) _memoryCache[key] = value
      })
    })

  return _preloadSemiAsyncStoragePromise
}

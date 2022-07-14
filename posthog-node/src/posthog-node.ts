import {
  PostHogCore,
  PosthogCoreOptions,
  PostHogFetchOptions,
  PostHogFetchResponse,
  PostHogStorage,
} from 'posthog-core'
// import { version } from '../package.json'

// TODO: Get this from package.json
const version = '2.0.0-alpha'

export interface PostHogNodejsOptions extends PosthogCoreOptions {}

const _cache: { [key: string]: string } = {}

const MemoryStorage: PostHogStorage = {
  getItem(key) {
    return _cache[key]
  },
  setItem(key: string, value: string) {
    _cache[key] = value
  },
  removeItem(key: string) {
    delete _cache[key]
  },
  clear() {
    for (let k in _cache) {
      delete _cache[k]
    }
  },
  getAllKeys() {
    return Object.keys(_cache)
  },
}

export class PostHogNodejs extends PostHogCore {
  private _cachedDistinctId?: string

  constructor(apiKey: string, options: PostHogNodejsOptions) {
    super(apiKey, options)
  }

  storage(): PostHogStorage {
    return MemoryStorage
  }

  fetch(url: string, options: PostHogFetchOptions): Promise<PostHogFetchResponse> {
    throw Error('not implemented')
  }

  setImmediate(fn: () => void): void {
    return process.nextTick(fn)
  }

  getLibraryId(): string {
    return 'posthog-node'
  }
  getLibraryVersion(): string {
    return version
  }
  getCustomUserAgent(): string {
    return `posthog-node/${version}`
  }

  getDistinctId(): string {
    return ''
  }

  onSetDistinctId(_: string): string {
    return _
  }

  shutdown() {
    this.flush()
  }
}

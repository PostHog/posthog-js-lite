import {
  PostHogCore,
  PosthogCoreOptions,
  PostHogFetchOptions,
  PostHogFetchResponse,
  PostHogPersistedProperty,
} from 'posthog-core'
import { version } from '../package.json'
import axios from 'axios'

export interface PostHogNodejsOptions extends PosthogCoreOptions {}

const SHARED_PERSISTENCE_PROPERTIES = [PostHogPersistedProperty.Queue]

export class PostHogNodejs extends PostHogCore {
  private _sharedStorage: { [key: string]: any | undefined } = {}
  private _memoryStorage: { [key: string]: any | undefined } = {}

  constructor(apiKey: string, options: PostHogNodejsOptions, globalStorage: { [key: string]: any | undefined }) {
    super(apiKey, options)
    this._sharedStorage = globalStorage
  }

  getPersistedProperty(key: PostHogPersistedProperty): any | undefined {
    const storage = SHARED_PERSISTENCE_PROPERTIES.includes(key) ? this._sharedStorage : this._memoryStorage
    return storage[key]
  }
  setPersistedProperty(key: PostHogPersistedProperty, value: any | null): void {
    const storage = SHARED_PERSISTENCE_PROPERTIES.includes(key) ? this._sharedStorage : this._memoryStorage
    storage[key] = value !== null ? value : undefined
  }

  fetch(url: string, options: PostHogFetchOptions): Promise<PostHogFetchResponse> {
    return axios
      .request({
        url: url,
        method: options.method,
        headers: options.headers,
        data: options.body,
      })
      .then((res) => {
        console.log(res)
        return {
          status: res.status,
          text: () => Promise.resolve(res.data),
          json: () => Promise.resolve(res.data),
        }
      })
      .catch((e) => {
        console.error(e)
        throw e
      })
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
}

// The actual exported Nodejs API.
export class PostHogNodejsGlobal {
  private _sharedStorage: { [key: string]: any | undefined } = {}

  constructor(private apiKey: string, private options: PostHogNodejsOptions) {}

  user(distinctId: string): PostHogNodejs {
    const client = new PostHogNodejs(this.apiKey, this.options, this._sharedStorage)
    client.setPersistedProperty(PostHogPersistedProperty.DistinctId, distinctId)
    return client
  }

  // TODO: Implement previous global API, doing some sort of clever linking to the underlying "user" prop
}

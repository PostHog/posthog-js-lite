import {
  PostHogCore,
  PosthogCoreOptions,
  PostHogFetchOptions,
  PostHogFetchResponse,
  PostHogPersistedProperty,
} from 'posthog-core'
// import { version } from '../package.json'

// TODO: Get this from package.json
const version = '2.0.0-alpha'

export interface PostHogNodejsOptions extends PosthogCoreOptions {}

export class PostHogNodejs extends PostHogCore {
  _memoryStorage: { [key: string]: string | undefined } = {}

  constructor(apiKey: string, options: PostHogNodejsOptions) {
    super(apiKey, options)
  }

  getPersistedProperty(key: PostHogPersistedProperty): string | undefined {
    return this._memoryStorage[key]
  }
  setPersistedProperty(key: PostHogPersistedProperty, value: string | null): void {
    this._memoryStorage[key] = value !== null ? value : undefined
  }

  fetch(url: string, options: PostHogFetchOptions): Promise<PostHogFetchResponse> {
    throw Error('not implemented')
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
export default class PostHogNodejsGlobal {
  constructor(private apiKey: string, private options: PostHogNodejsOptions) {}

  user(distinctId: string): PostHogNodejs {
    const client = new PostHogNodejs(this.apiKey, this.options)
    client.setPersistedProperty(PostHogPersistedProperty.DistinctId, distinctId)
    return client
  }

  // TODO: Implement previous global API, doing some sort of clever linking to the underlying "user" prop
}

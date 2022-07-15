import {
  PostHogCore,
  utils,
  PostHogFetchOptions,
  PostHogFetchResponse,
  PosthogCoreOptions,
  PostHogEventProperties,
} from '../../src'

// TODO: Get this from package.json
const version = '2.0.0-alpha'

export interface PostHogCoreTestClientMocks {
  fetch: jest.Mock<Promise<PostHogFetchResponse>, [string, PostHogFetchOptions]>
  storage: {
    getItem: jest.Mock<string | undefined, string[]>
    setItem: jest.Mock<void, string[]>
  }
}

export class PostHogCoreTestClient extends PostHogCore {
  public _cachedDistinctId?: string

  constructor(private mocks: PostHogCoreTestClientMocks, apiKey: string, options?: PosthogCoreOptions) {
    super(apiKey, options)
  }

  getPersistedProperty(key: string) {
    return this.mocks.storage.getItem(key)
  }
  setPersistedProperty(key: string, value: string): void {
    return this.mocks.storage.setItem(key, value)
  }

  fetch(url: string, options: PostHogFetchOptions): Promise<PostHogFetchResponse> {
    return this.mocks.fetch(url, options)
  }
  setImmediate(fn: () => void): void {
    setTimeout(fn, 1)
  }
  getLibraryId() {
    return 'posthog-core-tests'
  }
  getLibraryVersion() {
    return version
  }
  getCustomUserAgent() {
    return 'posthog-core-tests'
  }
}

export const createTestClient = (
  apiKey: string,
  options?: PosthogCoreOptions,
  setupMocks?: (mocks: PostHogCoreTestClientMocks) => void
): [PostHogCoreTestClient, PostHogCoreTestClientMocks] => {
  const storageCache: { [key: string]: string | undefined } = {}
  const mocks = {
    fetch: jest.fn<Promise<PostHogFetchResponse>, [string, PostHogFetchOptions]>(),
    storage: {
      getItem: jest.fn<string | undefined, string[]>((key) => storageCache[key]),
      setItem: jest.fn<void, [string, string]>((key, val) => {
        storageCache[key] = val
      }),
    },
  }

  mocks.fetch.mockImplementation(() =>
    Promise.resolve({
      status: 200,
      text: () => Promise.resolve('ok'),
      json: () => Promise.resolve({ status: 'ok' }),
    })
  )

  setupMocks?.(mocks)

  return [new PostHogCoreTestClient(mocks, apiKey, options), mocks]
}

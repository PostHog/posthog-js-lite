import { PostHogCore, PosthogCoreOptions, PostHogFetchOptions, PostHogFetchResponse } from '../../src'

const version = '2.0.0-alpha'

export interface PostHogCoreTestClientMocks {
  fetch: jest.Mock<Promise<PostHogFetchResponse>, [string, PostHogFetchOptions]>
  storage: {
    getItem: jest.Mock<any | undefined, [string]>
    setItem: jest.Mock<void, [string, any | null]>
  }
}

export class PostHogCoreTestClient extends PostHogCore {
  public _cachedDistinctId?: string

  constructor(private mocks: PostHogCoreTestClientMocks, apiKey: string, options?: PosthogCoreOptions) {
    super(apiKey, options)
  }

  getPersistedProperty<T>(key: string): T {
    return this.mocks.storage.getItem(key)
  }
  setPersistedProperty<T>(key: string, value: T | null): void {
    return this.mocks.storage.setItem(key, value)
  }
  fetch(url: string, options: PostHogFetchOptions): Promise<PostHogFetchResponse> {
    return this.mocks.fetch(url, options)
  }
  getLibraryId(): string {
    return 'posthog-core-tests'
  }
  getLibraryVersion(): string {
    return version
  }
  getCustomUserAgent(): string {
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
      getItem: jest.fn<any | undefined, [string]>((key) => storageCache[key]),
      setItem: jest.fn<void, [string, any | null]>((key, val) => {
        storageCache[key] = val == null ? undefined : val
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

import { createTestClient, PostHogCoreTestClient, PostHogCoreTestClientMocks } from './test-utils/PostHogCoreTestClient'

describe('PostHog Core', () => {
  let posthog: PostHogCoreTestClient
  let mocks: PostHogCoreTestClientMocks

  beforeEach(() => {
    ;[posthog, mocks] = createTestClient('TEST_API_KEY', {})
  })

  describe('init', () => {
    it('should initialise', () => {
      expect(posthog.enabled).toEqual(true)
    })

    it('should throw if missing api key', () => {
      expect(() => createTestClient((undefined as unknown) as string)).toThrowError(
        "You must pass your PostHog project's api key."
      )
    })

    it('should create an empty queue', () => {
      expect((posthog as any)._queue).toEqual([])
    })

    it('should initialise default options', () => {
      expect(posthog as any).toMatchObject({
        apiKey: 'TEST_API_KEY',
        host: 'https://app.posthog.com',
        flushAt: 20,
        flushInterval: 10000,
      })
    })

    it('overwrites defaults with options', () => {
      ;[posthog, mocks] = createTestClient('key', {
        host: 'https://a.com',
        flushAt: 1,
        flushInterval: 2,
      })

      expect(posthog).toMatchObject({
        apiKey: 'key',
        host: 'https://a.com',
        flushAt: 1,
        flushInterval: 2,
      })
    })

    it('should keep the flushAt option above zero', () => {
      ;[posthog, mocks] = createTestClient('key', { flushAt: -2 }) as any
      expect((posthog as any).flushAt).toEqual(1)
    })

    it('should remove trailing slashes from `host`', () => {
      ;[posthog, mocks] = createTestClient('TEST_API_KEY', { host: 'http://my-posthog.com///' })

      expect((posthog as any).host).toEqual('http://my-posthog.com')
    })
  })
})

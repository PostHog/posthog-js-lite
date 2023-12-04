import { createTestClient, PostHogCoreTestClient, PostHogCoreTestClientMocks } from './test-utils/PostHogCoreTestClient'

describe('PostHog Core', () => {
  let posthog: PostHogCoreTestClient
  // eslint-disable-next-line @typescript-eslint/no-unused-vars
  let mocks: PostHogCoreTestClientMocks

  beforeEach(() => {
    ;[posthog, mocks] = createTestClient('TEST_API_KEY', {})
  })

  describe('init', () => {
    it('should initialise', () => {
      expect(posthog.optedOut).toEqual(false)
    })

    it('should throw if missing api key', () => {
      expect(() => createTestClient(undefined as unknown as string)).toThrowError(
        "You must pass your PostHog project's api key."
      )
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

    it('should use bootstrapped distinct ID when present', () => {
      ;[posthog, mocks] = createTestClient('TEST_API_KEY', { bootstrap: { distinctId: 'new_anon_id' } })

      expect((posthog as any).getDistinctId()).toEqual('new_anon_id')
      expect((posthog as any).getAnonymousId()).toEqual('new_anon_id')

      posthog.identify('random_id')

      expect((posthog as any).getDistinctId()).toEqual('random_id')
      expect((posthog as any).getAnonymousId()).toEqual('new_anon_id')
    })

    it('should use bootstrapped distinct ID as identified ID when present', () => {
      ;[posthog, mocks] = createTestClient('TEST_API_KEY', {
        bootstrap: { distinctId: 'new_id', isIdentifiedId: true },
      })

      expect((posthog as any).getDistinctId()).toEqual('new_id')
      expect((posthog as any).getAnonymousId()).not.toEqual('new_id')

      posthog.identify('random_id')

      expect((posthog as any).getDistinctId()).toEqual('random_id')
      expect((posthog as any).getAnonymousId()).toEqual('new_id')
    })
  })
})

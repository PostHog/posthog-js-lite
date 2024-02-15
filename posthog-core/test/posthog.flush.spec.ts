import { createTestClient, PostHogCoreTestClient, PostHogCoreTestClientMocks } from './test-utils/PostHogCoreTestClient'

describe('PostHog Core', () => {
  let posthog: PostHogCoreTestClient
  let mocks: PostHogCoreTestClientMocks

  describe('flush', () => {
    beforeEach(() => {
      jest.useFakeTimers()
      ;[posthog, mocks] = createTestClient('TEST_API_KEY', {
        flushAt: 5,
        fetchRetryCount: 3,
        fetchRetryDelay: 100,
        preloadFeatureFlags: false,
        captureMode: 'json',
      })
    })
    it("doesn't fail when queue is empty", async () => {
      jest.useRealTimers()
      await expect(posthog.flushAsync()).resolves.toEqual(undefined)
    })

    it('flush messsages once called', async () => {
      posthog.capture('test-event-1')
      posthog.capture('test-event-2')
      posthog.capture('test-event-3')
      expect(mocks.fetch).not.toHaveBeenCalled()
      await expect(posthog.flushAsync()).resolves.toMatchObject([
        { event: 'test-event-1' },
        { event: 'test-event-2' },
        { event: 'test-event-3' },
      ])
      expect(mocks.fetch).toHaveBeenCalled()
    })

    it('responds with an error after retries', async () => {
      posthog.capture('test-event-1')
      mocks.fetch.mockImplementation(() => {
        return Promise.resolve({
          status: 400,
          text: async () => 'err',
          json: async () => ({ status: 'err' }),
        })
      })

      const time = Date.now()
      jest.useRealTimers()
      await expect(posthog.flushAsync()).rejects.toHaveProperty('name', 'PostHogFetchHttpError')
      expect(mocks.fetch).toHaveBeenCalledTimes(4)
      expect(Date.now() - time).toBeGreaterThan(300)
      expect(Date.now() - time).toBeLessThan(500)
    })

    it('skips when client is disabled', async () => {
      ;[posthog, mocks] = createTestClient('TEST_API_KEY', { flushAt: 2 })

      posthog.capture('test-event-1')
      expect(mocks.fetch).toHaveBeenCalledTimes(0)
      posthog.capture('test-event-2')
      expect(mocks.fetch).toHaveBeenCalledTimes(1)
      posthog.optOut()
      posthog.capture('test-event-3')
      posthog.capture('test-event-4')
      expect(mocks.fetch).toHaveBeenCalledTimes(1)
    })
  })
})

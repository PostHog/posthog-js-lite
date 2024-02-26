import { createTestClient, PostHogCoreTestClient, PostHogCoreTestClientMocks } from './test-utils/PostHogCoreTestClient'

describe('PostHog Core', () => {
  let posthog: PostHogCoreTestClient
  let mocks: PostHogCoreTestClientMocks

  describe('shutdown', () => {
    beforeEach(() => {
      jest.useFakeTimers()
      ;[posthog, mocks] = createTestClient('TEST_API_KEY', {
        flushAt: 1,
        fetchRetryCount: 3,
        fetchRetryDelay: 100,
        preloadFeatureFlags: false,
        captureMode: 'json',
      })
    })
    it('flush messsages once called', async () => {
      posthog.capture('test-event-1')
      posthog.capture('test-event-2')
      posthog.capture('test-event-3')
      expect(mocks.fetch).not.toHaveBeenCalled()
      await posthog.shutdownAsync()
      expect(mocks.fetch).toHaveBeenCalledTimes(3)
    })

    it('flush messsages once called', async () => {
      posthog.capture('test-event-1')
      posthog.capture('test-event-2')
      posthog.capture('test-event-3')
      expect(mocks.fetch).not.toHaveBeenCalled()
      await posthog.shutdownAsync(1)
      expect(mocks.fetch).toHaveBeenCalledTimes(1)
    })
  })
})

import { createTestClient, PostHogCoreTestClient, PostHogCoreTestClientMocks } from './test-utils/PostHogCoreTestClient'

describe('PostHog Core', () => {
  let posthog: PostHogCoreTestClient
  let mocks: PostHogCoreTestClientMocks

  describe('shutdown', () => {
    beforeEach(() => {
      jest.useRealTimers()
      ;[posthog, mocks] = createTestClient('TEST_API_KEY', {
        flushAt: 10,
        preloadFeatureFlags: false,
        captureMode: 'json',
      })
    })

    it('flush messsages once called', async () => {
      for (let i = 0; i < 5; i++) {
        posthog.capture('test-event')
      }

      await posthog.shutdownAsync()
      expect(mocks.fetch).toHaveBeenCalledTimes(1)
    })
  })
})

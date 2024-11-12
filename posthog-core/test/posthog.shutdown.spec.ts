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
      })
    })

    it('flush messsages once called', async () => {
      for (let i = 0; i < 5; i++) {
        posthog.capture('test-event')
      }

      await posthog.shutdown()
      expect(mocks.fetch).toHaveBeenCalledTimes(1)
    })

    it.only('respects timeout', async () => {
      mocks.fetch.mockImplementation(async () => {
        await new Promise((resolve) => setTimeout(resolve, 1000))
        console.log('FETCH RETURNED')
        return {
          status: 200,
          text: () => Promise.resolve('ok'),
          json: () => Promise.resolve({ status: 'ok' }),
        }
      })

      posthog.capture('test-event')

      await expect(posthog.shutdown(100)).rejects.toThrow('Timeout')
      expect(mocks.fetch).toHaveBeenCalledTimes(1)
    })
  })
})

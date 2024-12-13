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

    it('respects timeout', async () => {
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

      await posthog
        .shutdown(100)
        .then(() => {
          throw new Error('Should not resolve')
        })
        .catch((e) => {
          expect(e).toEqual('Timeout while shutting down PostHog. Some events may not have been sent.')
        })
      expect(mocks.fetch).toHaveBeenCalledTimes(1)
    })
  })
})

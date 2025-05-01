import { createTestClient, PostHogCoreTestClient, PostHogCoreTestClientMocks } from './test-utils/PostHogCoreTestClient'
import { delay, waitForPromises } from './test-utils/test-utils'

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
      })
    })

    it("doesn't fail when queue is empty", async () => {
      jest.useRealTimers()
      await expect(posthog.flush()).resolves.toEqual([])
    })

    it('flush messsages once called', async () => {
      posthog.capture('test-event-1')
      posthog.capture('test-event-2')
      posthog.capture('test-event-3')
      expect(mocks.fetch).not.toHaveBeenCalled()
      await expect(posthog.flush()).resolves.toMatchObject([
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
      await expect(posthog.flush()).rejects.toHaveProperty('name', 'PostHogFetchHttpError')
      expect(mocks.fetch).toHaveBeenCalledTimes(4)
      expect(Date.now() - time).toBeGreaterThan(300)
      expect(Date.now() - time).toBeLessThan(500)
    })

    it('skips when client is disabled', async () => {
      ;[posthog, mocks] = createTestClient('TEST_API_KEY', { flushAt: 2 })

      posthog.capture('test-event-1')
      await waitForPromises()
      expect(mocks.fetch).toHaveBeenCalledTimes(0)
      posthog.capture('test-event-2')
      await waitForPromises()
      expect(mocks.fetch).toHaveBeenCalledTimes(1)
      posthog.optOut()
      posthog.capture('test-event-3')
      posthog.capture('test-event-4')
      await waitForPromises()
      expect(mocks.fetch).toHaveBeenCalledTimes(1)
    })

    it('does not get stuck in a loop when new events are added while flushing', async () => {
      jest.useRealTimers()
      mocks.fetch.mockImplementation(async () => {
        posthog.capture('another-event')
        await delay(10)
        return Promise.resolve({
          status: 200,
          text: () => Promise.resolve('ok'),
          json: () => Promise.resolve({ status: 'ok' }),
        })
      })

      posthog.capture('test-event-1')
      await posthog.flush()
      expect(mocks.fetch).toHaveBeenCalledTimes(1)
    })

    it('does not get stuck in a loop when new events are added while flushing with flushAt 1 and can shutdown', async () => {
      let shouldAddNewEvents = true
      jest.useRealTimers()
      ;[posthog, mocks] = createTestClient('TEST_API_KEY', { flushAt: 1 })
      mocks.fetch.mockImplementation(async () => {
        if (shouldAddNewEvents) {
          posthog.capture('another-event')
        }
        await delay(10)
        return Promise.resolve({
          status: 200,
          text: () => Promise.resolve('ok'),
          json: () => Promise.resolve({ status: 'ok' }),
        })
      })

      posthog.capture('test-event-1')
      await posthog.flush()
      expect(mocks.fetch).toHaveBeenCalledTimes(2)

      // end the program
      shouldAddNewEvents = false
      await posthog.shutdown()
    })

    it('should flush all events even if larger than batch size', async () => {
      ;[posthog, mocks] = createTestClient('TEST_API_KEY', { flushAt: 4 })
      posthog['maxBatchSize'] = 2 // this is a bit contrived as normally maxBatchSize can't be smaller than flushAt
      posthog.capture('test-event-1')
      posthog.capture('test-event-2')
      posthog.capture('test-event-3')
      posthog.capture('test-event-4')
      await waitForPromises()
      expect(mocks.fetch).toHaveBeenCalledTimes(2)
    })
  })
})

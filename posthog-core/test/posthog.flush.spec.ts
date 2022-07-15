import { parseBody } from './test-utils/test-utils'
import { createTestClient, PostHogCoreTestClient, PostHogCoreTestClientMocks } from './test-utils/PostHogCoreTestClient'

// TODO: Get this from package.json
const version = '2.0.0-alpha'

const TEST_API_KEY = 'TEST_API_KEY'

describe('PostHog Core', () => {
  let posthog: PostHogCoreTestClient
  let mocks: PostHogCoreTestClientMocks

  jest.useFakeTimers()

  beforeEach(() => {
    ;[posthog, mocks] = createTestClient(TEST_API_KEY, { flushAt: 5 })
  })

  describe('flush', () => {
    it("doesn't fail when queue is empty", async () => {
      const flushing = posthog.flushAsync()
      jest.runOnlyPendingTimers()

      await expect(flushing).resolves.toEqual(undefined)
    })

    it('flush messsages once called', async () => {
      posthog.capture('test-event-1')
      posthog.capture('test-event-2')
      posthog.capture('test-event-3')
      expect(mocks.fetch).not.toHaveBeenCalled()
      await posthog.flushAsync()
      expect(mocks.fetch).toHaveBeenCalled()
    })

    it('responds with an error', async () => {
      posthog.capture('test-event-1')
      mocks.fetch.mockRejectedValueOnce('Network error')

      const flushing = posthog.flushAsync()
      expect(mocks.fetch).toHaveBeenCalledTimes(1)
      await expect(flushing).rejects.toEqual('Network error')
    })

    // it('flush - time out if configured', async () => {
    //   const client = createClient({ timeout: 500 })
    //   const callback = spy()

    //   client.queue = [
    //     {
    //       message: 'timeout',
    //       callback,
    //     },
    //   ]
    //   await t.throwsAsync(() => client.flush(), { message: 'timeout of 500ms exceeded' })
    // })

    it('skips when client is disabled', async () => {
      ;[posthog, mocks] = createTestClient(TEST_API_KEY, { flushAt: 2 })

      posthog.capture('test-event-1')
      expect(mocks.fetch).toHaveBeenCalledTimes(0)
      posthog.capture('test-event-2')
      expect(mocks.fetch).toHaveBeenCalledTimes(1)
      posthog.disable()
      posthog.capture('test-event-3')
      posthog.capture('test-event-4')
      expect(mocks.fetch).toHaveBeenCalledTimes(1)
    })
  })
})

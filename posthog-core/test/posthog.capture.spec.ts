import { parseBody } from './test-utils/test-utils'
import { createTestClient, PostHogCoreTestClient, PostHogCoreTestClientMocks } from './test-utils/PostHogCoreTestClient'

describe('PostHog Core', () => {
  let posthog: PostHogCoreTestClient
  let mocks: PostHogCoreTestClientMocks

  jest.useFakeTimers()

  beforeEach(() => {
    ;[posthog, mocks] = createTestClient('TEST_API_KEY', { flushAt: 1 })
  })

  describe('capture', () => {
    it('should capture an event', async () => {
      jest.setSystemTime(new Date('2022-01-01'))

      posthog.capture('custom-event')

      expect(mocks.fetch).toHaveBeenCalledTimes(1)
      const [url, options] = mocks.fetch.mock.calls[0]
      expect(url).toMatch(/^https:\/\/app\.posthog\.com\/e\/\?ip=1&_=[0-9]+&v=[0-9\.a-z\-]+$/)
      expect(options.method).toBe('POST')
      const body = parseBody(mocks.fetch.mock.calls[0])

      expect(body).toEqual({
        api_key: 'TEST_API_KEY',
        batch: [
          {
            event: 'custom-event',
            distinct_id: posthog.getDistinctId(),
            library: 'posthog-core-tests',
            library_version: '2.0.0-alpha',
            properties: {
              $lib: 'posthog-core-tests',
              $lib_version: '2.0.0-alpha',
              $session_id: expect.any(String),
            },
            timestamp: '2022-01-01T00:00:00.000Z',
            type: 'capture',
          },
        ],
        sent_at: '2022-01-01T00:00:00.000Z',
      })
    })
  })
})

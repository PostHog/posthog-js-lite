import { createTestClient, PostHogCoreTestClient, PostHogCoreTestClientMocks } from './test-utils/PostHogCoreTestClient'

// TODO: Get this from package.json
const version = '2.0.0-alpha'
const TEST_API_KEY = 'TEST_API_KEY'

describe('PostHog Core', () => {
  let posthog: PostHogCoreTestClient
  let mocks: PostHogCoreTestClientMocks

  beforeEach(() => {
    ;[posthog, mocks] = createTestClient(TEST_API_KEY, {})
    jest.setSystemTime(new Date('2022-01-01'))
  })

  describe('enqueue', () => {
    it('should add a message to the queue', () => {
      posthog.capture('type', {
        foo: 'bar',
      })

      expect((posthog as any)._queue).toHaveLength(1)
      const item = (posthog as any)._queue.pop()

      expect(item).toMatchObject({
        message: {
          library: 'posthog-core-tests',
          library_version: version,
          type: 'capture',
          properties: {
            foo: 'bar',
          },
        },
      })

      expect(mocks.fetch).not.toHaveBeenCalled()
    })
  })
})

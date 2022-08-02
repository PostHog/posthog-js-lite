import { PostHogPersistedProperty } from '../src'
import { createTestClient, PostHogCoreTestClient, PostHogCoreTestClientMocks } from './test-utils/PostHogCoreTestClient'

describe('PostHog Core', () => {
  let posthog: PostHogCoreTestClient
  let mocks: PostHogCoreTestClientMocks

  beforeEach(() => {
    ;[posthog, mocks] = createTestClient('TEST_API_KEY', {})
    jest.setSystemTime(new Date('2022-01-01'))
  })

  describe('enqueue', () => {
    it('should add a message to the queue', () => {
      posthog.capture('type', {
        foo: 'bar',
      })

      expect(posthog.getPersistedProperty(PostHogPersistedProperty.Queue)).toHaveLength(1)

      const item = posthog.getPersistedProperty<any[]>(PostHogPersistedProperty.Queue)?.pop()

      expect(item).toMatchObject({
        message: {
          library: 'posthog-core-tests',
          library_version: '2.0.0-alpha',
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

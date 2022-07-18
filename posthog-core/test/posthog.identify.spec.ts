import { parseBody } from './test-utils/test-utils'
import { createTestClient, PostHogCoreTestClient, PostHogCoreTestClientMocks } from './test-utils/PostHogCoreTestClient'
import { PostHogPersistedProperty } from '../src'

describe('PostHog Core', () => {
  let posthog: PostHogCoreTestClient
  let mocks: PostHogCoreTestClientMocks

  jest.useFakeTimers()
  jest.setSystemTime(new Date('2022-01-01'))

  beforeEach(() => {
    ;[posthog, mocks] = createTestClient('TEST_API_KEY', { flushAt: 1 })
  })

  describe('identify', () => {
    it('should send an $identify event', () => {
      posthog.identify('id-1', { foo: 'bar' })

      expect(mocks.fetch).toHaveBeenCalledTimes(1)
      expect(parseBody(mocks.fetch.mock.calls[0])).toEqual({
        api_key: 'TEST_API_KEY',
        batch: [
          {
            event: '$identify',
            distinct_id: posthog.getDistinctId(),
            library: 'posthog-core-tests',
            library_version: '2.0.0-alpha',
            $set: {
              foo: 'bar',
            },
            properties: {
              $lib: 'posthog-core-tests',
              $lib_version: '2.0.0-alpha',
              foo: 'bar',
              $anon_distinct_id: expect.any(String),
            },
            timestamp: '2022-01-01T00:00:00.000Z',
            type: 'identify',
          },
        ],
        sent_at: '2022-01-01T00:00:00.000Z',
      })
    })

    it('should include anonymous ID if set', () => {
      posthog.identify('id-1', { foo: 'bar' })

      expect(mocks.fetch).toHaveBeenCalledTimes(1)
      expect(parseBody(mocks.fetch.mock.calls[0])).toMatchObject({
        batch: [
          {
            distinct_id: posthog.getDistinctId(),
            properties: {
              $anon_distinct_id: expect.any(String),
            },
          },
        ],
      })
    })

    it('should update distinctId if different', () => {
      posthog.identify('id-1', { foo: 'bar' })

      expect(mocks.storage.setItem).toHaveBeenCalledWith('distinct_id', 'id-1')
    })

    it('should use existing distinctId from storage', () => {
      mocks.storage.setItem(PostHogPersistedProperty.DistinctId, 'my-old-value')
      mocks.storage.setItem.mockClear()
      posthog.identify('id-1', { foo: 'bar' })
      // One call exists for the queueing, one for persisting distinct id
      expect(mocks.storage.setItem).toHaveBeenCalledWith('distinct_id', 'id-1')
      expect(mocks.fetch).toHaveBeenCalledTimes(1)
      expect(parseBody(mocks.fetch.mock.calls[0])).toMatchObject({
        batch: [
          {
            distinct_id: 'id-1',
            properties: {
              $anon_distinct_id: 'my-old-value',
            },
          },
        ],
      })
    })

    it('should not update stored properties if distinct_id the same', () => {
      mocks.storage.setItem(PostHogPersistedProperty.DistinctId, 'id-1')
      mocks.storage.setItem.mockClear()
      posthog.identify('id-1', { foo: 'bar' })
      // One call exists for the queueing
      expect(mocks.storage.setItem).toHaveBeenCalledTimes(1)
    })
  })
})

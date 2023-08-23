import { parseBody } from './test-utils/test-utils'
import { createTestClient, PostHogCoreTestClient, PostHogCoreTestClientMocks } from './test-utils/PostHogCoreTestClient'
import { PostHogPersistedProperty } from '../src'

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

    it('uses the persisted session id when fresh', async () => {
      jest.setSystemTime(new Date('2022-01-01'))

      posthog.setPersistedProperty(PostHogPersistedProperty.SessionId, 'the persisted session id')
      posthog.setPersistedProperty(PostHogPersistedProperty.SessionLastTimestamp, Date.now())
      posthog.capture('custom-event')

      const body = parseBody(mocks.fetch.mock.calls[0])

      expect(body['batch'][0].properties.$session_id).toEqual('the persisted session id')
    })

    it('refreshes the persisted session id when it has expired', async () => {
      jest.setSystemTime(new Date('2022-01-01'))

      posthog.setPersistedProperty(PostHogPersistedProperty.SessionId, 'the persisted session id')
      posthog.setPersistedProperty(PostHogPersistedProperty.SessionLastTimestamp, Date.now() - 1801 * 1000)
      posthog.capture('custom-event')

      const body = parseBody(mocks.fetch.mock.calls[0])

      const eventSessionId = body['batch'][0].properties.$session_id
      // the session id should have been refreshed
      expect(eventSessionId).not.toEqual('the persisted session id')
      expect(eventSessionId).toEqual(expect.any(String))
      expect(eventSessionId).toHaveLength(36) // i.e. it's a UUID
      // it was stored and its timestamp updated
      expect(eventSessionId).toEqual(posthog.getPersistedProperty(PostHogPersistedProperty.SessionId))
      expect(posthog.getPersistedProperty(PostHogPersistedProperty.SessionLastTimestamp)).toEqual(Date.now())
    })

    it('can have an overridden session id from the event', async () => {
      jest.setSystemTime(new Date('2022-01-01'))

      // a persisted session id with a still valid session timestamp
      posthog.setPersistedProperty(PostHogPersistedProperty.SessionId, 'the persisted session id')
      let storedTimestamp = Date.now() - 1500
      posthog.setPersistedProperty(PostHogPersistedProperty.SessionLastTimestamp, storedTimestamp)
      posthog.capture('custom-event', { $session_id: 'the overridden session id' })

      const body = parseBody(mocks.fetch.mock.calls[0])

      // the session id should have been refreshed
      expect(body['batch'][0].properties.$session_id).toEqual('the overridden session id')
      // the auto-generated session id was not overriden
      expect(posthog.getPersistedProperty(PostHogPersistedProperty.SessionId)).toEqual('the persisted session id')
      expect(posthog.getPersistedProperty(PostHogPersistedProperty.SessionLastTimestamp)).toEqual(storedTimestamp)
    })

    it('should allow overridding the timestamp', async () => {
      jest.setSystemTime(new Date('2022-01-01'))

      posthog.capture('custom-event', { foo: 'bar' }, { timestamp: new Date('2021-01-02') })
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
              foo: 'bar',
            },
            timestamp: '2021-01-02T00:00:00.000Z',
            type: 'capture',
          },
        ],
        sent_at: '2022-01-01T00:00:00.000Z',
      })
    })
  })
})

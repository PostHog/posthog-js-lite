import { createTestClient, PostHogCoreTestClient, PostHogCoreTestClientMocks } from './test-utils/PostHogCoreTestClient'
import { parseBody } from './test-utils/test-utils'

describe('PostHog Core', () => {
  let posthog: PostHogCoreTestClient
  let mocks: PostHogCoreTestClientMocks

  jest.useFakeTimers()
  jest.setSystemTime(new Date('2022-01-01'))

  beforeEach(() => {
    ;[posthog, mocks] = createTestClient('TEST_API_KEY', { flushAt: 1 })
  })

  describe('groups', () => {
    it('should store groups as peristed props', () => {
      const groups = { posthog: 'team-1', other: 'key-2' }
      posthog.groups(groups)

      expect(mocks.storage.setItem).toHaveBeenCalledWith(
        'props',
        JSON.stringify({
          $groups: groups,
        })
      )
    })
  })

  describe('group', () => {
    it('should store group as peristed props', () => {
      const groups = { posthog: 'team-1' }
      posthog.groups(groups)
      posthog.group('other', 'foo')
      posthog.group('posthog', 'team-2')

      expect(mocks.storage.setItem).toHaveBeenCalledWith(
        'props',
        JSON.stringify({
          $groups: {
            posthog: 'team-2',
            other: 'foo',
          },
        })
      )
    })

    it('should call groupIdentify if including props', () => {
      posthog.group('other', 'team', { foo: 'bar' })

      expect(parseBody(mocks.fetch.mock.calls[0])).toMatchObject({
        batch: [
          {
            event: '$groupidentify',
            distinct_id: '$other_team',
            properties: {
              $group_type: 'other',
              $group_key: 'team',
              $group_set: { foo: 'bar' },
            },
            type: 'capture',
          },
        ],
      })
    })
  })

  describe('groupIdentify', () => {
    it('should identify group', () => {
      posthog.groupIdentify('posthog', 'team-1', { analytics: true })

      expect(parseBody(mocks.fetch.mock.calls[0])).toEqual({
        api_key: 'TEST_API_KEY',
        batch: [
          {
            event: '$groupidentify',
            distinct_id: '$posthog_team-1',
            library: 'posthog-core-tests',
            library_version: '2.0.0-alpha',
            properties: {
              $lib: 'posthog-core-tests',
              $lib_version: '2.0.0-alpha',
              $group_type: 'posthog',
              $group_key: 'team-1',
              $group_set: { analytics: true },
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

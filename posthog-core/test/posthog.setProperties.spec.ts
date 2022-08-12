import { PostHogPersistedProperty } from '../src'
import { createTestClient, PostHogCoreTestClient, PostHogCoreTestClientMocks } from './test-utils/PostHogCoreTestClient'

describe('PostHog Core', () => {
  let posthog: PostHogCoreTestClient
  let mocks: PostHogCoreTestClientMocks

  jest.useFakeTimers()
  jest.setSystemTime(new Date('2022-01-01'))

  beforeEach(() => {
    ;[posthog, mocks] = createTestClient('TEST_API_KEY', { flushAt: 1 })
  })

  describe('groupProperties', () => {
    it('should store groupProperties as peristed with group_properties key', () => {
      const props = { organisation: { name: 'bar' }, project: { name: 'baz' } }
      posthog.groupProperties(props)

      expect(mocks.storage.setItem).toHaveBeenCalledWith('group_properties', props)

      expect(posthog.getPersistedProperty(PostHogPersistedProperty.GroupProperties)).toEqual(props)
    })

    it('should update groupProperties appropriately', () => {
      const props = { organisation: { name: 'bar' }, project: { name: 'baz' } }
      posthog.groupProperties(props)

      expect(posthog.getPersistedProperty(PostHogPersistedProperty.GroupProperties)).toEqual(props)

      posthog.groupProperties({ organisation: { name: 'bar2' }, project: { name2: 'baz' } })
      expect(posthog.getPersistedProperty(PostHogPersistedProperty.GroupProperties)).toEqual({
        organisation: { name: 'bar2' },
        project: { name: 'baz', name2: 'baz' },
      })

      posthog.groupProperties({ organisation2: { name: 'bar' } })
      expect(posthog.getPersistedProperty(PostHogPersistedProperty.GroupProperties)).toEqual({
        organisation: { name: 'bar2' },
        project: { name: 'baz', name2: 'baz' },
        organisation2: { name: 'bar' },
      })
    })

    it('should clear groupProperties on reset', () => {
      const props = { organisation: { name: 'bar' }, project: { name: 'baz' } }
      posthog.groupProperties(props)
      expect(posthog.getPersistedProperty(PostHogPersistedProperty.GroupProperties)).toEqual(props)

      posthog.reset()
      expect(posthog.getPersistedProperty(PostHogPersistedProperty.GroupProperties)).toEqual(undefined)

      posthog.groupProperties(props)
      expect(posthog.getPersistedProperty(PostHogPersistedProperty.GroupProperties)).toEqual(props)
    })
  })

  describe('personProperties', () => {
    it('should store personProperties as peristed with person_properties key', () => {
      const props = { organisation: 'bar', project: 'baz' }
      posthog.personProperties(props)

      expect(mocks.storage.setItem).toHaveBeenCalledWith('person_properties', props)

      expect(posthog.getPersistedProperty(PostHogPersistedProperty.PersonProperties)).toEqual(props)
    })

    it('should update personProperties appropriately', () => {
      const props = { organisation: 'bar', project: 'baz' }
      posthog.personProperties(props)

      expect(posthog.getPersistedProperty(PostHogPersistedProperty.PersonProperties)).toEqual(props)

      posthog.personProperties({ organisation: 'bar2', project2: 'baz' })
      expect(posthog.getPersistedProperty(PostHogPersistedProperty.PersonProperties)).toEqual({
        organisation: 'bar2',
        project: 'baz',
        project2: 'baz',
      })

      posthog.personProperties({ organisation2: 'bar' })
      expect(posthog.getPersistedProperty(PostHogPersistedProperty.PersonProperties)).toEqual({
        organisation: 'bar2',
        project: 'baz',
        project2: 'baz',
        organisation2: 'bar',
      })
    })

    it('should clear personProperties on reset', () => {
      const props = { organisation: 'bar', project: 'baz' }
      posthog.personProperties(props)
      expect(posthog.getPersistedProperty(PostHogPersistedProperty.PersonProperties)).toEqual(props)

      posthog.reset()
      expect(posthog.getPersistedProperty(PostHogPersistedProperty.PersonProperties)).toEqual(undefined)

      posthog.personProperties(props)
      expect(posthog.getPersistedProperty(PostHogPersistedProperty.PersonProperties)).toEqual(props)
    })
  })
})

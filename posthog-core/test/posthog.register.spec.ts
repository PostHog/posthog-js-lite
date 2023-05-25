import { PostHogPersistedProperty } from '../src'
import { createTestClient, PostHogCoreTestClient, PostHogCoreTestClientMocks } from './test-utils/PostHogCoreTestClient'

describe('PostHog Core', () => {
  let posthog: PostHogCoreTestClient
  // eslint-disable-next-line @typescript-eslint/no-unused-vars
  let mocks: PostHogCoreTestClientMocks

  beforeEach(() => {
    ;[posthog, mocks] = createTestClient('TEST_API_KEY', {})
  })

  describe('register', () => {
    it('should register properties to storage', () => {
      posthog.register({ foo: 'bar' })
      expect(posthog.props).toEqual({ foo: 'bar' })
      expect(posthog.getPersistedProperty(PostHogPersistedProperty.Props)).toEqual({ foo: 'bar' })
      posthog.register({ foo2: 'bar2' })
      expect(posthog.props).toEqual({ foo: 'bar', foo2: 'bar2' })
      expect(posthog.getPersistedProperty(PostHogPersistedProperty.Props)).toEqual({ foo: 'bar', foo2: 'bar2' })
    })

    it('should unregister properties from storage', () => {
      posthog.register({ foo: 'bar', foo2: 'bar2' })
      posthog.unregister('foo')
      expect(posthog.props).toEqual({ foo2: 'bar2' })
      expect(posthog.getPersistedProperty(PostHogPersistedProperty.Props)).toEqual({ foo2: 'bar2' })
    })

    it('should register properties with optional persistence', () => {
      posthog.register({ foo: 'bar' }, { persist: false })
      expect(posthog.props).toEqual({ foo: 'bar' })
      expect(posthog.getPersistedProperty(PostHogPersistedProperty.Props)).toEqual(undefined)
    })
  })
})

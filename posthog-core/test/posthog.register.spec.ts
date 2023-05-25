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
      expect(posthog.enrichProperties()).toMatchObject({ foo: 'bar' })
      expect(posthog.getPersistedProperty(PostHogPersistedProperty.Props)).toEqual({ foo: 'bar' })
      posthog.register({ foo2: 'bar2' })
      expect(posthog.enrichProperties()).toMatchObject({ foo: 'bar', foo2: 'bar2' })
      expect(posthog.getPersistedProperty(PostHogPersistedProperty.Props)).toEqual({ foo: 'bar', foo2: 'bar2' })
    })

    it('should unregister properties from storage', () => {
      posthog.register({ foo: 'bar', foo2: 'bar2' })
      posthog.unregister('foo')
      expect(posthog.enrichProperties().foo).toBeUndefined()
      expect(posthog.enrichProperties().foo2).toEqual('bar2')
      expect(posthog.getPersistedProperty(PostHogPersistedProperty.Props)).toEqual({ foo2: 'bar2' })
    })

    it('should register properties only for the session', () => {
      posthog.registerForSession({ foo: 'bar' })
      expect(posthog.enrichProperties()).toMatchObject({ foo: 'bar' })
      expect(posthog.getPersistedProperty(PostHogPersistedProperty.Props)).toEqual(undefined)

      posthog.register({ foo: 'bar2' })
      expect(posthog.enrichProperties()).toMatchObject({ foo: 'bar' })
      posthog.unregisterForSession('foo')
      expect(posthog.enrichProperties()).toMatchObject({ foo: 'bar2' })
    })
  })
})

import { PostHog, PostHogCustomAsyncStorage } from '../index'

describe('PostHog React Native', () => {
  let mockStorage: PostHogCustomAsyncStorage
  let cache: any = {}

  jest.setTimeout(500)
  jest.useRealTimers()

  beforeEach(() => {
    cache = {}
    mockStorage = {
      getItem: async (key) => {
        return cache[key] || null
      },
      setItem: async (key, value) => {
        cache[key] = value
      },
    }

    PostHog._resetClientCache()
  })

  it('should initialize properly with bootstrap', async () => {
    const posthog = await PostHog.initAsync('test-token', {
      bootstrap: { distinctId: 'bar' },
      persistence: 'memory',
    })

    expect(posthog.getAnonymousId()).toEqual('bar')
    expect(posthog.getDistinctId()).toEqual('bar')
  })

  it('should initialize properly with bootstrap using async storage', async () => {
    const posthog = await PostHog.initAsync('test-token', { bootstrap: { distinctId: 'bar' }, persistence: 'file' })
    expect(posthog.getAnonymousId()).toEqual('bar')
    expect(posthog.getDistinctId()).toEqual('bar')
  })

  it('should allow customising of native app properties', async () => {
    const posthog = await PostHog.initAsync('test-token', { customAppProperties: { $app_name: 'custom' } })

    expect(posthog.getCommonEventProperties()).toEqual({
      $active_feature_flags: undefined,
      $lib: 'posthog-react-native',
      $lib_version: expect.any(String),
      $screen_height: expect.any(Number),
      $screen_width: expect.any(Number),

      $app_name: 'custom',
    })

    const posthog2 = await PostHog.initAsync('test-token2', {
      customAppProperties: (properties) => {
        properties.$app_name = 'customised!'
        delete properties.$device_name
        return properties
      },
    })

    expect(posthog2.getCommonEventProperties()).toEqual({
      $active_feature_flags: undefined,
      $lib: 'posthog-react-native',
      $lib_version: expect.any(String),
      $screen_height: expect.any(Number),
      $screen_width: expect.any(Number),

      $app_build: 'mock',
      $app_name: 'customised!', // changed
      $app_namespace: 'mock',
      $app_version: 'mock',
      $device_manufacturer: 'mock',
      $device_type: 'ios',
      // $device_name: 'mock', (deleted)
      $os_name: 'mock',
      $os_version: 'mock',
      $locale: 'mock',
      $timezone: 'mock',
    })
  })

  it("should init async preloading the storage if it's not preloaded", async () => {
    const posthog = await PostHog.initAsync('test-token', {
      customAsyncStorage: mockStorage,
    })

    expect(posthog.getAnonymousId()).toBe(posthog.getDistinctId())

    const otherPostHog = await PostHog.initAsync('test-token')

    expect(otherPostHog).toEqual(posthog)
  })

  it('should init async to cache posthog', async () => {
    const posthog = PostHog.initAsync('test-token', {
      customAsyncStorage: mockStorage,
    })

    const otherPostHog = PostHog.initAsync('test-token')

    expect(await posthog).toEqual(await otherPostHog)
  })
})

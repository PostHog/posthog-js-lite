import { PostHogPersistedProperty } from 'posthog-core'
import { PostHog, PostHogCustomAsyncStorage } from '../index'

describe('PostHog React Native', () => {
  let mockStorage: PostHogCustomAsyncStorage
  let cache: any = {}

  jest.setTimeout(500)
  jest.useRealTimers()

  let posthog: PostHog

  beforeEach(() => {
    ;(global as any).window.fetch = jest.fn(async (url) => {
      let res: any = { status: 'ok' }
      if (url.includes('decide')) {
        res = {
          featureFlags: {},
        }
      }

      return {
        status: 200,
        json: () => Promise.resolve(res),
      }
    })

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

  afterEach(async () => {
    // This ensures there are no open promises / timers
    await posthog.shutdownAsync()
  })

  it('should initialize properly with bootstrap', async () => {
    posthog = await PostHog.initAsync('test-token', {
      bootstrap: { distinctId: 'bar' },
      persistence: 'memory',
      flushInterval: 0,
    })

    expect(posthog.getAnonymousId()).toEqual('bar')
    expect(posthog.getDistinctId()).toEqual('bar')
  })

  it('should initialize properly with bootstrap using async storage', async () => {
    posthog = await PostHog.initAsync('test-token', {
      bootstrap: { distinctId: 'bar' },
      persistence: 'file',
      flushInterval: 0,
    })
    expect(posthog.getAnonymousId()).toEqual('bar')
    expect(posthog.getDistinctId()).toEqual('bar')
  })

  it('should allow customising of native app properties', async () => {
    posthog = await PostHog.initAsync('test-token', {
      customAppProperties: { $app_name: 'custom' },
      flushInterval: 0,
    })

    expect(posthog.getCommonEventProperties()).toEqual({
      $active_feature_flags: undefined,
      $lib: 'posthog-react-native',
      $lib_version: expect.any(String),
      $screen_height: expect.any(Number),
      $screen_width: expect.any(Number),

      $app_name: 'custom',
    })

    const posthog2 = await PostHog.initAsync('test-token2', {
      flushInterval: 0,
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

    await posthog2.shutdownAsync()
  })

  it("should init async preloading the storage if it's not preloaded", async () => {
    posthog = await PostHog.initAsync('test-token', {
      customAsyncStorage: mockStorage,
      flushInterval: 0,
    })

    expect(posthog.getAnonymousId()).toBe(posthog.getDistinctId())

    const otherPostHog = await PostHog.initAsync('test-token')

    expect(otherPostHog).toEqual(posthog)
  })

  it('should init async to cache posthog', async () => {
    posthog = await PostHog.initAsync('test-token', {
      customAsyncStorage: mockStorage,
      flushInterval: 0,
    })

    const otherPostHog = await PostHog.initAsync('test-token')

    expect(posthog).toEqual(otherPostHog)

    await otherPostHog.shutdownAsync()
  })

  describe('screen', () => {
    it('should set a $screen_name property on screen', async () => {
      posthog = await PostHog.initAsync('test-token', {
        customAsyncStorage: mockStorage,
        flushInterval: 0,
      })

      posthog.screen('test-screen')

      expect(posthog.enrichProperties()).toMatchObject({
        $screen_name: 'test-screen',
      })

      expect(posthog.getPersistedProperty(PostHogPersistedProperty.Props)).toEqual(undefined)
    })
  })
})

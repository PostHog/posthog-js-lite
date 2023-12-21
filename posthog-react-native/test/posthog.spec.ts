import { PostHogPersistedProperty } from 'posthog-core'
import { PostHog, PostHogCustomAsyncStorage, PostHogOptions } from '../index'
import { Linking, AppState, AppStateStatus } from 'react-native'
import { SemiAsyncStorage } from '../src/storage'

Linking.getInitialURL = jest.fn(() => Promise.resolve(null))
AppState.addEventListener = jest.fn()

describe('PostHog React Native', () => {
  let mockStorage: PostHogCustomAsyncStorage
  let mockSemiAsyncStorage: SemiAsyncStorage
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
    mockSemiAsyncStorage = new SemiAsyncStorage(mockStorage)

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

  it('should initialize with in memory storage if no storage available or broken', async () => {
    // preloadAsync calls getItem, getItem throws an error
    const myBrokenStorageMock = (): PostHogCustomAsyncStorage => {
      return {
        async getItem(key: string) {
          throw new Error('error')
        },

        async setItem(key: string, value: string) {
          throw new Error('error')
        },
      }
    }

    posthog = await PostHog.initAsync('test-token', {
      bootstrap: { distinctId: 'bar' },
      persistence: 'file',
      customAsyncStorage: myBrokenStorageMock(),
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

  describe('captureNativeAppLifecycleEvents', () => {
    const createTestClient = async (
      apiKey: string,
      options?: Partial<PostHogOptions> | undefined,
      onCapture?: jest.Mock | undefined
    ): Promise<PostHog> => {
      const posthog = new PostHog(
        apiKey,
        {
          ...(options || {}),
          persistence: 'file',
          customAsyncStorage: mockStorage,
          flushInterval: 0,
        },
        mockSemiAsyncStorage
      )
      if (onCapture) {
        posthog.on('capture', onCapture)
      }
      // @ts-expect-error
      await posthog._setupPromise
      return posthog
    }

    it('should trigger an Application Installed event', async () => {
      // arrange
      const onCapture = jest.fn()

      // act
      posthog = await createTestClient(
        'test-install',
        {
          captureNativeAppLifecycleEvents: true,
          customAppProperties: {
            $app_build: '1',
            $app_version: '1.0.0',
          },
        },
        onCapture
      )

      // assert
      expect(onCapture).toHaveBeenCalledTimes(2)
      expect(onCapture.mock.calls[0][0]).toMatchObject({
        event: 'Application Installed',
        properties: {
          $app_build: '1',
          $app_version: '1.0.0',
        },
      })
      expect(onCapture.mock.calls[1][0]).toMatchObject({
        event: 'Application Opened',
        properties: {
          $app_build: '1',
          $app_version: '1.0.0',
          from_background: false,
        },
      })
    })
    it('should trigger an Application Updated event', async () => {
      // arrange
      const onCapture = jest.fn()
      posthog = await PostHog.initAsync('1', {
        customAsyncStorage: mockStorage,
        captureNativeAppLifecycleEvents: true,
        customAppProperties: {
          $app_build: '1',
          $app_version: '1.0.0',
        },
      })

      // act
      posthog = await createTestClient(
        '2',
        {
          captureNativeAppLifecycleEvents: true,
          customAppProperties: {
            $app_build: '2',
            $app_version: '2.0.0',
          },
        },
        onCapture
      )

      // assert
      expect(onCapture).toHaveBeenCalledTimes(2)
      expect(onCapture.mock.calls[0][0]).toMatchObject({
        event: 'Application Updated',
        properties: {
          $app_build: '2',
          $app_version: '2.0.0',
          previous_build: '1',
          previous_version: '1.0.0',
        },
      })
      expect(onCapture.mock.calls[1][0]).toMatchObject({
        event: 'Application Opened',
        properties: {
          $app_build: '2',
          $app_version: '2.0.0',
          from_background: false,
        },
      })
    })
    it('should include the initial url', async () => {
      // arrange
      Linking.getInitialURL = jest.fn(() => Promise.resolve('https://example.com'))
      const onCapture = jest.fn()
      posthog = await createTestClient('test-open', {
        captureNativeAppLifecycleEvents: true,
        customAppProperties: {
          $app_build: '1',
          $app_version: '1.0.0',
        },
      })

      // act
      posthog = await createTestClient(
        'test-open2',
        {
          captureNativeAppLifecycleEvents: true,
          customAppProperties: {
            $app_build: '1',
            $app_version: '1.0.0',
          },
        },
        onCapture
      )

      // assert
      expect(onCapture).toHaveBeenCalledTimes(1)
      expect(onCapture.mock.calls[0][0]).toMatchObject({
        event: 'Application Opened',
        properties: {
          $app_build: '1',
          $app_version: '1.0.0',
          from_background: false,
          url: 'https://example.com',
        },
      })
    })

    it('should track app background and foreground', async () => {
      // arrange
      const onCapture = jest.fn()
      posthog = await createTestClient(
        'test-change',
        {
          captureNativeAppLifecycleEvents: true,
          customAppProperties: {
            $app_build: '1',
            $app_version: '1.0.0',
          },
        },
        onCapture
      )
      const cb: (state: AppStateStatus) => void = (AppState.addEventListener as jest.Mock).mock.calls[1][1]

      // act
      cb('background')
      cb('active')

      // assert
      expect(onCapture).toHaveBeenCalledTimes(4)
      expect(onCapture.mock.calls[2][0]).toMatchObject({
        event: 'Application Backgrounded',
        properties: {
          $app_build: '1',
          $app_version: '1.0.0',
        },
      })
      expect(onCapture.mock.calls[3][0]).toMatchObject({
        event: 'Application Opened',
        properties: {
          $app_build: '1',
          $app_version: '1.0.0',
          from_background: true,
        },
      })
    })
  })
})

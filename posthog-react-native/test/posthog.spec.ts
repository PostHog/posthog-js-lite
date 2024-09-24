import { PostHogPersistedProperty } from 'posthog-core'
import { PostHog, PostHogCustomStorage } from '../index'
import { Linking, AppState, AppStateStatus } from 'react-native'
import { waitForExpect } from './test-utils'
import { PostHogRNStorage } from '../src/storage'

Linking.getInitialURL = jest.fn(() => Promise.resolve(null))
AppState.addEventListener = jest.fn()

describe('PostHog React Native', () => {
  let mockStorage: PostHogCustomStorage
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
  })

  afterEach(async () => {
    // This ensures there are no open promises / timers
    await posthog.shutdown()
  })

  it('should initialize properly with bootstrap', async () => {
    posthog = new PostHog('test-token', {
      bootstrap: { distinctId: 'bar' },
      persistence: 'memory',
      flushInterval: 0,
    })

    await posthog.ready()

    expect(posthog.getAnonymousId()).toEqual('bar')
    expect(posthog.getDistinctId()).toEqual('bar')
  })

  it('should initialize properly with bootstrap using async storage', async () => {
    posthog = new PostHog('test-token', {
      bootstrap: { distinctId: 'bar' },
      persistence: 'file',
      flushInterval: 0,
    })
    await posthog.ready()

    expect(posthog.getAnonymousId()).toEqual('bar')
    expect(posthog.getDistinctId()).toEqual('bar')
  })

  it('should allow customising of native app properties', async () => {
    posthog = new PostHog('test-token', {
      customAppProperties: { $app_name: 'custom' },
      flushInterval: 0,
    })
    // await posthog.ready()

    expect(posthog.getCommonEventProperties()).toEqual({
      $active_feature_flags: undefined,
      $lib: 'posthog-react-native',
      $lib_version: expect.any(String),
      $screen_height: expect.any(Number),
      $screen_width: expect.any(Number),

      $app_name: 'custom',
    })

    const posthog2 = new PostHog('test-token2', {
      flushInterval: 0,
      customAppProperties: (properties) => {
        properties.$app_name = 'customised!'
        delete properties.$device_name
        return properties
      },
    })
    await posthog.ready()

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
      $device_type: 'Mobile',
      // $device_name: 'mock', (deleted)
      $os_name: 'mock',
      $os_version: 'mock',
      $locale: 'mock',
      $timezone: 'mock',
    })

    await posthog2.shutdown()
  })

  describe('screen', () => {
    it('should set a $screen_name property on screen', async () => {
      posthog = new PostHog('test-token', {
        customStorage: mockStorage,
        flushInterval: 0,
      })

      await posthog.screen('test-screen')

      expect((posthog as any).sessionProps).toMatchObject({
        $screen_name: 'test-screen',
      })

      expect(posthog.getPersistedProperty(PostHogPersistedProperty.Props)).toEqual(undefined)
    })
  })

  describe('captureNativeAppLifecycleEvents', () => {
    it('should trigger an Application Installed event', async () => {
      // arrange
      const onCapture = jest.fn()

      // act
      posthog = new PostHog('1', {
        customStorage: mockStorage,
        captureNativeAppLifecycleEvents: true,
        customAppProperties: {
          $app_build: '1',
          $app_version: '1.0.0',
        },
      })
      posthog.on('capture', onCapture)

      await waitForExpect(200, () => {
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
          },
        })
      })
    })

    it('should trigger an Application Updated event', async () => {
      // arrange
      const onCapture = jest.fn()
      posthog = new PostHog('1', {
        customStorage: mockStorage,
        captureNativeAppLifecycleEvents: true,
        customAppProperties: {
          $app_build: '1',
          $app_version: '1.0.0',
        },
      })
      posthog.on('capture', onCapture)

      await waitForExpect(200, () => {
        expect(onCapture).toHaveBeenCalledTimes(2)
      })

      onCapture.mockClear()
      // act
      posthog = new PostHog('1', {
        customStorage: mockStorage,
        captureNativeAppLifecycleEvents: true,
        customAppProperties: {
          $app_build: '2',
          $app_version: '2.0.0',
        },
      })
      posthog.on('capture', onCapture)

      await waitForExpect(200, () => {
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
          },
        })
      })
    })

    it('should include the initial url', async () => {
      // arrange
      Linking.getInitialURL = jest.fn(() => Promise.resolve('https://example.com'))
      const onCapture = jest.fn()

      posthog = new PostHog('1', {
        customStorage: mockStorage,
        captureNativeAppLifecycleEvents: true,
        customAppProperties: {
          $app_build: '1',
          $app_version: '1.0.0',
        },
      })
      posthog.on('capture', onCapture)

      await waitForExpect(200, () => {
        expect(onCapture).toHaveBeenCalledTimes(2)
      })

      onCapture.mockClear()

      posthog = new PostHog('1', {
        customStorage: mockStorage,
        captureNativeAppLifecycleEvents: true,
        customAppProperties: {
          $app_build: '1',
          $app_version: '1.0.0',
        },
      })
      posthog.on('capture', onCapture)

      // assert
      await waitForExpect(200, () => {
        expect(onCapture).toHaveBeenCalledTimes(1)
        expect(onCapture.mock.calls[0][0]).toMatchObject({
          event: 'Application Opened',
          properties: {
            $app_build: '1',
            $app_version: '1.0.0',
            url: 'https://example.com',
          },
        })
      })
    })

    it('should track app background and foreground', async () => {
      // arrange
      const onCapture = jest.fn()
      posthog = new PostHog('1', {
        customStorage: mockStorage,
        captureNativeAppLifecycleEvents: true,
        customAppProperties: {
          $app_build: '1',
          $app_version: '1.0.0',
        },
      })
      posthog.on('capture', onCapture)

      await waitForExpect(200, () => {
        expect(onCapture).toHaveBeenCalledTimes(2)
      })

      const cb: (state: AppStateStatus) => void = (AppState.addEventListener as jest.Mock).mock.calls[1][1]

      // act
      cb('background')
      cb('active')

      // assert
      await waitForExpect(200, () => {
        expect(onCapture).toHaveBeenCalledTimes(4)
        expect(onCapture.mock.calls[2][0]).toMatchObject({
          event: 'Application Backgrounded',
          properties: {
            $app_build: '1',
            $app_version: '1.0.0',
          },
        })
        expect(onCapture.mock.calls[3][0]).toMatchObject({
          event: 'Application Became Active',
          properties: {
            $app_build: '1',
            $app_version: '1.0.0',
          },
        })
      })
    })
  })

  describe('async initialization', () => {
    beforeEach(async () => {
      const semiAsyncStorage = new PostHogRNStorage(mockStorage)
      await semiAsyncStorage.preloadPromise
      semiAsyncStorage.setItem(PostHogPersistedProperty.AnonymousId, 'my-anonymous-id')
    })

    it('should allow immediate calls but delay for the stored values', async () => {
      const onCapture = jest.fn()
      mockStorage.setItem(PostHogPersistedProperty.AnonymousId, 'my-anonymous-id')
      posthog = new PostHog('1', {
        customStorage: mockStorage,
        captureNativeAppLifecycleEvents: false,
      })
      posthog.on('capture', onCapture)
      posthog.on('identify', onCapture)

      // Should all be empty as the storage isn't ready
      expect(posthog.getDistinctId()).toEqual('')
      expect(posthog.getAnonymousId()).toEqual('')
      expect(posthog.getSessionId()).toEqual('')

      // Fire multiple calls that have dependencies on one another
      posthog.capture('anonymous event')
      posthog.identify('identified-id')
      posthog.capture('identified event')

      await waitForExpect(200, () => {
        expect(posthog.getDistinctId()).toEqual('identified-id')
        expect(posthog.getAnonymousId()).toEqual('my-anonymous-id')

        expect(onCapture).toHaveBeenCalledTimes(3)
        expect(onCapture.mock.calls[0][0]).toMatchObject({
          event: 'anonymous event',
          distinct_id: 'my-anonymous-id',
        })

        expect(onCapture.mock.calls[1][0]).toMatchObject({
          event: '$identify',
          distinct_id: 'identified-id',
          properties: {
            $anon_distinct_id: 'my-anonymous-id',
          },
        })
        expect(onCapture.mock.calls[2][0]).toMatchObject({
          event: 'identified event',
          distinct_id: 'identified-id',
          properties: {},
        })
      })
    })
  })

  describe('sync initialization', () => {
    let storage: PostHogCustomStorage
    let cache: { [key: string]: any | undefined }

    beforeEach(() => {
      cache = {}
      storage = {
        getItem: jest.fn((key: string) => cache[key]),
        setItem: jest.fn((key: string, value: string) => {
          cache[key] = value
        }),
      }
    })

    it('should allow immediate calls without delay for stored values', async () => {
      posthog = new PostHog('1', {
        customStorage: storage,
      })

      expect(storage.getItem).toHaveBeenCalledTimes(1)
      expect(posthog.getFeatureFlag('flag')).toEqual(undefined)
      posthog.overrideFeatureFlag({
        flag: true,
      })
      expect(posthog.getFeatureFlag('flag')).toEqual(true)

      // New instance but same sync storage
      posthog = new PostHog('1', {
        customStorage: storage,
      })

      expect(storage.getItem).toHaveBeenCalledTimes(2)
      expect(posthog.getFeatureFlag('flag')).toEqual(true)
    })

    it('do not rotate session id on restart', async () => {
      const sessionId = '0192244d-a627-7ae2-b22a-ccd594bed71d'
      storage.setItem(PostHogPersistedProperty.SessionId, sessionId)
      const now = JSON.stringify(Date.now())
      storage.setItem(PostHogPersistedProperty.SessionLastTimestamp, now)

      posthog = new PostHog('1', {
        customStorage: storage,
        enablePersistSessionIdAcrossRestart: true,
      })

      expect(storage.getItem(PostHogPersistedProperty.SessionId)).toEqual(sessionId)
      expect(storage.getItem(PostHogPersistedProperty.SessionLastTimestamp)).toEqual(now)
    })
  })
})

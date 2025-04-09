/**
 * @jest-environment jsdom
 */

import { waitForPromises } from 'posthog-core/test/test-utils/test-utils'
import { PostHog } from '..'

describe('PostHogWeb', () => {
  let fetch: jest.Mock
  jest.useRealTimers()

  beforeEach(() => {
    ;(global as any).window.fetch = fetch = jest.fn(async (url) => {
      let res: any = { status: 'ok' }
      if (url.includes('decide')) {
        res = {
          featureFlags: {
            'feature-1': true,
            'feature-2': true,
            'json-payload': true,
            'feature-variant': 'variant',
          },
          // NOTE: Aren't these supposed to be strings?

          featureFlagPayloads: {
            'feature-1': {
              color: 'blue',
            },
            'json-payload': {
              a: 'payload',
            },
            'feature-variant': 5,
          },
        }
      }

      return {
        status: 200,
        json: () => Promise.resolve(res),
      }
    })
  })

  describe('init', () => {
    it('should initialise', async () => {
      const posthog = new PostHog('TEST_API_KEY', {
        flushAt: 1,
      })
      expect(posthog.optedOut).toEqual(false)

      posthog.capture('test')
      await waitForPromises()

      expect(fetch).toHaveBeenCalledTimes(2)
    })

    it('should load feature flags on init', async () => {
      const posthog = new PostHog('TEST_API_KEY', {
        flushAt: 1,
      })

      await waitForPromises()

      expect(fetch).toHaveBeenCalledWith('https://us.i.posthog.com/decide/?v=4', {
        body: JSON.stringify({
          token: 'TEST_API_KEY',
          distinct_id: posthog.getDistinctId(),
          groups: {},
          person_properties: {},
          group_properties: {},
          $anon_distinct_id: posthog.getAnonymousId(),
        }),
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        signal: expect.anything(),
      })

      expect(posthog.getFeatureFlags()).toEqual({
        'feature-1': true,
        'feature-2': true,
        'json-payload': true,
        'feature-variant': 'variant',
      })

      expect(posthog.getFeatureFlagPayloads()).toEqual({
        'feature-1': {
          color: 'blue',
        },
        'json-payload': {
          a: 'payload',
        },
        'feature-variant': 5,
      })
    })
  })

  describe('History API tracking', () => {
    const originalPushState = window.history.pushState
    const originalReplaceState = window.history.replaceState

    // Reset history methods after each test
    afterEach(() => {
      window.history.pushState = originalPushState
      window.history.replaceState = originalReplaceState

      const popstateHandler = (): void => {}
      window.addEventListener('popstate', popstateHandler)
      window.removeEventListener('popstate', popstateHandler)
    })

    it('should not patch history methods when trackHistoryEvents is disabled', () => {
      // eslint-disable-next-line @typescript-eslint/no-unused-vars
      const posthog = new PostHog('TEST_API_KEY', {
        trackHistoryEvents: false,
      })

      expect(window.history.pushState).toBe(originalPushState)
      expect(window.history.replaceState).toBe(originalReplaceState)
    })

    it('should patch history methods when trackHistoryEvents is enabled', () => {
      // eslint-disable-next-line @typescript-eslint/no-unused-vars
      const posthog = new PostHog('TEST_API_KEY', {
        trackHistoryEvents: true,
      })

      expect(window.history.pushState).not.toBe(originalPushState)
      expect(window.history.replaceState).not.toBe(originalReplaceState)
    })

    it('should capture pageview events on pushState', async () => {
      const posthog = new PostHog('TEST_API_KEY', {
        trackHistoryEvents: true,
        flushAt: 1,
      })

      const captureSpy = jest.spyOn(posthog, 'capture')

      window.history.pushState({}, '', '/test-page')

      expect(captureSpy).toHaveBeenCalledWith(
        '$pageview',
        expect.objectContaining({
          navigation_type: 'pushState',
        })
      )
    })

    it('should capture pageview events on replaceState', async () => {
      const posthog = new PostHog('TEST_API_KEY', {
        trackHistoryEvents: true,
        flushAt: 1,
      })

      const captureSpy = jest.spyOn(posthog, 'capture')

      window.history.replaceState({}, '', '/replaced-page')

      expect(captureSpy).toHaveBeenCalledWith(
        '$pageview',
        expect.objectContaining({
          navigation_type: 'replaceState',
        })
      )
    })

    it('should capture pageview events on popstate', async () => {
      const posthog = new PostHog('TEST_API_KEY', {
        trackHistoryEvents: true,
        flushAt: 1,
      })

      const captureSpy = jest.spyOn(posthog, 'capture')

      window.dispatchEvent(new Event('popstate'))

      expect(captureSpy).toHaveBeenCalledWith(
        '$pageview',
        expect.objectContaining({
          navigation_type: 'popstate',
        })
      )
    })

    it('should include navigation properties in capture call and rely on getCommonEventProperties', async () => {
      const posthog = new PostHog('TEST_API_KEY', {
        trackHistoryEvents: true,
        flushAt: 1,
      })

      const commonEventProps = { $lib: 'posthog-js-lite', $lib_version: '1.0.0' }
      const getCommonEventPropertiesSpy = jest
        .spyOn(posthog, 'getCommonEventProperties')
        .mockImplementation(() => commonEventProps)

      const coreCaptureMethod = jest.spyOn(PostHog.prototype, 'capture')

      window.history.pushState({}, '', '/captured-page')

      // Will use a mock here for now and rely on the implementation since the tests setup is very simple at the moment
      expect(getCommonEventPropertiesSpy).toHaveBeenCalled()

      const captureCall = coreCaptureMethod.mock.calls.find(
        (call) => call[0] === '$pageview' && call[1] && call[1].navigation_type === 'pushState'
      )

      expect(captureCall).toBeDefined()

      const navigationProperties = {
        navigation_type: 'pushState',
      }

      if (captureCall) {
        expect(captureCall[1]).toMatchObject(navigationProperties)
      }
    })
  })
})

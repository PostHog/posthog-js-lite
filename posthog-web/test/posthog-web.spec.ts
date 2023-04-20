/**
 * @jest-environment jsdom
 */

import { PostHog } from '..'

describe('PosthogWeb', () => {
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
    it('should initialise', () => {
      const posthog = new PostHog('TEST_API_KEY', {
        flushAt: 1,
      })
      expect(posthog.optedOut).toEqual(false)

      posthog.capture('test')

      expect(fetch).toHaveBeenCalledTimes(2)
    })

    it('should load feature flags on init', async () => {
      const posthog = new PostHog('TEST_API_KEY', {
        flushAt: 1,
      })

      expect(fetch).toHaveBeenCalledWith('https://app.posthog.com/decide/?v=3', {
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
})

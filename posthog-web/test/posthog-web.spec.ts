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
})

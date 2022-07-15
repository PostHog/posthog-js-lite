import { createTestClient, PostHogCoreTestClient, PostHogCoreTestClientMocks } from './test-utils/PostHogCoreTestClient'
import { parseBody } from './test-utils/test-utils'

describe('PostHog Core', () => {
  let posthog: PostHogCoreTestClient
  let mocks: PostHogCoreTestClientMocks

  jest.useFakeTimers()
  jest.setSystemTime(new Date('2022-01-01'))

  let mockFeatureFlags = {
    'feature-1': true,
    'feature-2': true,
    'feature-variant': 'variant',
  }

  beforeEach(() => {
    ;[posthog, mocks] = createTestClient('TEST_API_KEY', { flushAt: 1 }, (_mocks) => {
      _mocks.fetch.mockImplementation((url, options) => {
        if (url.includes('/decide/')) {
          return Promise.resolve({
            status: 200,
            text: () => Promise.resolve('ok'),
            json: () =>
              Promise.resolve({
                featureFlags: mockFeatureFlags,
              }),
          })
        }

        return Promise.resolve({
          status: 200,
          text: () => Promise.resolve('ok'),
          json: () =>
            Promise.resolve({
              status: 'ok',
            }),
        })
      })
    })
  })

  describe('featureflags', () => {
    it('getFeatureFlags should return undefined if not loaded', () => {
      expect(posthog.getFeatureFlags()).toEqual(undefined)
    })

    it('getFeatureFlag should return undefined if not loaded', () => {
      expect(posthog.getFeatureFlag('my-flag')).toEqual(undefined)
    })

    it('isFeatureEnabled should return undefined if not loaded', () => {
      expect(posthog.isFeatureEnabled('my-flag')).toEqual(false)
      expect(posthog.isFeatureEnabled('my-flag', true)).toEqual(true)
    })

    describe('when loaded', () => {
      beforeEach(() => {
        jest.runOnlyPendingTimers() // trigger init setImmediate
      })

      it('should load feature flags on init', async () => {
        expect(mocks.fetch).toHaveBeenCalledWith('https://app.posthog.com/decide/?v=2', {
          body: JSON.stringify({
            groups: {},
            distinct_id: posthog.getDistinctId(),
            token: 'TEST_API_KEY',
          }),
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
          },
        })

        expect(posthog.getFeatureFlags()).toEqual({
          'feature-1': true,
          'feature-2': true,
          'feature-variant': 'variant',
        })
      })

      it('should return the value of a flag or the default', async () => {
        expect(posthog.getFeatureFlag('feature-1')).toEqual(true)
        expect(posthog.getFeatureFlag('feature-variant')).toEqual('variant')
        expect(posthog.getFeatureFlag('feature-missing', true)).toEqual(true)
        expect(posthog.getFeatureFlag('feature-missing', false)).toEqual(false)
        expect(posthog.getFeatureFlag('feature-missing', 'other')).toEqual('other')
        expect(posthog.getFeatureFlag('feature-missing')).toEqual(false)
      })

      it('should return the value of a flag or the default', async () => {
        expect(posthog.getFeatureFlag('feature-1')).toEqual(true)
        expect(posthog.getFeatureFlag('feature-variant')).toEqual('variant')
        expect(posthog.getFeatureFlag('feature-missing', true)).toEqual(true)
        expect(posthog.getFeatureFlag('feature-missing', false)).toEqual(false)
        expect(posthog.getFeatureFlag('feature-missing', 'other')).toEqual('other')
        expect(posthog.getFeatureFlag('feature-missing')).toEqual(false)
      })

      it('should return the boolean value of a flag or the default', async () => {
        expect(posthog.isFeatureEnabled('feature-1')).toEqual(true)
        expect(posthog.isFeatureEnabled('feature-variant')).toEqual(true)
      })

      it('should reload if groups are set', async () => {
        posthog.group('my-group', 'is-great')
        expect(mocks.fetch).toHaveBeenCalledTimes(2)
        expect(JSON.parse(mocks.fetch.mock.calls[1][1].body)).toMatchObject({ groups: { 'my-group': 'is-great' } })
      })

      it('should capture $feature_flag_called when called', () => {
        expect(posthog.getFeatureFlag('feature-1')).toEqual(true)
        expect(mocks.fetch).toHaveBeenCalledTimes(2)

        expect(parseBody(mocks.fetch.mock.calls[1])).toMatchObject({
          batch: [
            {
              event: '$feature_flag_called',
              distinct_id: posthog.getDistinctId(),
              properties: {
                $feature_flag: 'feature-1',
                $feature_flag_response: true,
              },
              type: 'capture',
            },
          ],
        })

        // Only tracked once
        expect(posthog.getFeatureFlag('feature-1')).toEqual(true)
        expect(mocks.fetch).toHaveBeenCalledTimes(2)
      })
    })
  })
})

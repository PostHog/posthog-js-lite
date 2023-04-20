import { PostHogPersistedProperty } from '../src'
import { createTestClient, PostHogCoreTestClient, PostHogCoreTestClientMocks } from './test-utils/PostHogCoreTestClient'
import { parseBody } from './test-utils/test-utils'

describe('PostHog Core', () => {
  let posthog: PostHogCoreTestClient
  let mocks: PostHogCoreTestClientMocks

  jest.useFakeTimers()
  jest.setSystemTime(new Date('2022-01-01'))

  const createMockFeatureFlags = (): any => ({
    'feature-1': true,
    'feature-2': true,
    'feature-variant': 'variant',
    'json-payload': true,
  })

  // NOTE: Aren't these supposed to be strings?
  const createMockFeatureFlagPayloads = (): any => ({
    'feature-1': {
      color: 'blue',
    },
    'feature-variant': 5,
    'json-payload': '{"a":"payload"}',
  })

  const errorAPIResponse = Promise.resolve({
    status: 400,
    text: () => Promise.resolve('error'),
    json: () =>
      Promise.resolve({
        status: 'error',
      }),
  })

  beforeEach(() => {
    ;[posthog, mocks] = createTestClient('TEST_API_KEY', { flushAt: 1 }, (_mocks) => {
      _mocks.fetch.mockImplementation((url) => {
        if (url.includes('/decide/?v=3')) {
          return Promise.resolve({
            status: 200,
            text: () => Promise.resolve('ok'),
            json: () =>
              Promise.resolve({
                featureFlags: createMockFeatureFlags(),
                featureFlagPayloads: createMockFeatureFlagPayloads(),
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

    it('getFeatureFlagPayloads should return undefined if not loaded', () => {
      expect(posthog.getFeatureFlagPayloads()).toEqual(undefined)
    })

    it('getFeatureFlag should return undefined if not loaded', () => {
      expect(posthog.getFeatureFlag('my-flag')).toEqual(undefined)
      expect(posthog.getFeatureFlag('feature-1')).toEqual(undefined)
    })

    it('getFeatureFlagPayload should return undefined if not loaded', () => {
      expect(posthog.getFeatureFlagPayload('my-flag')).toEqual(undefined)
    })

    it('isFeatureEnabled should return undefined if not loaded', () => {
      expect(posthog.isFeatureEnabled('my-flag')).toEqual(undefined)
      expect(posthog.isFeatureEnabled('feature-1')).toEqual(undefined)
    })

    it('should load persisted feature flags', () => {
      posthog.setPersistedProperty(PostHogPersistedProperty.FeatureFlags, createMockFeatureFlags())
      expect(posthog.getFeatureFlags()).toEqual(createMockFeatureFlags())
    })

    it('should only call fetch once if already calling', async () => {
      expect(mocks.fetch).toHaveBeenCalledTimes(0)
      posthog.reloadFeatureFlagsAsync()
      posthog.reloadFeatureFlagsAsync()
      const flags = await posthog.reloadFeatureFlagsAsync()
      expect(mocks.fetch).toHaveBeenCalledTimes(1)
      expect(flags).toEqual(createMockFeatureFlags())
    })

    describe('when loaded', () => {
      beforeEach(() => {
        // The core doesn't reload flags by default (this is handled differently by web and RN)
        posthog.reloadFeatureFlags()
      })

      it('should return the value of a flag', async () => {
        expect(posthog.getFeatureFlag('feature-1')).toEqual(true)
        expect(posthog.getFeatureFlag('feature-variant')).toEqual('variant')
        expect(posthog.getFeatureFlag('feature-missing')).toEqual(false)
      })

      it('should return payload of matched flags only', async () => {
        expect(posthog.getFeatureFlagPayload('feature-variant')).toEqual(5)
        expect(posthog.getFeatureFlagPayload('feature-1')).toEqual({
          color: 'blue',
        })

        expect(posthog.getFeatureFlagPayload('feature-2')).toEqual(null)
      })

      describe('when errored out', () => {
        beforeEach(() => {
          ;[posthog, mocks] = createTestClient('TEST_API_KEY', { flushAt: 1 }, (_mocks) => {
            _mocks.fetch.mockImplementation((url) => {
              if (url.includes('/decide/')) {
                return Promise.resolve({
                  status: 400,
                  text: () => Promise.resolve('ok'),
                  json: () =>
                    Promise.resolve({
                      error: 'went wrong',
                    }),
                })
              }

              return errorAPIResponse
            })
          })

          posthog.reloadFeatureFlags()
        })

        it('should return undefined', async () => {
          expect(mocks.fetch).toHaveBeenCalledWith('https://app.posthog.com/decide/?v=3', {
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

          expect(posthog.getFeatureFlag('feature-1')).toEqual(undefined)
          expect(posthog.getFeatureFlag('feature-variant')).toEqual(undefined)
          expect(posthog.getFeatureFlag('feature-missing')).toEqual(undefined)

          expect(posthog.isFeatureEnabled('feature-1')).toEqual(undefined)
          expect(posthog.isFeatureEnabled('feature-variant')).toEqual(undefined)
          expect(posthog.isFeatureEnabled('feature-missing')).toEqual(undefined)

          expect(posthog.getFeatureFlagPayloads()).toEqual(undefined)
          expect(posthog.getFeatureFlagPayload('feature-1')).toEqual(undefined)
        })
      })

      describe('when subsequent decide calls return partial results', () => {
        beforeEach(() => {
          ;[posthog, mocks] = createTestClient('TEST_API_KEY', { flushAt: 1 }, (_mocks) => {
            _mocks.fetch
              .mockImplementationOnce((url) => {
                if (url.includes('/decide/?v=3')) {
                  return Promise.resolve({
                    status: 200,
                    text: () => Promise.resolve('ok'),
                    json: () =>
                      Promise.resolve({
                        featureFlags: createMockFeatureFlags(),
                      }),
                  })
                }
                return errorAPIResponse
              })
              .mockImplementationOnce((url) => {
                if (url.includes('/decide/?v=3')) {
                  return Promise.resolve({
                    status: 200,
                    text: () => Promise.resolve('ok'),
                    json: () =>
                      Promise.resolve({
                        featureFlags: { 'x-flag': 'x-value', 'feature-1': false },
                        errorsWhileComputingFlags: true,
                      }),
                  })
                }

                return errorAPIResponse
              })
              .mockImplementation(() => {
                return errorAPIResponse
              })
          })

          posthog.reloadFeatureFlags()
        })

        it('should return combined results', async () => {
          expect(mocks.fetch).toHaveBeenCalledWith('https://app.posthog.com/decide/?v=3', {
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

          // now second call to feature flags
          await posthog.reloadFeatureFlagsAsync(false)

          expect(mocks.fetch).toHaveBeenCalledWith('https://app.posthog.com/decide/?v=3', {
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
            'feature-1': false,
            'feature-2': true,
            'json-payload': true,
            'feature-variant': 'variant',
            'x-flag': 'x-value',
          })

          expect(posthog.getFeatureFlag('feature-1')).toEqual(false)
          expect(posthog.getFeatureFlag('feature-variant')).toEqual('variant')
          expect(posthog.getFeatureFlag('feature-missing')).toEqual(false)
          expect(posthog.getFeatureFlag('x-flag')).toEqual('x-value')

          expect(posthog.isFeatureEnabled('feature-1')).toEqual(false)
          expect(posthog.isFeatureEnabled('feature-variant')).toEqual(true)
          expect(posthog.isFeatureEnabled('feature-missing')).toEqual(false)
          expect(posthog.isFeatureEnabled('x-flag')).toEqual(true)
        })
      })

      describe('when subsequent decide calls return results without errors', () => {
        beforeEach(() => {
          ;[posthog, mocks] = createTestClient('TEST_API_KEY', { flushAt: 1 }, (_mocks) => {
            _mocks.fetch
              .mockImplementationOnce((url) => {
                if (url.includes('/decide/?v=3')) {
                  return Promise.resolve({
                    status: 200,
                    text: () => Promise.resolve('ok'),
                    json: () =>
                      Promise.resolve({
                        featureFlags: createMockFeatureFlags(),
                      }),
                  })
                }
                return errorAPIResponse
              })
              .mockImplementationOnce((url) => {
                if (url.includes('/decide/?v=3')) {
                  return Promise.resolve({
                    status: 200,
                    text: () => Promise.resolve('ok'),
                    json: () =>
                      Promise.resolve({
                        featureFlags: { 'x-flag': 'x-value', 'feature-1': false },
                        errorsWhileComputingFlags: false,
                      }),
                  })
                }

                return errorAPIResponse
              })
              .mockImplementation(() => {
                return errorAPIResponse
              })
          })

          posthog.reloadFeatureFlags()
        })

        it('should return only latest results', async () => {
          expect(mocks.fetch).toHaveBeenCalledWith('https://app.posthog.com/decide/?v=3', {
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

          // now second call to feature flags
          await posthog.reloadFeatureFlagsAsync(false)

          expect(mocks.fetch).toHaveBeenCalledWith('https://app.posthog.com/decide/?v=3', {
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
            'feature-1': false,
            'x-flag': 'x-value',
          })

          expect(posthog.getFeatureFlag('feature-1')).toEqual(false)
          expect(posthog.getFeatureFlag('feature-variant')).toEqual(false)
          expect(posthog.getFeatureFlag('feature-missing')).toEqual(false)
          expect(posthog.getFeatureFlag('x-flag')).toEqual('x-value')

          expect(posthog.isFeatureEnabled('feature-1')).toEqual(false)
          expect(posthog.isFeatureEnabled('feature-variant')).toEqual(false)
          expect(posthog.isFeatureEnabled('feature-missing')).toEqual(false)
          expect(posthog.isFeatureEnabled('x-flag')).toEqual(true)
        })
      })

      it('should return the boolean value of a flag', async () => {
        expect(posthog.isFeatureEnabled('feature-1')).toEqual(true)
        expect(posthog.isFeatureEnabled('feature-variant')).toEqual(true)
        expect(posthog.isFeatureEnabled('feature-missing')).toEqual(false)
      })

      it('should reload if groups are set', async () => {
        posthog.group('my-group', 'is-great')
        expect(mocks.fetch).toHaveBeenCalledTimes(2)
        expect(JSON.parse(mocks.fetch.mock.calls[1][1].body || '')).toMatchObject({
          groups: { 'my-group': 'is-great' },
        })
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

      it('should persist feature flags', () => {
        expect(posthog.getPersistedProperty(PostHogPersistedProperty.FeatureFlags)).toEqual(createMockFeatureFlags())
      })

      it('should include feature flags in subsequent captures', () => {
        posthog.capture('test-event', { foo: 'bar' })

        expect(parseBody(mocks.fetch.mock.calls[1])).toMatchObject({
          batch: [
            {
              event: 'test-event',
              distinct_id: posthog.getDistinctId(),
              properties: {
                $active_feature_flags: ['feature-1', 'feature-2', 'feature-variant', 'json-payload'],
                '$feature/feature-1': true,
                '$feature/feature-2': true,
                '$feature/json-payload': true,
                '$feature/feature-variant': 'variant',
              },
              type: 'capture',
            },
          ],
        })
      })

      it('should override flags', () => {
        posthog.overrideFeatureFlag({
          'feature-2': false,
          'feature-variant': 'control',
        })
        expect(posthog.getFeatureFlags()).toEqual({
          'json-payload': true,
          'feature-1': true,
          'feature-variant': 'control',
        })
      })
    })
  })

  describe('bootstapped feature flags', () => {
    beforeEach(() => {
      ;[posthog, mocks] = createTestClient(
        'TEST_API_KEY',
        {
          flushAt: 1,
          bootstrap: {
            distinctId: 'tomato',
            featureFlags: { 'bootstrap-1': 'variant-1', enabled: true, disabled: false },
            featureFlagPayloads: {
              'bootstrap-1': {
                some: 'key',
              },
              enabled: 200,
            },
          },
        },
        (_mocks) => {
          _mocks.fetch.mockImplementation((url) => {
            if (url.includes('/decide/')) {
              return Promise.resolve({
                status: 200,
                text: () => Promise.resolve('ok'),
                json: () =>
                  Promise.resolve({
                    featureFlags: createMockFeatureFlags(),
                    featureFlagPayloads: createMockFeatureFlagPayloads(),
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
        }
      )
    })

    it('getFeatureFlags should return bootstrapped flags', () => {
      expect(posthog.getFeatureFlags()).toEqual({ 'bootstrap-1': 'variant-1', enabled: true })
      expect(posthog.getDistinctId()).toEqual('tomato')
      expect(posthog.getAnonymousId()).toEqual('tomato')
    })

    it('getFeatureFlag should return bootstrapped flags', () => {
      expect(posthog.getFeatureFlag('my-flag')).toEqual(false)
      expect(posthog.getFeatureFlag('bootstrap-1')).toEqual('variant-1')
      expect(posthog.getFeatureFlag('enabled')).toEqual(true)
      expect(posthog.getFeatureFlag('disabled')).toEqual(false)
    })

    it('isFeatureEnabled should return true/false for bootstrapped flags', () => {
      expect(posthog.isFeatureEnabled('my-flag')).toEqual(false)
      expect(posthog.isFeatureEnabled('bootstrap-1')).toEqual(true)
      expect(posthog.isFeatureEnabled('enabled')).toEqual(true)
      expect(posthog.isFeatureEnabled('disabled')).toEqual(false)
    })

    it('getFeatureFlagPayload should return bootstrapped payloads', () => {
      expect(posthog.getFeatureFlagPayload('my-flag')).toEqual(null)
      expect(posthog.getFeatureFlagPayload('bootstrap-1')).toEqual({
        some: 'key',
      })
      expect(posthog.getFeatureFlagPayload('enabled')).toEqual(200)
    })

    describe('when loaded', () => {
      beforeEach(() => {
        posthog.reloadFeatureFlags()
      })

      it('should load new feature flags', async () => {
        expect(mocks.fetch).toHaveBeenCalledWith('https://app.posthog.com/decide/?v=3', {
          body: JSON.stringify({
            token: 'TEST_API_KEY',
            distinct_id: posthog.getDistinctId(),
            groups: {},
            person_properties: {},
            group_properties: {},
            $anon_distinct_id: 'tomato',
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
      })

      it('should load new feature flag payloads', async () => {
        expect(mocks.fetch).toHaveBeenCalledWith('https://app.posthog.com/decide/?v=3', {
          body: JSON.stringify({
            token: 'TEST_API_KEY',
            distinct_id: posthog.getDistinctId(),
            groups: {},
            person_properties: {},
            group_properties: {},
            $anon_distinct_id: 'tomato',
          }),
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
          },
          signal: expect.anything(),
        })
        expect(posthog.getFeatureFlagPayload('feature-1')).toEqual({
          color: 'blue',
        })
        expect(posthog.getFeatureFlagPayload('feature-variant')).toEqual(5)
      })
    })
  })
})

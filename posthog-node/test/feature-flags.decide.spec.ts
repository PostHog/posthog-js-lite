import { PostHog as PostHog, PostHogOptions } from '../src/posthog-node'
import fetch from '../src/fetch'
import { apiImplementation, apiImplementationV4 } from './test-utils'
import { waitForPromises } from 'posthog-core/test/test-utils/test-utils'
import { PostHogV4DecideResponse } from 'posthog-core/src/types'
jest.mock('../src/fetch')

jest.spyOn(console, 'debug').mockImplementation()

const mockedFetch = jest.mocked(fetch, true)

const posthogImmediateResolveOptions: PostHogOptions = {
  fetchRetryCount: 0,
}

describe('decide v4', () => {
  describe('getFeatureFlag v4', () => {
    it('returns false if the flag is not found', async () => {
      const decideResponse: PostHogV4DecideResponse = {
        flags: {},
        errorsWhileComputingFlags: false,
        requestId: '0152a345-295f-4fba-adac-2e6ea9c91082',
      }
      mockedFetch.mockImplementation(apiImplementationV4(decideResponse))

      const posthog = new PostHog('TEST_API_KEY', {
        host: 'http://example.com',
        ...posthogImmediateResolveOptions,
      })
      let capturedMessage: any
      posthog.on('capture', (message) => {
        capturedMessage = message
      })

      const result = await posthog.getFeatureFlag('non-existent-flag', 'some-distinct-id')

      expect(result).toBe(false)
      expect(mockedFetch).toHaveBeenCalledWith('http://example.com/decide/?v=4', expect.any(Object))

      await waitForPromises()
      expect(capturedMessage).toMatchObject({
        distinct_id: 'some-distinct-id',
        event: '$feature_flag_called',
        library: posthog.getLibraryId(),
        library_version: posthog.getLibraryVersion(),
        properties: {
          '$feature/non-existent-flag': false,
          $feature_flag: 'non-existent-flag',
          $feature_flag_response: false,
          $feature_flag_request_id: '0152a345-295f-4fba-adac-2e6ea9c91082',
          $groups: undefined,
          $lib: posthog.getLibraryId(),
          $lib_version: posthog.getLibraryVersion(),
          locally_evaluated: false,
        },
      })
    })

    it.each([
      {
        key: 'variant-flag',
        expectedResponse: 'variant-value',
        expectedReason: 'Matched condition set 3',
        expectedId: 2,
        expectedVersion: 23,
      },
      {
        key: 'boolean-flag',
        expectedResponse: true,
        expectedReason: 'Matched condition set 1',
        expectedId: 1,
        expectedVersion: 12,
      },
      {
        key: 'non-matching-flag',
        expectedResponse: false,
        expectedReason: 'Did not match any condition',
        expectedId: 3,
        expectedVersion: 2,
      },
    ])(
      'captures a feature flag called event with extra metadata when the flag is found',
      async ({ key, expectedResponse, expectedReason, expectedId, expectedVersion }) => {
        const decideResponse: PostHogV4DecideResponse = {
          flags: {
            'variant-flag': {
              key: 'variant-flag',
              enabled: true,
              variant: 'variant-value',
              reason: {
                code: 'variant',
                condition_index: 2,
                description: 'Matched condition set 3',
              },
              metadata: {
                id: 2,
                version: 23,
                payload: '{"key": "value"}',
                description: 'description',
              },
            },
            'boolean-flag': {
              key: 'boolean-flag',
              enabled: true,
              variant: undefined,
              reason: {
                code: 'boolean',
                condition_index: 1,
                description: 'Matched condition set 1',
              },
              metadata: {
                id: 1,
                version: 12,
                payload: undefined,
                description: 'description',
              },
            },
            'non-matching-flag': {
              key: 'non-matching-flag',
              enabled: false,
              variant: undefined,
              reason: {
                code: 'boolean',
                condition_index: 1,
                description: 'Did not match any condition',
              },
              metadata: {
                id: 3,
                version: 2,
                payload: undefined,
                description: 'description',
              },
            },
          },
          errorsWhileComputingFlags: false,
          requestId: '0152a345-295f-4fba-adac-2e6ea9c91082',
        }
        mockedFetch.mockImplementation(apiImplementationV4(decideResponse))

        const posthog = new PostHog('TEST_API_KEY', {
          host: 'http://example.com',
          ...posthogImmediateResolveOptions,
        })
        let capturedMessage: any
        posthog.on('capture', (message) => {
          capturedMessage = message
        })

        const result = await posthog.getFeatureFlag(key, 'some-distinct-id')

        expect(result).toBe(expectedResponse)
        expect(mockedFetch).toHaveBeenCalledWith('http://example.com/decide/?v=4', expect.any(Object))

        await waitForPromises()
        expect(capturedMessage).toMatchObject({
          distinct_id: 'some-distinct-id',
          event: '$feature_flag_called',
          library: posthog.getLibraryId(),
          library_version: posthog.getLibraryVersion(),
          properties: {
            [`$feature/${key}`]: expectedResponse,
            $feature_flag: key,
            $feature_flag_response: expectedResponse,
            $feature_flag_id: expectedId,
            $feature_flag_version: expectedVersion,
            $feature_flag_reason: expectedReason,
            $feature_flag_request_id: '0152a345-295f-4fba-adac-2e6ea9c91082',
            $groups: undefined,
            $lib: posthog.getLibraryId(),
            $lib_version: posthog.getLibraryVersion(),
            locally_evaluated: false,
          },
        })
      }
    )

    describe('getFeatureFlagPayload v4', () => {
      it('returns payload', async () => {
        mockedFetch.mockImplementation(
          apiImplementationV4({
            flags: {
              'flag-with-payload': {
                key: 'flag-with-payload',
                enabled: true,
                variant: undefined,
                reason: {
                  code: 'boolean',
                  condition_index: 1,
                  description: 'Matched condition set 2',
                },
                metadata: {
                  id: 1,
                  version: 12,
                  payload: '[0, 1, 2]',
                  description: 'description',
                },
              },
            },
            errorsWhileComputingFlags: false,
          })
        )

        const posthog = new PostHog('TEST_API_KEY', {
          host: 'http://example.com',
          ...posthogImmediateResolveOptions,
        })
        let capturedMessage: any
        posthog.on('capture', (message) => {
          capturedMessage = message
        })

        const result = await posthog.getFeatureFlagPayload('flag-with-payload', 'some-distinct-id')

        expect(result).toEqual([0, 1, 2])
        expect(mockedFetch).toHaveBeenCalledWith('http://example.com/decide/?v=4', expect.any(Object))

        await waitForPromises()
        expect(capturedMessage).toBeUndefined()
      })
    })
  })
})

describe('decide v3', () => {
  describe('getFeatureFlag v3', () => {
    it('returns false if the flag is not found', async () => {
      mockedFetch.mockImplementation(apiImplementation({ decideFlags: {} }))

      const posthog = new PostHog('TEST_API_KEY', {
        host: 'http://example.com',
        ...posthogImmediateResolveOptions,
      })
      let capturedMessage: any
      posthog.on('capture', (message) => {
        capturedMessage = message
      })

      const result = await posthog.getFeatureFlag('non-existent-flag', 'some-distinct-id')

      expect(result).toBe(false)
      expect(mockedFetch).toHaveBeenCalledWith('http://example.com/decide/?v=4', expect.any(Object))

      await waitForPromises()
      expect(capturedMessage).toMatchObject({
        distinct_id: 'some-distinct-id',
        event: '$feature_flag_called',
        library: posthog.getLibraryId(),
        library_version: posthog.getLibraryVersion(),
        properties: {
          '$feature/non-existent-flag': false,
          $feature_flag: 'non-existent-flag',
          $feature_flag_response: false,
          $groups: undefined,
          $lib: posthog.getLibraryId(),
          $lib_version: posthog.getLibraryVersion(),
          locally_evaluated: false,
        },
      })
    })

    describe('getFeatureFlagPayload v3', () => {
      it('returns payload', async () => {
        mockedFetch.mockImplementation(
          apiImplementation({
            decideFlags: {
              'flag-with-payload': true,
            },
            decideFlagPayloads: {
              'flag-with-payload': [0, 1, 2],
            },
          })
        )

        const posthog = new PostHog('TEST_API_KEY', {
          host: 'http://example.com',
          ...posthogImmediateResolveOptions,
        })
        let capturedMessage: any = undefined
        posthog.on('capture', (message) => {
          capturedMessage = message
        })

        const result = await posthog.getFeatureFlagPayload('flag-with-payload', 'some-distinct-id')

        expect(result).toEqual([0, 1, 2])
        expect(mockedFetch).toHaveBeenCalledWith('http://example.com/decide/?v=4', expect.any(Object))

        await waitForPromises()
        expect(capturedMessage).toBeUndefined()
      })
    })
  })
})

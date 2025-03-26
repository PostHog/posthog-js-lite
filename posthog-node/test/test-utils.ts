import { PostHogV4DecideResponse } from 'posthog-core/src/types'
import { normalizeDecideResponse } from 'posthog-core/src/featureFlagUtils'

/**
 * @param version - The version of the API response to return from the decide endpoint. This enables us to test back compat.
 */
export const versionedApiImplementation = (
  version: number,
  {
    localFlags,
    decideResponse,
    decideStatus = 200,
    localFlagsStatus = 200,
  }: {
    localFlags?: any
    decideResponse?: PostHogV4DecideResponse
    decideStatus?: number
    localFlagsStatus?: number
  }
) => {
  return (url: any): Promise<any> => {
    if ((url as any).includes('/decide/')) {
      return Promise.resolve({
        status: decideStatus,
        text: () => Promise.resolve('ok'),
        json: () => {
          if (decideStatus !== 200 || !decideResponse) {
            return Promise.resolve(decideResponse)
          } else {
            // Normalize decide response
            const normalizedDecideResponse = normalizeDecideResponse(decideResponse)

            return Promise.resolve(
              version === 4
                ? decideResponse
                : {
                    featureFlags: normalizedDecideResponse.featureFlags,
                    featureFlagPayloads: normalizedDecideResponse.featureFlagPayloads,
                  }
            )
          }
        },
      }) as any
    }

    if ((url as any).includes('api/feature_flag/local_evaluation?token=TEST_API_KEY&send_cohorts')) {
      return Promise.resolve({
        status: localFlagsStatus,
        text: () => Promise.resolve('ok'),
        json: () => Promise.resolve(localFlags),
      }) as any
    }

    if ((url as any).includes('batch/')) {
      return Promise.resolve({
        status: 200,
        text: () => Promise.resolve('ok'),
        json: () =>
          Promise.resolve({
            status: 'ok',
          }),
      }) as any
    }

    return Promise.resolve({
      status: 400,
      text: () => Promise.resolve('ok'),
      json: () =>
        Promise.resolve({
          status: 'ok',
        }),
    }) as any
  }
}

export const apiImplementation = ({
  localFlags,
  decideFlags,
  decideFlagPayloads,
  decideStatus = 200,
  localFlagsStatus = 200,
  errorsWhileComputingFlags = false,
}: {
  localFlags?: any
  decideFlags?: any
  decideFlagPayloads?: any
  decideStatus?: number
  localFlagsStatus?: number
  errorsWhileComputingFlags?: boolean
}) => {
  return (url: any): Promise<any> => {
    if ((url as any).includes('/decide/')) {
      return Promise.resolve({
        status: decideStatus,
        text: () => Promise.resolve('ok'),
        json: () => {
          if (decideStatus !== 200) {
            return Promise.resolve(decideFlags)
          } else {
            return Promise.resolve({
              featureFlags: decideFlags,
              featureFlagPayloads: Object.fromEntries(
                Object.entries(decideFlagPayloads || {}).map(([k, v]) => [k, JSON.stringify(v)])
              ),
              errorsWhileComputingFlags,
            })
          }
        },
      }) as any
    }

    if ((url as any).includes('api/feature_flag/local_evaluation?token=TEST_API_KEY&send_cohorts')) {
      return Promise.resolve({
        status: localFlagsStatus,
        text: () => Promise.resolve('ok'),
        json: () => Promise.resolve(localFlags),
      }) as any
    }

    if ((url as any).includes('batch/')) {
      return Promise.resolve({
        status: 200,
        text: () => Promise.resolve('ok'),
        json: () =>
          Promise.resolve({
            status: 'ok',
          }),
      }) as any
    }

    return Promise.resolve({
      status: 400,
      text: () => Promise.resolve('ok'),
      json: () =>
        Promise.resolve({
          status: 'ok',
        }),
    }) as any
  }
}

export const anyLocalEvalCall = [
  'http://example.com/api/feature_flag/local_evaluation?token=TEST_API_KEY&send_cohorts',
  expect.any(Object),
]
export const anyDecideCall = ['http://example.com/decide/?v=3', expect.any(Object)]

import { PostHogV4DecideResponse } from 'posthog-core/src/types'

type ErrorResponse = {
  status: number
  json: () => Promise<any>
}

export const apiImplementationV4 = (decideResponse: PostHogV4DecideResponse | ErrorResponse) => {
  return (url: any): Promise<any> => {
    if ((url as any).includes('/decide/?v=4')) {
      // Check if the response is a decide response or an error response
      return 'flags' in decideResponse
        ? Promise.resolve({
            status: 200,
            text: () => Promise.resolve('ok'),
            json: () => Promise.resolve(decideResponse),
          })
        : Promise.resolve({
            status: decideResponse.status,
            text: () => Promise.resolve('not-ok'),
            json: decideResponse.json,
          })
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
export const anyDecideCall = ['http://example.com/decide/?v=4', expect.any(Object)]

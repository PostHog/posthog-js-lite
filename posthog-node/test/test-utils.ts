import { JsonType, PostHogDecideResponse } from 'posthog-core/src/types'

export const versionedApiImplementation = (version: number, {
  localFlags,
  decideFlags,
  decideStatus = 200,
  localFlagsStatus = 200,
}: {
  localFlags?: any
  decideFlags?: any
  decideStatus?: number
  localFlagsStatus?: number
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
            return Promise.resolve(version === 4 ? {
              flags: decideFlags,
            } : {
              featureFlags: getFlagValuesFromFlags(decideFlags),
              featureFlagPayloads: getPayloadsFromFlags(decideFlags),
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

export const apiImplementation = ({
  localFlags,
  decideFlags,
  decideFlagPayloads,
  decideStatus = 200,
  localFlagsStatus = 200,
}: {
  localFlags?: any
  decideFlags?: any
  decideFlagPayloads?: any
  decideStatus?: number
  localFlagsStatus?: number
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

export const getFlagValuesFromFlags = (
  flags: PostHogDecideResponse['flags']
): Record<string, boolean | string | undefined> => {
  return Object.fromEntries(Object.entries(flags).map(([key, value]) => [key, value.variant ?? value.enabled]))
}

export const getPayloadsFromFlags = (flags: PostHogDecideResponse['flags']): Record<string, JsonType> => {
  return Object.fromEntries(
    Object.keys(flags)
      .filter((flag) => {
        const details = flags[flag]
        return details.enabled && details.metadata && details.metadata.payload !== undefined
      })
      .map((flag) => {
        // We've already verified this exists in the filter
        const payload = flags[flag].metadata?.payload as JsonType
        return [flag, payload]
      })
  )
}

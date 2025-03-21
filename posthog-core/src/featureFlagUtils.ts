import { FeatureFlagDetail, JsonType, PostHogDecideResponse } from './types'

export const getFlagValuesFromFlags = (
  flags: PostHogDecideResponse['flags']
): PostHogDecideResponse['featureFlags'] => {
  return Object.fromEntries(
    Object.entries(flags)
        .map(([key, detail]) => [key, getFeatureFlagValue(detail)])
        .filter(([, value]): boolean => value !== undefined)
  )
}

export const getPayloadsFromFlags = (
  flags: PostHogDecideResponse['flags']
): PostHogDecideResponse['featureFlagPayloads'] => {
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

export const getFlagDetailsFromFlagsAndPayloads = (decideResponse: PostHogDecideResponse): PostHogDecideResponse['flags'] => {
  const flags = decideResponse.featureFlags
  const payloads = decideResponse.featureFlagPayloads
  return Object.fromEntries(Object.entries(flags).map(([key, value]) => [key, {
      key: key,
      enabled: typeof value === 'string' ? true : value,
      variant: typeof value === 'string' ? value : undefined,
      reason: undefined,
      metadata: {
        id: undefined,
        version: undefined,
        payload: payloads?.[key],
        description: undefined,
      },
  }]))
}

export const getFeatureFlagValue = (detail: FeatureFlagDetail): boolean | string | undefined => {
  return detail.variant ?? detail.enabled
}

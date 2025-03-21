import { FeatureFlagDetail, JsonType, PostHogDecideResponse } from './types'

/**
 * Get the flag values from the flags v4 response.
 * @param flags - The flags
 * @returns The flag values
 */
export const getFlagValuesFromFlags = (
  flags: PostHogDecideResponse['flags']
): PostHogDecideResponse['featureFlags'] => {
  return Object.fromEntries(
    Object.entries(flags)
        .map(([key, detail]) => [key, getFeatureFlagValue(detail)])
        .filter(([, value]): boolean => value !== undefined)
  )
}

/**
 * Get the payloads from the flags v4 response.
 * @param flags - The flags
 * @returns The payloads
 */
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

/**
 * Get the flag details from the legacy v3 flags and payloads. As such, it will lack the reason, id, version, and description.
 * @param decideResponse - The decide response
 * @returns The flag details
 */
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

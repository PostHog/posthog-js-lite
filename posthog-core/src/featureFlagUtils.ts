import {
  FeatureFlagDetail,
  FeatureFlagValue,
  JsonType,
  PostHogDecideResponse,
  PostHogV3DecideResponse,
  PostHogV4DecideResponse,
} from './types'

export const normalizeDecideResponse = (
  decideResponse: PostHogV3DecideResponse | PostHogV4DecideResponse
): PostHogDecideResponse => {
  if ('flags' in decideResponse) {
    // Convert v4 format to v3 format
    const featureFlags = getFlagValuesFromFlags(decideResponse.flags)
    const featureFlagPayloads = getPayloadsFromFlags(decideResponse.flags)

    return {
      ...decideResponse,
      featureFlags,
      featureFlagPayloads,
    }
  } else {
    // Convert v3 format to v4 format
    const featureFlags = decideResponse.featureFlags ?? {}
    const featureFlagPayloads = decideResponse.featureFlagPayloads ?? {}
    const flags = Object.fromEntries(
      Object.entries(featureFlags).map(([key, value]) => [
        key,
        getFlagDetailFromFlagAndPayload(key, value, featureFlagPayloads[key]),
      ])
    )

    return {
      ...decideResponse,
      featureFlags,
      featureFlagPayloads,
      flags,
    }
  }
}

function getFlagDetailFromFlagAndPayload(
  key: string,
  value: FeatureFlagValue,
  payload: JsonType | undefined
): FeatureFlagDetail {
  return {
    key: key,
    enabled: typeof value === 'string' ? true : value,
    variant: typeof value === 'string' ? value : undefined,
    reason: undefined,
    metadata: {
      id: undefined,
      version: undefined,
      payload: payload ? JSON.stringify(payload) : undefined,
      description: undefined,
    },
  }
}

/**
 * Get the flag values from the flags v4 response.
 * @param flags - The flags
 * @returns The flag values
 */
export const getFlagValuesFromFlags = (
  flags: PostHogDecideResponse['flags']
): PostHogDecideResponse['featureFlags'] => {
  return Object.fromEntries(
    Object.entries(flags ?? {})
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
  const safeFlags = flags ?? {}
  return Object.fromEntries(
    Object.keys(safeFlags)
      .filter((flag) => {
        const details = safeFlags[flag]
        return details.enabled && details.metadata && details.metadata.payload !== undefined
      })
      .map((flag) => {
        const payload = safeFlags[flag].metadata?.payload as string
        return [flag, payload ? parsePayload(payload) : undefined]
      })
  )
}

/**
 * Get the flag details from the legacy v3 flags and payloads. As such, it will lack the reason, id, version, and description.
 * @param decideResponse - The decide response
 * @returns The flag details
 */
export const getFlagDetailsFromFlagsAndPayloads = (
  decideResponse: PostHogDecideResponse
): PostHogDecideResponse['flags'] => {
  const flags = decideResponse.featureFlags ?? {}
  const payloads = decideResponse.featureFlagPayloads ?? {}
  return Object.fromEntries(
    Object.entries(flags).map(([key, value]) => [
      key,
      {
        key: key,
        enabled: typeof value === 'string' ? true : value,
        variant: typeof value === 'string' ? value : undefined,
        reason: undefined,
        metadata: {
          id: undefined,
          version: undefined,
          payload: payloads?.[key] ? JSON.stringify(payloads[key]) : undefined,
          description: undefined,
        },
      },
    ])
  )
}

export const getFeatureFlagValue = (detail: FeatureFlagDetail): FeatureFlagValue | undefined => {
  return detail.variant ?? detail.enabled
}

export const parsePayload = (response: any): any => {
  if (typeof response !== 'string') {
    return response
  }

  try {
    return JSON.parse(response)
  } catch {
    return response
  }
}

import { useEffect, useState } from 'react'
import { usePostHog } from './usePostHog'
import { JsonType } from 'posthog-core/src'
import { PostHog } from '../posthog-rn'

export function useFeatureFlag(flag: string, client?: PostHog): string | boolean | undefined {
  const contextClient = usePostHog()
  const posthog = client || contextClient

  const [featureFlag, setFeatureFlag] = useState<boolean | string | undefined>(posthog?.getFeatureFlag(flag))

  useEffect(() => {
    if (!posthog) {
      return
    }
    setFeatureFlag(posthog.getFeatureFlag(flag))
    return posthog.onFeatureFlags(() => {
      setFeatureFlag(posthog.getFeatureFlag(flag))
    })
  }, [posthog, flag])

  return featureFlag
}

export type FeatureFlagWithPayload = [boolean | string | undefined, JsonType | undefined]

export function useFeatureFlagWithPayload(flag: string, client?: PostHog): FeatureFlagWithPayload {
  const contextClient = usePostHog()
  const posthog = client || contextClient

  const [featureFlag, setFeatureFlag] = useState<FeatureFlagWithPayload>([undefined, undefined])

  useEffect(() => {
    if (!posthog) {
      return
    }

    setFeatureFlag([posthog.getFeatureFlag(flag), posthog.getFeatureFlagPayload(flag)])
    return posthog.onFeatureFlags(() => {
      setFeatureFlag([posthog.getFeatureFlag(flag), posthog.getFeatureFlagPayload(flag)])
    })
  }, [posthog, flag])

  return featureFlag
}

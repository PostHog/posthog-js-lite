import { JsonType } from 'posthog-core/src'
import { useEffect, useState } from 'react'
import { usePostHog } from './usePostHog'

export function useFeatureFlag(flag: string): JsonType | undefined {
  const posthog = usePostHog()

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

import { useEffect, useState } from 'react'
import { usePostHog } from '../PostHogProvider'

export function useFeatureFlag(flag: string, defaultValue?: boolean | string) {
  const posthog = usePostHog()

  const [featureFlag, setFeatureFlag] = useState<boolean | string | undefined>(
    posthog?.getFeatureFlag(flag, defaultValue)
  )

  if (!posthog) return featureFlag

  useEffect(() => {
    setFeatureFlag(posthog.getFeatureFlag(flag, defaultValue))
    return posthog.onFeatureFlags((flags) => {
      setFeatureFlag(posthog.getFeatureFlag(flag, defaultValue))
    })
  }, [posthog, flag, defaultValue])

  return featureFlag
}

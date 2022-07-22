import { useEffect, useState } from 'react'
import { usePostHog } from './usePostHog'

export function useFeatureFlag(flag: string, defaultValue?: boolean | string): string | boolean | undefined {
  const posthog = usePostHog()

  const [featureFlag, setFeatureFlag] = useState<boolean | string | undefined>(
    posthog?.getFeatureFlag(flag, defaultValue)
  )

  if (!posthog) {
    return featureFlag
  }

  useEffect(() => {
    setFeatureFlag(posthog.getFeatureFlag(flag, defaultValue))
    return posthog.onFeatureFlags(() => {
      setFeatureFlag(posthog.getFeatureFlag(flag, defaultValue))
    })
  }, [posthog, flag, defaultValue])

  return featureFlag
}

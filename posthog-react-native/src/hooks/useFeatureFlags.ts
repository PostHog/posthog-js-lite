import { useEffect, useState } from 'react'
import type { PostHog } from '../posthog-rn'
import { PostHogDecideResponse } from 'posthog-core'
import { usePostHog } from './usePostHog'

export function useFeatureFlags(client?: PostHog): PostHogDecideResponse['featureFlags'] | undefined {
  const contextClient = usePostHog()
  const posthog = client || contextClient
  const [featureFlags, setFeatureFlags] = useState<PostHogDecideResponse['featureFlags'] | undefined>(
    posthog.getFeatureFlags()
  )

  useEffect(() => {
    setFeatureFlags(posthog.getFeatureFlags())
    return posthog.onFeatureFlags((flags) => {
      setFeatureFlags(flags)
    })
  }, [posthog])

  return featureFlags
}

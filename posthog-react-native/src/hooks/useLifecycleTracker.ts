import { useEffect, useRef } from 'react'
import { AppState } from 'react-native'
import type { PostHog } from '../posthog-rn'
import { usePostHog } from './usePostHog'

export function useLifecycleTracker(client?: PostHog): void {
  const openTrackedRef = useRef(false)
  const contextClient = usePostHog()
  const posthog = client || contextClient

  return useEffect(() => {
    if (!openTrackedRef.current) {
      openTrackedRef.current = true
      posthog.capture('Application Opened')
    }
    const subscription = AppState.addEventListener('change', (nextAppState) => {
      switch (nextAppState) {
        case 'active':
          return posthog.capture('Application Became Active')
        case 'background':
          return posthog.capture('Application Backgrounded')
        default:
          return
      }
    })

    return () => subscription.remove()
  }, [posthog])
}

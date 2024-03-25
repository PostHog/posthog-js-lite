import { useEffect, useRef } from 'react'
import { AppState } from 'react-native'
import type { PostHog } from '../posthog-rn'
import { usePostHog } from './usePostHog'

export function useLifecycleTracker(client?: PostHog): void {
  const openTrackedRef = useRef(false)
  const contextClient = usePostHog()
  const posthog = client || contextClient

  return useEffect(() => {
    const appProperties = posthog.getAppProperties()
    const appBuild = appProperties.$app_build
    const appVersion = appProperties.$app_version

    if (!openTrackedRef.current) {
      openTrackedRef.current = true
      posthog.capture('Application Opened', {
        version: appVersion,
        build: appBuild,
      })
    }
    const subscription = AppState.addEventListener('change', (nextAppState) => {
      switch (nextAppState) {
        case 'active':
          return posthog.capture('Application Became Active', {
            version: appVersion,
            build: appBuild,
          })
        case 'background':
          return posthog.capture('Application Backgrounded')
        default:
          return
      }
    })

    return () => subscription.remove()
  }, [posthog])
}

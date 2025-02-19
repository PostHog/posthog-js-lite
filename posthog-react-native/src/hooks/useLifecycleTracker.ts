import { useEffect, useRef } from 'react'
import { AppState } from 'react-native'
import type { PostHog } from '../posthog-rn'
import { usePostHog } from './usePostHog'
import { Linking } from 'react-native'

async function captureApplicationOpened(posthog: PostHog): Promise<void> {
  const url = (await Linking.getInitialURL()) ?? undefined
  posthog.capture('Application Opened', { url })
}

export function useLifecycleTracker(client?: PostHog): void {
  const openTrackedRef = useRef<boolean>(false)
  const contextClient = usePostHog()
  const posthog = client || contextClient

  return useEffect(() => {
    if (!openTrackedRef.current) {
      openTrackedRef.current = true
      captureApplicationOpened(posthog)
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

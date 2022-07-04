import { useEffect, useRef } from 'react'
import { AppState } from 'react-native'
import type { PostHogReactNative } from '..'

export function useLifecycleTracker(client: PostHogReactNative) {
  const openTrackedRef = useRef(false)

  return useEffect(() => {
    if (!openTrackedRef.current) {
      openTrackedRef.current = true
      client.capture('Application Opened')
    }
    const subscription = AppState.addEventListener('change', (nextAppState) => {
      switch (nextAppState) {
        case 'active':
          return client.capture('Application Became Active')
        case 'background':
          return client.capture('Application Backgrounded')
        default:
          return
      }
    })

    return () => subscription.remove()
  }, [client])
}

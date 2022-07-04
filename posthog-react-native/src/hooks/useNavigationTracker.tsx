import { useEffect, useRef } from 'react'
import { useNavigationState } from '@react-navigation/native'
import type { PostHogReactNative } from '..'

export interface PostHogNavigationTrackerOptions {
  ignoreScreens?: string[]
  routeToName?: (name: string, params: any) => string
  routeToProperties?: (name: string, params: any) => string
}

export function useNavigationTracker(client: PostHogReactNative, options?: PostHogNavigationTrackerOptions) {
  const routeRef = useRef('')
  const routes = useNavigationState((state) => state.routes)

  useEffect(() => {
    // TODO: Validate this is the right approach to determining screen name
    const previousRouteName = routeRef.current
    const currentRoute = routes[routes.length - 1]

    let currentRouteName =
      options?.routeToName?.(currentRoute?.name, currentRoute?.params) || currentRoute?.name || 'Unknown'

    if (currentRouteName && previousRouteName !== currentRouteName) {
      client.screen(currentRouteName)
    }

    // Save the current route name for later comparison
    routeRef.current = currentRouteName
  }, [useNavigationState])
}

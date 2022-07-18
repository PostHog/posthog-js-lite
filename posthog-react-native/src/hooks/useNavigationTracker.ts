import { useEffect } from 'react'
import { OptionalReactNativeNavigation } from '../optional-imports'
import type { PostHogReactNative } from '../posthog'
import { usePostHog } from '../PostHogProvider'

export interface PostHogNavigationTrackerOptions {
  ignoreScreens?: string[]
  routeToName?: (name: string, params: any) => string
  routeToProperties?: (name: string, params: any) => string
}

export function useNavigationTracker(options?: PostHogNavigationTrackerOptions, client?: PostHogReactNative) {
  const contextClient = usePostHog()
  const posthog = client || contextClient

  if (!posthog) return

  if (!OptionalReactNativeNavigation) {
    // TODO: Support all of the possible navigators
    throw new Error('Navigation tracking requires @react-native navigation')
  }

  const routes = OptionalReactNativeNavigation.useNavigationState((state) => state?.routes)
  const navigation = OptionalReactNativeNavigation.useNavigation()

  useEffect(() => {
    // NOTE: This method is not typed correctly but is available and takes care of parsing the router state correctly
    const currentRoute = (navigation as any).getCurrentRoute()
    if (!currentRoute) {
      return
    }

    let { name, params, state } = currentRoute

    if (state?.routes?.length) {
      const route = state.routes[state.routes.length - 1]
      name = route.name
      params = route.params
    }

    let currentRouteName = options?.routeToName?.(name, params) || name || 'Unknown'

    if (currentRouteName) {
      const properties = options?.routeToProperties?.(currentRouteName, params)
      posthog.screen(currentRouteName, properties)
    }
  }, [routes])
}

import { useEffect, useRef } from 'react'
import type { PostHogReactNative } from '..'
import OptionalImports from '../optional-imports'

const ReactNativeNavigation = OptionalImports.OptionalReactNativeNavigation

export interface PostHogNavigationTrackerOptions {
  ignoreScreens?: string[]
  routeToName?: (name: string, params: any) => string
  routeToProperties?: (name: string, params: any) => string
}

export function useNavigationTracker(client: PostHogReactNative, options?: PostHogNavigationTrackerOptions) {
  const routeRef = useRef('')

  if (!ReactNativeNavigation) {
    // TODO: Support all of the possible navigators
    throw new Error('Navigation tracking requires @react-native navigation')
  }

  const routes = ReactNativeNavigation.useNavigationState((state) => state?.routes)
  const navigation = ReactNativeNavigation.useNavigation()

  useEffect(() => {
    // NOTE: This method is not typed correctly but is available and takes care of parsing the router state correctly
    const currentRoute = (navigation as any).getCurrentRoute()
    if (!currentRoute) {
      return
    }

    const previousRouteName = routeRef.current
    let { name, params, state } = currentRoute

    if (state?.routes?.length) {
      const route = state.routes[state.routes.length - 1]
      name = route.name
      params = route.params
    }

    let currentRouteName = options?.routeToName?.(name, params) || name || 'Unknown'

    if (currentRouteName && previousRouteName !== currentRouteName) {
      const properties = options?.routeToProperties?.(currentRouteName, params)
      client.screen(currentRouteName, properties)
    }

    // Save the current route name for later comparison
    routeRef.current = currentRouteName
  }, [routes])
}

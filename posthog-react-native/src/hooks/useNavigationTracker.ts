import { useEffect } from 'react'
import { OptionalReactNativeNavigation } from '../optional-imports'
import type { PostHog } from '../posthog-rn'
import { usePostHog } from './usePostHog'

export interface PostHogNavigationTrackerOptions {
  ignoreScreens?: string[]
  routeToName?: (name: string, params: any) => string
  routeToProperties?: (name: string, params: any) => string
}

function _useNavigationTrackerDisabled() {
  return
}

function _useNavigationTracker(options?: PostHogNavigationTrackerOptions, client?: PostHog) {
  const contextClient = usePostHog()
  const posthog = client || contextClient

  if (!OptionalReactNativeNavigation) {
    // NOTE: This is taken care of by the export but we keep this here for TS
    return
  }

  const routes = OptionalReactNativeNavigation.useNavigationState((state) => state?.routes)
  const navigation = OptionalReactNativeNavigation.useNavigation()

  useEffect(() => {
    if (!posthog) return
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

export const useNavigationTracker = OptionalReactNativeNavigation
  ? _useNavigationTracker
  : _useNavigationTrackerDisabled

import { useEffect } from 'react'
import { OptionalReactNativeNavigation } from '../optional-imports'
import type { PostHog } from '../posthog-rn'
import { PostHogAutocaptureNavigationTrackerOptions } from '../types'
import { usePostHog } from './usePostHog'

function _useNavigationTrackerDisabled() {
  return
}

function _useNavigationTracker(options?: PostHogAutocaptureNavigationTrackerOptions, client?: PostHog) {
  const contextClient = usePostHog()
  const posthog = client || contextClient

  if (!OptionalReactNativeNavigation) {
    // NOTE: This is taken care of by the export but we keep this here for TS
    return
  }

  const routes = OptionalReactNativeNavigation.useNavigationState((state) => state?.routes)
  const navigation = OptionalReactNativeNavigation.useNavigation()

  const trackRoute = () => {
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
  }

  useEffect(() => {
    // NOTE: The navigation stacks may not be fully rendered initially. This means the first route can be missed (it doesn't update useNavigationState)
    // If missing we simply wait a tick and call it again.
    if (!routes) {
      setTimeout(trackRoute, 1)
      return
    }
    trackRoute()
  }, [routes])
}

export const useNavigationTracker = OptionalReactNativeNavigation
  ? _useNavigationTracker
  : _useNavigationTrackerDisabled

/*
 * Wix Navigation (react-native-navigation)
 *
 * Wix Navigation uses a very different paradigm for rendering screens, with a more imperative / config driven approach
 * Instead of hooking into the natural React lifecycle, it provides a very different API which we can hook into and use instead.
 */

import { AppState } from 'react-native'
import { OptionalReactNativeNavigationWix } from '../optional/OptionalReactNativeNavigationWix'
import { PostHog } from '../posthog-rn'
import { PostHogAutocaptureOptions } from '../types'

export const withReactNativeNavigation = (posthog: PostHog, options: PostHogAutocaptureOptions = {}): boolean => {
  if (!OptionalReactNativeNavigationWix) {
    return false
  }

  const Navigation = OptionalReactNativeNavigationWix.Navigation

  // Equivalent of `useLifecycleTracker`
  const trackLifecycle = (): void => {
    if (!(options.captureLifecycleEvents ?? true)) {
      return
    }

    const appProperties = posthog.getAppProperties()
    const appBuild = appProperties.$app_build
    const appVersion = appProperties.$app_version

    posthog.capture('Application Opened', {
      version: appVersion,
      build: appBuild,
    })

    AppState.addEventListener('change', (nextAppState) => {
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
  }

  trackLifecycle()

  // Equivalent of `useNavigationTracker`
  Navigation.events().registerComponentDidAppearListener(({ componentName, passProps }) => {
    if (!(options.captureScreens ?? true)) {
      return
    }

    const currentRouteName =
      options?.navigation?.routeToName?.(componentName, passProps || {}) || componentName || 'Unknown'

    if (currentRouteName) {
      const properties = options?.navigation?.routeToProperties?.(currentRouteName, passProps || {})
      posthog.screen(currentRouteName, properties)
    }
  })

  return true
}

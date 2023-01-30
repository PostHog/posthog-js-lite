import type ReactNativeNavigationWix from 'react-native-navigation'

export let OptionalReactNativeNavigationWix: typeof ReactNativeNavigationWix | undefined = undefined

try {
  OptionalReactNativeNavigationWix = require('react-native-navigation')
} catch (e) {}

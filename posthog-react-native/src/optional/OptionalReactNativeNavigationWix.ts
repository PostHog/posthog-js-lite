import { Platform } from 'react-native'
import type ReactNativeNavigationWix from 'react-native-navigation'

export let OptionalReactNativeNavigationWix: typeof ReactNativeNavigationWix | undefined = undefined

try {
  // macos/web not supported
  if (Platform.OS !== 'web' && Platform.OS !== 'macos') {
    OptionalReactNativeNavigationWix = require('react-native-navigation')
  }
} catch (e) {}

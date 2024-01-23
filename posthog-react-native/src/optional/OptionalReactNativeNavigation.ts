import type ReactNativeNavigation from '@react-navigation/native'
import { Platform } from 'react-native'

export let OptionalReactNativeNavigation: typeof ReactNativeNavigation | undefined = undefined

try {
  // macos not supported
  if (Platform.OS !== 'macos') {
    // experimental support for web https://reactnavigation.org/docs/web-support/
    OptionalReactNativeNavigation = require('@react-navigation/native')
  }
} catch (e) {}

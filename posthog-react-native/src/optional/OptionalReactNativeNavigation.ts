import type ReactNativeNavigation from '@react-navigation/native'

export let OptionalReactNativeNavigation: typeof ReactNativeNavigation | undefined = undefined

try {
  OptionalReactNativeNavigation = require('@react-navigation/native')
} catch (e) {}

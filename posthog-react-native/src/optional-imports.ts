import type ReactNativeNavigation from '@react-navigation/native'

let _OptionalReactNativeNavigation: typeof ReactNativeNavigation | undefined = undefined

const warn = (name: string): void => {
  console.warn(`PostHog: Missing ${name} optional dependency. Some functions may not work as expected...`)
}

try {
  _OptionalReactNativeNavigation = require('@react-navigation/native')
} catch (e) {
  warn('@react-navigation/native')
}

export const OptionalReactNativeNavigation = _OptionalReactNativeNavigation

import type ReactNativeNavigation from '@react-navigation/native'
import type * as ExpoLocalization from 'expo-localization'
import type * as ExpoNetwork from 'expo-network'

let _OptionalReactNativeNavigation: typeof ReactNativeNavigation | undefined = undefined
let _OptionalExpoLocalization: typeof ExpoLocalization | undefined = undefined
let _OptionalExpoNetwork: typeof ExpoNetwork | undefined = undefined

const warn = (name: string): void => {
  console.warn(`PostHog: Missing ${name} optional dependency. Some functions may not work as expected...`)
}

try {
  _OptionalReactNativeNavigation = require('@react-navigation/native')
} catch (e) {
  warn('@react-navigation/native')
}

try {
  _OptionalExpoLocalization = require('expo-localization')
} catch (e) {
  warn('expo-localization')
}

try {
  _OptionalExpoNetwork = require('expo-network')
} catch (e) {
  warn('expo-network')
}

export const OptionalReactNativeNavigation = _OptionalReactNativeNavigation
export const OptionalExpoLocalization = _OptionalExpoLocalization
export const OptionalExpoNetwork = _OptionalExpoNetwork

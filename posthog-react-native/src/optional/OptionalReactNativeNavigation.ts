import type ReactNativeNavigation from '@react-navigation/native'
import { warn } from './warning'

let _OptionalReactNativeNavigation: typeof ReactNativeNavigation | undefined = undefined

try {
  _OptionalReactNativeNavigation = require('@react-navigation/native')
} catch (e) {
  warn('@react-navigation/native')
}

export const OptionalReactNativeNavigation = _OptionalReactNativeNavigation

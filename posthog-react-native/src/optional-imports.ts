import type AsyncStorage from '@react-native-async-storage/async-storage'
import type ReactNativeNavigation from '@react-navigation/native'
import type * as ExpoApplication from 'expo-application'
import type * as ExpoDevice from 'expo-device'

let OptionalAsyncStorage: typeof AsyncStorage | undefined = undefined
let OptionalReactNativeNavigation: typeof ReactNativeNavigation | undefined = undefined
let OptionalExpoApplication: typeof ExpoApplication | undefined = undefined
let OptionalExpoDevice: typeof ExpoDevice | undefined = undefined

const warn = (name: string) => {
  console.warn(`PostHog: Missing ${name} optional dependency. Some functions may not work as expected...`)
}

try {
  try {
    OptionalAsyncStorage = require('@react-native-async-storage/async-storage').default
  } catch (e) {
    OptionalAsyncStorage = require('react-native').AsyncStorage
    if (!OptionalAsyncStorage) {
      throw new Error('Missing')
    }
  }
} catch (e) {
  warn('@react-native-async-storage/async-storage')
}

try {
  OptionalReactNativeNavigation = require('@react-navigation/native')
} catch (e) {
  warn('@react-navigation/native')
}

try {
  OptionalExpoApplication = require('expo-application')
} catch (e) {
  warn('expo-application')
}

try {
  OptionalExpoDevice = require('expo-device')
} catch (e) {
  warn('expo-device')
}

export default {
  OptionalAsyncStorage,
  OptionalReactNativeNavigation,
  OptionalExpoApplication,
  OptionalExpoDevice,
}

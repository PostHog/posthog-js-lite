import type ReactNativeNavigation from '@react-navigation/native'
import type ExpoApplication from 'expo-application'
import type ExpoDevice from 'expo-device'
import type ExpoLocalization from 'expo-localization'
import type ExpoFileSystem from 'expo-file-system'
import type AsyncStorage from '@react-native-async-storage/async-storage'

let _OptionalReactNativeNavigation: typeof ReactNativeNavigation | undefined = undefined
let _OptionalExpoApplication: typeof ExpoApplication | undefined = undefined
let _OptionalExpoDevice: typeof ExpoDevice | undefined = undefined
let _OptionalExpoLocalization: typeof ExpoLocalization | undefined = undefined
let _OptionalExpoFileSystem: typeof ExpoFileSystem | undefined = undefined
let _OptionalAsyncStorage: typeof AsyncStorage | undefined = undefined

const warn = (name: string): void => {
  console.warn(`PostHog: Missing ${name} optional dependency. Some functions may not work as expected...`)
}

try {
  _OptionalReactNativeNavigation = require('@react-navigation/native')
} catch (e) {
  warn('@react-navigation/native')
}

export const OptionalReactNativeNavigation = _OptionalReactNativeNavigation

try {
  _OptionalExpoApplication = require('expo-application')
} catch (e) {}

export const OptionalExpoApplication = _OptionalExpoApplication

try {
  _OptionalExpoDevice = require('expo-device')
} catch (e) {}

export const OptionalExpoDevice = _OptionalExpoDevice

try {
  _OptionalExpoLocalization = require('expo-localization')
} catch (e) {}

export const OptionalExpoLocalization = _OptionalExpoLocalization

try {
  _OptionalExpoFileSystem = require('expo-file-system')
} catch (e) {}

export const OptionalExpoFileSystem = _OptionalExpoFileSystem

try {
  _OptionalAsyncStorage = require('@react-native-async-storage/async-storage')
} catch (e) {}

export const OptionalAsyncStorage = _OptionalAsyncStorage

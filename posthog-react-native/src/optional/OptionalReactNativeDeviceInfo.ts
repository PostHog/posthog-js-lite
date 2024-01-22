import type ReactNativeDeviceInfo from 'react-native-device-info'

export let OptionalReactNativeDeviceInfo: typeof ReactNativeDeviceInfo | undefined = undefined

try {
  OptionalReactNativeDeviceInfo = require('react-native-device-info')  // No Web support
} catch (e) {}

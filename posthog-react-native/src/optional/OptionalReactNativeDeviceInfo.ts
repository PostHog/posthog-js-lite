import { Platform } from 'react-native'
import type ReactNativeDeviceInfo from 'react-native-device-info'

export let OptionalReactNativeDeviceInfo: typeof ReactNativeDeviceInfo | undefined = undefined

try {
  // macos not supported
  if (Platform.OS !== 'macos') {
    OptionalReactNativeDeviceInfo = require('react-native-device-info') // No Web support, returns unknown
  }
} catch (e) {}

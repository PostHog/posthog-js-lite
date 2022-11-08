import type ReactNativeDeviceInfo from 'react-native-device-info'
import { warn } from './warning'

let _OptionalReactNativeDeviceInfo: typeof ReactNativeDeviceInfo | undefined = undefined

try {
  _OptionalReactNativeDeviceInfo = require('react-native-device-info')
} catch (e) {
  warn('react-native-device-info')
}

export const OptionalReactNativeDeviceInfo = _OptionalReactNativeDeviceInfo

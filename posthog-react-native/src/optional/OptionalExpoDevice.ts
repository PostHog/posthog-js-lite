import type ExpoDevice from 'expo-device'
import { Platform } from 'react-native'

export let OptionalExpoDevice: typeof ExpoDevice | undefined = undefined

try {
  // macos not supported
  if (Platform.OS !== 'macos') {
    OptionalExpoDevice = require('expo-device')
  }
} catch (e) {}

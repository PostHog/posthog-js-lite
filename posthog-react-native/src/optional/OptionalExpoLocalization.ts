import type ExpoLocalization from 'expo-localization'
import { Platform } from 'react-native'

export let OptionalExpoLocalization: typeof ExpoLocalization | undefined = undefined

try {
  // macos not supported
  if (Platform.OS !== 'macos') {
    OptionalExpoLocalization = require('expo-localization')
  }
} catch (e) {}

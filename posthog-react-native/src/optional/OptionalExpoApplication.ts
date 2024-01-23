import type ExpoApplication from 'expo-application'
import { Platform } from 'react-native'

export let OptionalExpoApplication: typeof ExpoApplication | undefined = undefined

try {
  // macos not supported
  if (Platform.OS !== 'macos') {
    OptionalExpoApplication = require('expo-application')
  }
} catch (e) {}

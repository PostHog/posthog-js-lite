import type ExpoFileSystem from 'expo-file-system'
import { Platform } from 'react-native'

export let OptionalExpoFileSystem: typeof ExpoFileSystem | undefined = undefined

try {
  // do not try to load expo-file-system on web, otherwise it will throw an error
  // Error: The method or property expo-file-system.writeAsStringAsync is not available on web
  // See https://github.com/PostHog/posthog-js-lite/issues/140
  // Once expo-file-system is supported on web, we can remove this try/catch block
  // For now, use the react-native-async-storage/async-storage package instead
  if (Platform.OS !== 'web') {
    OptionalExpoFileSystem = require('expo-file-system') // No Web support
  }
} catch (e) {}

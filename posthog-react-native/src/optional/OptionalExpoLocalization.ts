import type ExpoLocalization from 'expo-localization'

export let OptionalExpoLocalization: typeof ExpoLocalization | undefined = undefined

try {
  OptionalExpoLocalization = require('expo-localization')
} catch (e) {}

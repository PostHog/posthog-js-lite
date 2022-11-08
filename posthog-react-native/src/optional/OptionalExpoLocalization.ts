import type ExpoLocalization from 'expo-localization'

let _OptionalExpoLocalization: typeof ExpoLocalization | undefined = undefined

try {
  _OptionalExpoLocalization = require('expo-localization')
} catch (e) {}

export const OptionalExpoLocalization = _OptionalExpoLocalization

import type ExpoApplication from 'expo-application'

let _OptionalExpoApplication: typeof ExpoApplication | undefined = undefined

try {
  _OptionalExpoApplication = require('expo-application')
} catch (e) {}

export const OptionalExpoApplication = _OptionalExpoApplication

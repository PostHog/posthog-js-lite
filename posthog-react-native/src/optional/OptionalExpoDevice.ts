import type ExpoDevice from 'expo-device'

let _OptionalExpoDevice: typeof ExpoDevice | undefined = undefined

try {
  _OptionalExpoDevice = require('expo-device')
} catch (e) {}

export const OptionalExpoDevice = _OptionalExpoDevice

import type ExpoDevice from 'expo-device'

export let OptionalExpoDevice: typeof ExpoDevice | undefined = undefined

try {
  OptionalExpoDevice = require('expo-device')
} catch (e) {}

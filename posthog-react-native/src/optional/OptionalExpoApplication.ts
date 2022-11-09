import type ExpoApplication from 'expo-application'

export let OptionalExpoApplication: typeof ExpoApplication | undefined = undefined

try {
  OptionalExpoApplication = require('expo-application')
} catch (e) {}

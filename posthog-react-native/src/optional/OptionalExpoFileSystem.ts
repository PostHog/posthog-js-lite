import type ExpoFileSystem from 'expo-file-system'

let _OptionalExpoFileSystem: typeof ExpoFileSystem | undefined = undefined

try {
  _OptionalExpoFileSystem = require('expo-file-system')
} catch (e) {}

export const OptionalExpoFileSystem = _OptionalExpoFileSystem

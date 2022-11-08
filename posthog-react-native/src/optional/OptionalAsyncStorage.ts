import type AsyncStorage from '@react-native-async-storage/async-storage'
import { warn } from './warning'

let _OptionalAsyncStorage: typeof AsyncStorage | undefined = undefined

try {
  _OptionalAsyncStorage = require('@react-native-async-storage/async-storage').default
} catch (e) {
  warn('@react-native-async-storage/async-storage')
}

export const OptionalAsyncStorage = _OptionalAsyncStorage

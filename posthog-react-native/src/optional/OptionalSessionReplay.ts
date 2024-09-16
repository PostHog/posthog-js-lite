import { Platform } from 'react-native'
// import type ReactNativeSessionReplay from 'posthog-react-native-session-replay'
import type ReactNativeSessionReplay from '../replay/ReactNativeSessionReplay'

export let OptionalReactNativeSessionReplay: typeof ReactNativeSessionReplay | undefined = undefined

try {
  // macos not supported
  OptionalReactNativeSessionReplay = Platform.select({
    macos: undefined,
    web: undefined,
    windows: undefined,
    native: undefined,
    default: require('posthog-react-native-session-replay'), // Only Android and iOS
  })
} catch (e) {}

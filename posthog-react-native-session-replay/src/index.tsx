import { NativeModules, Platform } from 'react-native';

const LINKING_ERROR =
  `The package 'posthog-react-native-session-replay' doesn't seem to be linked. Make sure: \n\n` +
  Platform.select({ ios: "- You have run 'pod install'\n", default: '' }) +
  '- You rebuilt the app after installing the package\n' +
  '- You are not using Expo Go\n';

const PostHogReactNativeSessionReplay = NativeModules.PostHogReactNativeSessionReplay
  ? NativeModules.PostHogReactNativeSessionReplay
  : new Proxy(
      {},
      {
        get() {
          throw new Error(LINKING_ERROR);
        },
      }
    );

export function start(sessionId: string, options: { [key: string]: any }, sdkOptions: { [key: string]: any }): Promise<void> {
  return PostHogReactNativeSessionReplay.start(sessionId, options, sdkOptions);
}

export function startSession(sessionId: string): Promise<void> {
  return PostHogReactNativeSessionReplay.startSession(sessionId);
}

export function endSession(): Promise<void> {
  return PostHogReactNativeSessionReplay.endSession();
}

export function isEnabled(): Promise<boolean> {
  return PostHogReactNativeSessionReplay.isEnabled();
}

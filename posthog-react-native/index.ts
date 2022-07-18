import { PostHogReactNative, PostHogReactNativeOptions } from './src/posthog'

export const PostHog = PostHogReactNative
export type PostHogOptions = PostHogReactNativeOptions

export * from './src/hooks/useLifecycleTracker'
export * from './src/hooks/useNavigationTracker'
export * from './src/hooks/useFeatureFlags'
export * from './src/PostHogProvider'

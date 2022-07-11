import { PostHogReactNative, PostHogReactNativeOptions } from './posthog'

export const PostHog = PostHogReactNative
export type PostHogOptions = PostHogReactNativeOptions

export * from './hooks/useLifecycleTracker'
export * from './hooks/useNavigationTracker'
export * from './PostHogProvider'

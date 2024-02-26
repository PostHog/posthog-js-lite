import { PostHogCoreOptions } from '../../posthog-core/src'

export type PostHogOptions = {
  autocapture?: boolean
  persistence?: 'localStorage' | 'sessionStorage' | 'cookie' | 'memory'
  persistence_name?: string
} & PostHogCoreOptions

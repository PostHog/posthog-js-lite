export * from './src/extensions/sentry-integration'
export * from './src/extensions/express'

import { defaultStackParser } from './src/extensions/error-tracking/stack-parser.edge'
import ErrorTracking from './src/error-tracking'

import { PostHogBackendClient } from './src/client'

ErrorTracking.stackParser = defaultStackParser
ErrorTracking.frameModifiers = []

export class PostHog extends PostHogBackendClient {
  getLibraryId(): string {
    return 'posthog-edge'
  }
}

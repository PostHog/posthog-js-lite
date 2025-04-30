export * from '../exports'

import { defaultStackParser } from '../extensions/error-tracking/stack-parser.edge'
import ErrorTracking from '../extensions/error-tracking'

import { PostHogBackendClient } from '../client'

ErrorTracking.stackParser = defaultStackParser
ErrorTracking.frameModifiers = []

export class PostHog extends PostHogBackendClient {
  getLibraryId(): string {
    return 'posthog-edge'
  }
}

export * from '../exports'

import { defaultStackParser } from '../extensions/error-tracking/stack-parser.node'
import { addSourceContext } from '../extensions/error-tracking/context-lines.node'
import ErrorTracking from '../extensions/error-tracking'

import { PostHogBackendClient } from '../client'

ErrorTracking.stackParser = defaultStackParser
ErrorTracking.frameModifiers = [addSourceContext]

export class PostHog extends PostHogBackendClient {
  getLibraryId(): string {
    return 'posthog-node'
  }
}

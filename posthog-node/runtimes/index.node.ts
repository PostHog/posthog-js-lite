import { defaultStackParser } from '../src/extensions/error-tracking/stack-parser.node'
import { addSourceContext } from '../src/extensions/error-tracking/context-lines.node'
import ErrorTracking from '../src/error-tracking'

import { PostHogBackendClient } from '../src/client'

ErrorTracking.stackParser = defaultStackParser
ErrorTracking.frameModifiers = [addSourceContext]

export class PostHog extends PostHogBackendClient {
  getLibraryId(): string {
    return 'posthog-node'
  }
}

export { MINIMUM_POLLING_INTERVAL, THIRTY_SECONDS } from './src/constants'
export * from './src/extensions/sentry-integration'
export * from './src/extensions/express'

import { defaultStackParser } from './src/extensions/error-tracking/stack-parser.node'
import ErrorTracking from './src/error-tracking'
import { addSourceContext } from './src/extensions/error-tracking/context-lines.node'

import { PostHogBackendClient } from './src/posthog-node'

ErrorTracking.stackParser = defaultStackParser
ErrorTracking.frameModifiers = [addSourceContext]

export class PostHog extends PostHogBackendClient {
  getLibraryId(): string {
    return 'posthog-node'
  }
}

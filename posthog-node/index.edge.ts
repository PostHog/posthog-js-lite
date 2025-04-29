import { defaultStackParser } from './src/extensions/error-tracking/stack-parser.edge'
import ErrorTracking from './src/error-tracking'

import { PostHogBackendClient } from './src/posthog-node'
import { StackFrameModifierFn } from './src/extensions/error-tracking/types'

ErrorTracking.stackParser = defaultStackParser
ErrorTracking.frameModifiers = []

export class PostHog extends PostHogBackendClient {
  getLibraryId(): string {
    return 'posthog-edge'
  }
  getStackFrameModifiers(): StackFrameModifierFn[] {
    return []
  }
}

import { version } from '../package.json'

import { PostHogBackendClient } from '../../posthog-core/src'
import { StackFrameModifierFn, StackParser } from 'posthog-core/src/extensions/error-tracking/types'

export class PostHog extends PostHogBackendClient {
  getLibraryId(): string {
    return 'posthog-edge'
  }
  getLibraryVersion(): string {
    return version
  }
  getStackParser(): StackParser | undefined {
    return undefined
  }
  getStackFrameModifiers(): StackFrameModifierFn[] {
    return []
  }
}

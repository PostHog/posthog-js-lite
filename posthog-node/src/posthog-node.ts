import { version } from '../package.json'

import { PostHogBackendClient } from '../../posthog-core/src'
import { PostHogNodeV1 } from './types'
import { StackFrameModifierFn, StackParser } from '../../posthog-core/src'
import { defaultStackParser } from './extensions/stack-parser'
import { addSourceContext } from './extensions/context-lines'

export class PostHog extends PostHogBackendClient implements PostHogNodeV1 {
  getLibraryId(): string {
    return 'posthog-node'
  }
  getLibraryVersion(): string {
    return version
  }
  getStackParser(): StackParser {
    return defaultStackParser
  }
  getStackFrameModifiers(): StackFrameModifierFn[] {
    return [addSourceContext]
  }
}

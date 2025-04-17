import { version } from '../package.json'

import { PostHogBackendClient } from '../../posthog-core/src'
import { PostHogNodeV1 } from './types'

export class PostHog extends PostHogBackendClient implements PostHogNodeV1 {
  getLibraryId(): string {
    return 'posthog-node'
  }
  getLibraryVersion(): string {
    return version
  }
}

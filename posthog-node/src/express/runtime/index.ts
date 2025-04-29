import { defaultStackParser } from '../../runtime/stack-trace'
import { RuntimeTypes } from 'posthog-node/src/types'

export const runtime = {
  stackParser: defaultStackParser,
} as RuntimeTypes

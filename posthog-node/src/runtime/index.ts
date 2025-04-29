import { RuntimeTypes } from '../types'
import { defaultStackParser } from './stack-trace'

export const runtime = {
  stackParser: defaultStackParser,
} as RuntimeTypes

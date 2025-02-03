// levels originally copied from Sentry to work with the sentry integration
// and to avoid relying on a frequently changing @sentry/types dependency
// but provided as an array of literal types, so we can constrain the level below
export const severityLevels = ['fatal', 'error', 'warning', 'log', 'info', 'debug'] as const
export declare type SeverityLevel = (typeof severityLevels)[number]

export interface PolymorphicEvent {
  [key: string]: unknown
  readonly type: string
  readonly target?: unknown
  readonly currentTarget?: unknown
}

export interface EventHint {
  mechanism?: Partial<Mechanism>
  syntheticException?: Error | null
}

export interface ErrorProperties {
  $exception_list: Exception[]
  $exception_level?: SeverityLevel
  $exception_DOMException_code?: string
  $exception_personURL?: string
}

export interface Exception {
  type?: string
  value?: string
  mechanism?: Mechanism
  module?: string
  thread_id?: number
  stacktrace?: { frames?: StackFrame[]; type: 'raw' }
}

export interface Mechanism {
  handled?: boolean
  type?: string
  source?: string
  synthetic?: boolean
}

export type StackParser = (stack: string, skipFirstLines?: number) => StackFrame[]
export type StackLineParserFn = (line: string) => StackFrame | undefined
export type StackLineParser = [number, StackLineParserFn]

export interface StackFrame {
  platform: string
  filename?: string
  function?: string
  module?: string
  lineno?: number
  colno?: number
  abs_path?: string
  context_line?: string
  pre_context?: string[]
  post_context?: string[]
  in_app?: boolean
  instruction_addr?: string
  addr_mode?: string
  vars?: { [key: string]: any }
  debug_id?: string
}

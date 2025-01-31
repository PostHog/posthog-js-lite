// levels originally copied from Sentry to work with the sentry integration
// and to avoid relying on a frequently changing @sentry/types dependency
// but provided as an array of literal types, so we can constrain the level below
export const severityLevels = ['fatal', 'error', 'warning', 'log', 'info', 'debug'] as const
export declare type SeverityLevel = (typeof severityLevels)[number]

export interface ErrorEvent extends Event {
  readonly colno: number
  readonly error: any
  readonly filename: string
  readonly lineno: number
  readonly message: string
}

export type ErrorEventArgs = [
  event: string | Event,
  source?: string | undefined,
  lineno?: number | undefined,
  colno?: number | undefined,
  error?: Error | undefined
]

export type ErrorMetadata = {
  handled?: boolean
  synthetic?: boolean
  syntheticException?: Error
  overrideExceptionType?: string
  overrideExceptionMessage?: string
  defaultExceptionType?: string
  defaultExceptionMessage?: string
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
  mechanism?: {
    /**
     * In theory, whether or not the exception has been handled by the user. In practice, whether or not we see it before
     * it hits the global error/rejection handlers, whether through explicit handling by the user or auto instrumentation.
     */
    handled?: boolean
    type?: string
    source?: string
    /**
     * True when `captureException` is called with anything other than an instance of `Error` (or, in the case of browser,
     * an instance of `ErrorEvent`, `DOMError`, or `DOMException`). causing us to create a synthetic error in an attempt
     * to recreate the stacktrace.
     */
    synthetic?: boolean
  }
  module?: string
  thread_id?: number
  stacktrace?: {
    frames?: StackFrame[]
    type: 'raw'
  }
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

export interface ErrorConversions {
  errorToProperties: (args: ErrorEventArgs) => ErrorProperties
}

import { isError, isErrorEvent, isEvent, isPlainObject } from './type-checking'
import { defaultStackParser } from './stack-trace'

import {
  ErrorEvent,
  ErrorEventArgs,
  ErrorMetadata,
  ErrorProperties,
  Exception,
  SeverityLevel,
  severityLevels,
  StackFrame,
} from './types'
import { isEmptyString, isString, isUndefined } from './utils'

/**
 * based on the very wonderful MIT licensed Sentry SDK
 */

const ERROR_TYPES_PATTERN =
  /^(?:[Uu]ncaught (?:exception: )?)?(?:((?:Eval|Internal|Range|Reference|Syntax|Type|URI|)Error): )?(.*)$/i

export function parseStackFrames(ex: Error & { stacktrace?: string }, framesToPop: number = 0): StackFrame[] {
  // Access and store the stacktrace property before doing ANYTHING
  // else to it because Opera is not very good at providing it
  // reliably in other circumstances.
  const stacktrace = ex.stacktrace || ex.stack || ''

  const skipLines = getSkipFirstStackStringLines(ex)

  try {
    const frames = defaultStackParser(stacktrace, skipLines)
    // frames are reversed so we remove the from the back of the array
    return frames.slice(0, frames.length - framesToPop)
  } catch {
    // no-empty
  }

  return []
}

const reactMinifiedRegexp = /Minified React error #\d+;/i

/**
 * Certain known React errors contain links that would be falsely
 * parsed as frames. This function check for these errors and
 * returns number of the stack string lines to skip.
 */
function getSkipFirstStackStringLines(ex: Error): number {
  if (ex && reactMinifiedRegexp.test(ex.message)) {
    return 1
  }

  return 0
}

function errorPropertiesFromError(error: Error, metadata?: ErrorMetadata): ErrorProperties {
  const frames = parseStackFrames(error)

  const handled = metadata?.handled ?? true
  const synthetic = metadata?.synthetic ?? false

  const exceptionType = metadata?.overrideExceptionType ? metadata.overrideExceptionType : error.name
  const exceptionMessage = metadata?.overrideExceptionMessage
    ? metadata.overrideExceptionMessage
    : extractMessage(error)

  return {
    $exception_list: [
      {
        type: exceptionType,
        value: exceptionMessage,
        stacktrace: {
          frames,
          type: 'raw',
        },
        mechanism: {
          handled,
          synthetic,
        },
      },
    ],
    $exception_level: 'error',
  }
}

/**
 * There are cases where stacktrace.message is an Event object
 * https://github.com/getsentry/sentry-javascript/issues/1949
 * In this specific case we try to extract stacktrace.message.error.message
 */
function extractMessage(err: Error & { message: { error?: Error } }): string {
  const message = err.message

  if (message.error && typeof message.error.message === 'string') {
    return message.error.message
  }

  return message
}

function errorPropertiesFromString(candidate: string, metadata?: ErrorMetadata): ErrorProperties {
  // Defaults for metadata are based on what the error candidate is.
  const handled = metadata?.handled ?? true
  const synthetic = metadata?.synthetic ?? true

  const exceptionType = metadata?.overrideExceptionType
    ? metadata.overrideExceptionType
    : metadata?.defaultExceptionType ?? 'Error'
  const exceptionMessage = metadata?.overrideExceptionMessage
    ? metadata.overrideExceptionMessage
    : candidate
    ? candidate
    : metadata?.defaultExceptionMessage

  const exception: Exception = {
    type: exceptionType,
    value: exceptionMessage,
    mechanism: {
      handled,
      synthetic,
    },
  }

  if (metadata?.syntheticException) {
    // Kludge: strip the last frame from a synthetically created error
    // so that it does not appear in a users stack trace
    const frames = parseStackFrames(metadata.syntheticException, 1)
    if (frames.length) {
      exception.stacktrace = { frames, type: 'raw' }
    }
  }

  return {
    $exception_list: [exception],
    $exception_level: 'error',
  }
}

/**
 * Given any captured exception, extract its keys and create a sorted
 * and truncated list that will be used inside the event message.
 * eg. `Non-error exception captured with keys: foo, bar, baz`
 */
function extractExceptionKeysForMessage(exception: Record<string, unknown>, maxLength = 40): string {
  const keys = Object.keys(exception)
  keys.sort()

  if (!keys.length) {
    return '[object has no keys]'
  }

  for (let i = keys.length; i > 0; i--) {
    const serialized = keys.slice(0, i).join(', ')
    if (serialized.length > maxLength) {
      continue
    }
    if (i === keys.length) {
      return serialized
    }
    return serialized.length <= maxLength ? serialized : `${serialized.slice(0, maxLength)}...`
  }

  return ''
}

function isSeverityLevel(x: unknown): x is SeverityLevel {
  return isString(x) && !isEmptyString(x) && severityLevels.indexOf(x as SeverityLevel) >= 0
}

function errorPropertiesFromObject(candidate: Record<string, unknown>, metadata?: ErrorMetadata): ErrorProperties {
  // Defaults for metadata are based on what the error candidate is.
  const handled = metadata?.handled ?? true
  const synthetic = metadata?.synthetic ?? true

  const exceptionType = metadata?.overrideExceptionType
    ? metadata.overrideExceptionType
    : isEvent(candidate)
    ? candidate.constructor.name
    : 'Error'
  const exceptionMessage = metadata?.overrideExceptionMessage
    ? metadata.overrideExceptionMessage
    : `Non-Error ${'exception'} captured with keys: ${extractExceptionKeysForMessage(candidate)}`

  const exception: Exception = {
    type: exceptionType,
    value: exceptionMessage,
    mechanism: {
      handled,
      synthetic,
    },
  }

  if (metadata?.syntheticException) {
    // Kludge: strip the last frame from a synthetically created error
    // so that it does not appear in a users stack trace
    const frames = parseStackFrames(metadata?.syntheticException, 1)
    if (frames.length) {
      exception.stacktrace = { frames, type: 'raw' }
    }
  }

  return {
    $exception_list: [exception],
    $exception_level: isSeverityLevel(candidate.level) ? candidate.level : 'error',
  }
}

export function errorToProperties(
  // eslint-disable-next-line @typescript-eslint/no-unused-vars
  [event, _, __, ___, error]: ErrorEventArgs,
  metadata?: ErrorMetadata
): ErrorProperties {
  const candidate = error || event

  if (isErrorEvent(candidate as ErrorEvent) && (candidate as ErrorEvent).error) {
    return errorPropertiesFromError((candidate as ErrorEvent).error as Error, metadata)
  } else if (isError(candidate)) {
    return errorPropertiesFromError(candidate, metadata)
  } else if (isPlainObject(candidate) || isEvent(candidate)) {
    // group these by using the keys available on the object
    const objectException = candidate as Record<string, unknown>
    return errorPropertiesFromObject(objectException, metadata)
  } else if (isUndefined(error) && isString(event)) {
    let name = 'Error'
    let message = event
    const groups = event.match(ERROR_TYPES_PATTERN)
    if (groups) {
      name = groups[1]
      message = groups[2]
    }

    return errorPropertiesFromString(message, {
      ...metadata,
      overrideExceptionType: name,
      defaultExceptionMessage: message,
    })
  } else {
    return errorPropertiesFromString(candidate as string, metadata)
  }
}

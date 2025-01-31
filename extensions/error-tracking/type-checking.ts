import { ErrorEvent } from './types'

export function isEvent(candidate: unknown): candidate is Event {
  return Event != undefined && isInstanceOf(candidate, Event)
}

export function isPlainObject(candidate: unknown): candidate is Record<string, unknown> {
  return isBuiltin(candidate, 'Object')
}

export function isInstanceOf(candidate: unknown, base: any): boolean {
  try {
    return candidate instanceof base
  } catch {
    return false
  }
}

export function isError(candidate: unknown): candidate is Error {
  switch (Object.prototype.toString.call(candidate)) {
    case '[object Error]':
    case '[object Exception]':
      return true
    default:
      return isInstanceOf(candidate, Error)
  }
}

export function isErrorEvent(event: string | Error | Event): event is ErrorEvent {
  return isBuiltin(event, 'ErrorEvent')
}

export function isBuiltin(candidate: unknown, className: string): boolean {
  return Object.prototype.toString.call(candidate) === `[object ${className}]`
}

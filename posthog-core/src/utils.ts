import { FetchLike } from './types'

export function assert(truthyValue: any, message: string): void {
  if (!truthyValue || typeof truthyValue !== 'string' || isEmpty(truthyValue)) {
    throw new Error(message)
  }
}

function isEmpty(truthyValue: string): boolean {
  if (truthyValue.trim().length === 0) {
    return true
  }
  return false
}

export function removeTrailingSlash(url: string): string {
  return url?.replace(/\/+$/, '')
}

export interface RetriableOptions {
  retryCount: number
  retryDelay: number
  retryCheck: (err: any) => boolean
}

export async function retriable<T>(fn: () => Promise<T>, props: RetriableOptions): Promise<T> {
  let lastError = null

  for (let i = 0; i < props.retryCount + 1; i++) {
    if (i > 0) {
      // don't wait when it's the last try
      await new Promise((r) => setTimeout(r, props.retryDelay))
    }

    try {
      const res = await fn()
      return res
    } catch (e) {
      lastError = e
      if (!props.retryCheck(e)) {
        throw e
      }
    }
  }

  throw lastError
}

export function currentTimestamp(): number {
  return new Date().getTime()
}

export function currentISOTime(): string {
  return new Date().toISOString()
}

export function safeSetTimeout(fn: () => void, timeout: number): any {
  // NOTE: we use this so rarely that it is totally fine to do `safeSetTimeout(fn, 0)``
  // rather than setImmediate.
  const t = setTimeout(fn, timeout) as any
  // We unref if available to prevent Node.js hanging on exit
  t?.unref && t?.unref()
  return t
}

// NOTE: We opt for this slightly imperfect check as the global "Promise" object can get mutated in certain environments
export const isPromise = (obj: any): obj is Promise<any> => {
  return obj && typeof obj.then === 'function'
}

export const isError = (x: unknown): x is Error => {
  return x instanceof Error
}

export function getFetch(): FetchLike | undefined {
  return typeof fetch !== 'undefined' ? fetch : typeof global.fetch !== 'undefined' ? global.fetch : undefined
}

// copied from: https://github.com/PostHog/posthog-js/blob/main/react/src/utils/type-utils.ts#L4
export const isFunction = function (f: any): f is (...args: any[]) => any {
  return typeof f === 'function'
}

function fnv1a(str: string): string {
  let hash = 0x811c9dc5 // FNV offset basis
  for (let i = 0; i < str.length; i++) {
    hash ^= str.charCodeAt(i)
    hash += (hash << 1) + (hash << 4) + (hash << 7) + (hash << 8) + (hash << 24)
  }
  // Convert to hex string, padding to 8 chars
  return (hash >>> 0).toString(16).padStart(8, '0')
}

export function isTokenInRollout(
  token: string,
  percentage: number = 0,
  includedHashes?: Set<string>,
  excludedHashes?: Set<string>
): boolean {
  const tokenHash = fnv1a(token)

  // Check included hashes
  if (includedHashes?.has(tokenHash)) {
    return true
  }

  // Check excluded hashes
  if (excludedHashes?.has(tokenHash)) {
    return false
  }

  // Convert hash to int and divide by max value to get number between 0-1
  const hashInt = parseInt(tokenHash, 16)
  const hashFloat = hashInt / 0xffffffff

  return hashFloat < percentage
}

import { FetchLike } from './types'

// Rollout constants
export const NEW_FLAGS_ROLLOUT_PERCENTAGE = 1
// The fnv1a hashes of the tokens that are explicitly included in the rollout
// see https://github.com/PostHog/posthog-js-lite/blob/main/posthog-core/src/utils.ts#L84
export const NEW_FLAGS_EXCLUDED_HASHES = new Set([
  '61be3dd8',
  '96f6df5f',
  '8cfdba9b',
  'bf027177',
  'e59430a8',
  '7fa5500b',
  '569798e9',
  '04809ff7',
  '0ebc61a5',
  '32de7f98',
  '3beeb69a',
  '12d34ad9',
  '733853ec',
  '0645bb64',
  '5dcbee21',
  'b1f95fa3',
  '2189e408',
  '82b460c2',
  '3a8cc979',
  '29ef8843',
  '2cdbf767',
  '38084b54',
])

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

// FNV-1a hash function
// https://en.wikipedia.org/wiki/Fowler%E2%80%93Noll%E2%80%93Vo_hash_function
// I know, I know, I'm rolling my own hash function, but I didn't want to take on
// a crypto dependency and this is just temporary anyway
function fnv1a(str: string): string {
  let hash = 0x811c9dc5 // FNV offset basis
  for (let i = 0; i < str.length; i++) {
    hash ^= str.charCodeAt(i)
    hash += (hash << 1) + (hash << 4) + (hash << 7) + (hash << 8) + (hash << 24)
  }
  // Convert to hex string, padding to 8 chars
  return (hash >>> 0).toString(16).padStart(8, '0')
}

export function isTokenInRollout(token: string, percentage: number = 0, excludedHashes?: Set<string>): boolean {
  const tokenHash = fnv1a(token)
  // Check excluded hashes (we're explicitly including these tokens from the rollout)
  if (excludedHashes?.has(tokenHash)) {
    return false
  }

  // Convert hash to int and divide by max value to get number between 0-1
  const hashInt = parseInt(tokenHash, 16)
  const hashFloat = hashInt / 0xffffffff

  return hashFloat < percentage
}

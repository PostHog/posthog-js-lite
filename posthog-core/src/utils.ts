export function assert(truthyValue: any, message: string): void {
  if (!truthyValue) {
    throw new Error(message)
  }
}

export function removeTrailingSlash(url: string): string {
  return url?.replace(/\/+$/, '')
}

export interface RetriableOptions {
  retryCount?: number
  retryDelay?: number
  retryCheck?: (err: any) => boolean
}

export async function retriable<T>(fn: () => Promise<T>, props: RetriableOptions = {}): Promise<T> {
  const { retryCount = 3, retryDelay = 5000, retryCheck = () => true } = props
  let lastError = null

  for (let i = 0; i < retryCount + 1; i++) {
    if (i > 0) {
      // don't wait when it's the last try
      await new Promise((r) => setTimeout(r, retryDelay))
    }

    try {
      const res = await fn()
      return res
    } catch (e) {
      lastError = e
      if (!retryCheck(e)) {
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

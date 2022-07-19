export function assert(truthyValue: any, message: string): void {
  if (!truthyValue) {
    throw new Error(message)
  }
}

export function removeTrailingSlash(url: string) {
  return url?.replace(/\/+$/, '')
}

export async function retriable<T>(
  fn: () => Promise<T>,
  props: { retryCount?: number; retryDelay?: number } = {}
): Promise<T> {
  const { retryCount = 3, retryDelay = 1000 } = props

  const shouldRetry = (err: any) => true

  for (let i = 0; i < retryCount; i++) {
    try {
      console.log('CALLING FETCH')
      const res = await fn()
      console.log('CALLING FETCH DONE', res)
      return res
    } catch (e) {
      console.log('ERRORED FETCH')
      if (!shouldRetry(e)) {
        throw e
      }
    }

    console.log('RETRY WAITING...')

    await new Promise((r) => setTimeout(r, retryDelay))
  }

  throw new Error('Retry failed')
}

// https://stackoverflow.com/a/8809472
export function generateUUID(globalThis?: any): string {
  // Public Domain/MIT
  var d = new Date().getTime() //Timestamp
  var d2 =
    (globalThis && globalThis.performance && globalThis.performance.now && globalThis.performance.now() * 1000) || 0 //Time in microseconds since page-load or 0 if unsupported
  return 'xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx'.replace(/[xy]/g, function (c) {
    var r = Math.random() * 16 //random number between 0 and 16
    if (d > 0) {
      //Use timestamp until depleted
      r = (d + r) % 16 | 0
      d = Math.floor(d / 16)
    } else {
      //Use microseconds since page-load if supported
      r = (d2 + r) % 16 | 0
      d2 = Math.floor(d2 / 16)
    }
    return (c === 'x' ? r : (r & 0x3) | 0x8).toString(16)
  })
}

export function currentTimestamp(): number {
  return new Date().getTime()
}

export function currentISOTime(): string {
  return new Date().toISOString()
}

export function isUndefined(obj: any) {
  return obj === void 0
}

export function safeSetTimeout(fn: () => void, timeout: number) {
  // NOTE: we use this so rarely that it is totally fine to do `safeSetTimeout(fn, 0)``
  // rather than setImmediate.
  const t = setTimeout(fn, timeout) as any
  // We unref if available to prevent Node.js hanging on exit
  t?.unref && t?.unref()
  return t
}

import { PostHogCoreStateless } from 'posthog-core/src'

/**
 * Older browsers and some runtimes don't support this yet
 */
export function isGzipSupported(): boolean {
  return 'CompressionStream' in globalThis
}

/**
 * Gzip a string using Compression Streams API if it's available
 */
export async function gzipCompress(input: string, posthog: PostHogCoreStateless): Promise<Blob | null> {
  if (!isGzipSupported()) return null
  try {
    // Turn the string into a stream using a Blob, and then compress it
    const dataStream = new Blob([input], {
      type: 'text/plain',
    }).stream()

    const compressedStream = dataStream.pipeThrough(new CompressionStream('gzip'))

    // Using a Response to easily extract the readablestream value. Decoding into a string for fetch
    return await new Response(compressedStream).blob()
  } catch (error) {
    if (posthog.isDebug) console.error('Failed to gzip compress data', error)
    return null
  }
}

/**
 * Older browsers and some runtimes don't support this yet
 */
export function isGzipSupported(): boolean {
  return 'CompressionStream' in globalThis;
}

/**
 * Gzip a string using Compression Streams API if it's available 
 */
export async function gzipCompress(input: string): Promise<Blob> {
  if (!isGzipSupported()) {throw new Error('Compression Streams API is not available in this runtime');}
  
  // Turn the string into a stream using a Blob, and then compress it
  const dataStream = new Blob([input], {
    type: 'text/plain'
  }).stream();

  const compressedStream = dataStream.pipeThrough(
    new CompressionStream("gzip"),
  );

  // Using a Response to easily extract the readablestream value. Decoding into a string for fetch
  return await new Response(compressedStream).blob()
}
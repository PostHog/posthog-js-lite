/// <reference lib="dom" />

export async function getNodeCrypto(): Promise<typeof import('crypto') | undefined> {
  try {
    return await import('crypto') // Import the node crypto module (not Web Crypto API despite the common name)
  } catch {
    return undefined
  }
}

export async function getWebCrypto(): Promise<SubtleCrypto | undefined> {
  if (typeof globalThis.crypto?.subtle !== 'undefined') {
    return globalThis.crypto.subtle
  }

  try {
    // Node.js: use built-in webcrypto and assign it if needed
    const { webcrypto } = await import('crypto') // Node.js only, since v15+
    if (webcrypto?.subtle) {
      return webcrypto.subtle as SubtleCrypto
    }
  } catch {
    // Ignore if not available
  }

  return undefined
}

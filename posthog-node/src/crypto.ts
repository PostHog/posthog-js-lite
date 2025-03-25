import crypto from 'crypto'

export async function hashSHA1(text: string): Promise<string> {
    // Node.js - use Node crypto
    return crypto.createHash('sha1').update(text).digest('hex')
} 
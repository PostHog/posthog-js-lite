import { PostHogOptions } from '../types'
import { createInternalPostHogInstance } from '../index'

export function nodePostHog(apiKey: string, options: PostHogOptions = {}) {
    return createInternalPostHogInstance(apiKey, options, globalThis)
}

/* global window */
import { createInternalPostHogInstance } from '../index'
import { PostHogOptions } from '../types'

function autoCapturePlugin() {}

export function browserPostHog(apiKey: string, options: PostHogOptions = {}) {
    return createInternalPostHogInstance(
        apiKey,
        {
            ...options,
            fetch: window.fetch.bind(window),
            plugins: [...(options.plugins || []), autoCapturePlugin()],
        },
        window
    )
}

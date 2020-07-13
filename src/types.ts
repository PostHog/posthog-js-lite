export type PostHogOptions = {
    plugins?: any[]
    apiHost?: string
    loaded?: () => any
    fetch?: any
    apiKey?: string
    maxQueueLength?: number
}

export type PostHogSession = {
    distinctId: string
}

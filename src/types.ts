export type PostHogOptions = {
    plugins?: any[]
    apiHost?: string
    loaded?: () => any
    fetch?: any
    apiKey?: string
    maxQueueLength?: number
    optedIn?: boolean
}

export type PostHogSession = {
    distinctId: string
    anonymousId: string
}

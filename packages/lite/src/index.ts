import { version } from '../package.json'
import { PostHogAPIRequest, PostHogOptions, PostHogSession } from './types'
import { currentISOTime, currentTimestamp, generateUUID } from './utils/utils'
import { getContext } from './utils/context'

import { LZString } from './utils/lz-string.js'

const defaultOptions: PostHogOptions = {
    apiHost: 'https://app.posthog.com',
    maxQueueLength: 1,
    optedIn: true,
}

export function createInternalPostHogInstance(apiKey: string, options: PostHogOptions, globalThis: any) {
    const session = {} as Partial<PostHogSession> // getDataFromCookiesAndLocalStorage
    const anonymousId = generateUUID(globalThis)

    let postHogInstance = {
        options: { ...defaultOptions, ...options, apiKey } as Required<PostHogOptions>,

        session: {
            anonymousId: anonymousId,
            distinctId: anonymousId,
            ...session,
        } as PostHogSession,

        getDistinctId() {
            return postHogInstance.session.distinctId
        },

        getContextProperties() {
            return {
                $lib: 'posthog-js-lite',
                $lib_version: version,
            }
        },

        optedIn() {
            return postHogInstance.options.optedIn
        },

        optIn() {
            postHogInstance.options.optedIn = true
            postHogInstance.flush()
        },

        optOut() {
            postHogInstance.options.optedIn = false
        },

        capture(event: string, properties = {}) {
            postHogInstance.enqueue({
                event,
                distinct_id: postHogInstance.getDistinctId(),
                timestamp: currentISOTime(),
                properties: {
                    ...getContext(globalThis), // TODO: debounce this, no need to do every event
                    ...properties,
                },
            })
        },

        identify(distinctId: string | null, userProperties = {}) {
            postHogInstance.enqueue({
                event: '$identify',
                distinct_id: distinctId || postHogInstance.session.anonymousId,
                timestamp: currentISOTime(),
                $set: {
                    ...userProperties,
                },
                properties: {
                    ...getContext(globalThis),
                    $anon_distinct_id: postHogInstance.session.anonymousId,
                },
            })
            if (distinctId) {
                postHogInstance.session.distinctId = distinctId
            }
        },

        queue: [] as PostHogAPIRequest[],
        enqueue(apiRequest: PostHogAPIRequest) {
            postHogInstance.queue.push(apiRequest)

            if (postHogInstance.optedIn() && postHogInstance.queue.length >= postHogInstance.options.maxQueueLength) {
                postHogInstance.flush()
            }
        },

        flush() {
            let queue = postHogInstance.queue
            postHogInstance.queue = []
            postHogInstance.makeRequest(queue)
        },

        makeRequest: async function (events: PostHogAPIRequest[]) {
            const requestData = {
                api_key: postHogInstance.options.apiKey,
                batch: events,
                sent_at: currentISOTime(),
            }

            const url = `${postHogInstance.options.apiHost}/e/?ip=1&_=${currentTimestamp()}&v=${version}`

            const payload = JSON.stringify(requestData)
            const compressedPayload = LZString.compressToBase64(payload)

            const fetchOptions = {
                method: 'POST',
                mode: 'no-cors',
                credentials: 'omit',
                headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
                body: `data=${encodeURIComponent(compressedPayload)}&compression=lz64`,
            }

            try {
                const rawResponse = await postHogInstance.options.fetch(url, fetchOptions)
                const body = await rawResponse.text()
            } catch (error) {
                // TODO: retry if fails?
                throw error
            }
        },
    }

    return postHogInstance
}

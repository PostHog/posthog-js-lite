import { version } from '../package.json'
import { PostHogOptions, PostHogSession } from './types'
import { currentISOTime, currentTimestamp, generateUuid } from './utils/utils'
import { getContext } from './utils/context'

import { LZString } from './utils/lz-string.js'

const defaultOptions: PostHogOptions = {
    apiHost: 'https://app.posthog.com',
    maxQueueLength: 1,
}

export function createInternalPostHogInstance(apiKey: string, options: PostHogOptions, globalThis: any) {
    const session = {} as PostHogSession // getDataFromCookiesAndLocalStorage

    let postHogInstance = {
        options: { ...defaultOptions, ...options, apiKey } as Required<PostHogOptions>,

        session: {
            distinctId: generateUuid(),
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

        queue: [],
        enqueue(apiRequest) {
            postHogInstance.queue.push(apiRequest)

            if (postHogInstance.queue.length >= postHogInstance.options.maxQueueLength) {
                let queue = postHogInstance.queue
                postHogInstance.queue = []
                postHogInstance.makeRequest(queue)
            }
        },

        makeRequest: async function (events) {
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
                console.log('response sent!')
            } catch (error) {
                // TODO: retry if fails?
                throw error
            }
        },
    }

    return postHogInstance
}

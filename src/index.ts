import { version } from '../package.json'
import { PostHogOptions, PostHogSession } from './types'
import { currentTimestamp, generateUuid } from './utils'

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
                timestamp: currentTimestamp(),
                properties: {
                    ...postHogInstance.getContextProperties(),
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
                timestamp: currentTimestamp(),
            }

            const url = `${postHogInstance.options.apiHost}/batch/`

            const fetchOptions = {
                // TODO: go through this list
                method: 'POST', // *GET, POST, PUT, DELETE, etc.
                mode: 'cors', // no-cors, *cors, same-origin
                cache: 'no-cache', // *default, no-cache, reload, force-cache, only-if-cached
                credentials: 'same-origin', // include, *same-origin, omit
                headers: {
                    'Content-Type': 'application/json',
                    // 'Content-Type': 'application/x-www-form-urlencoded',
                },
                redirect: 'follow', // manual, *follow, error
                referrerPolicy: 'no-referrer', // no-referrer, *no-referrer-when-downgrade, origin, origin-when-cross-origin, same-origin, strict-origin, strict-origin-when-cross-origin, unsafe-url
                body: JSON.stringify(requestData), // body data type must match "Content-Type" header
            }

            try {
                const rawResponse = await postHogInstance.options.fetch(url, fetchOptions)
                const response = await rawResponse.json()
                console.log('response sent!')
            } catch (error) {
                // TODO: retry if fails
                throw error
            }
        },
    }

    return postHogInstance
}

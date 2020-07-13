import * as ts from 'typescript'
import { createInternalPostHogInstance } from '../index'

test('capture makes a window.fetch call', () => {
    expect(true).toBe(true)

    const fetchCalled = []

    const postHog = createInternalPostHogInstance('API_KEY_WAS_HERE', {
        fetch: async (url, options) => {
            fetchCalled.push({ url, options })
        },
    })

    postHog.capture('hi there!')

    expect(fetchCalled.length).toBe(1)
    expect(fetchCalled[0].url).toBe("https://app.posthog.com/batch/")
    expect(fetchCalled[0].options.method).toBe("POST")

    const body = JSON.parse(fetchCalled[0].options.body)

    expect(body.api_key).toBe("API_KEY_WAS_HERE")
    expect(body.batch[0].event).toBe("hi there!")
})

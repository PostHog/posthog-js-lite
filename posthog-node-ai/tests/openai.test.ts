import { PostHog } from 'posthog-node'
import PostHogOpenAI from '../openai/index'

jest.mock('posthog-node', () => {
    return {
        PostHog: jest.fn().mockImplementation(() => {
            return {
                capture: jest.fn(),
                privacy_mode: false,
            }
        }),
    }
})

let mockOpenAiChatResponse: any = {}
let mockOpenAiEmbeddingResponse: any = {}


describe('PostHogOpenAI - Jest test suite', () => {
    let mockPostHogClient: PostHog
    let client: PostHogOpenAI

    beforeEach(() => {
        jest.clearAllMocks()

        // Reset the default mocks
        mockPostHogClient = new (PostHog as any)()
        client = new PostHogOpenAI({
            apiKey: process.env.OPENAI_API_KEY || '',
            posthog: mockPostHogClient as any,
        })

        // Some default chat completion mock
        mockOpenAiChatResponse = {
            id: 'test-response-id',
            model: 'gpt-4',
            object: 'chat.completion',
            created: Date.now() / 1000,
            choices: [
                {
                    index: 0,
                    finish_reason: 'stop',
                    message: {
                        role: 'assistant',
                        content: 'Hello from OpenAI!',
                    },
                },
            ],
            usage: {
                prompt_tokens: 20,
                completion_tokens: 10,
                total_tokens: 30,
            },
        }

        // Some default embedding mock
        mockOpenAiEmbeddingResponse = {
            data: [
                {
                    object: 'embedding',
                    index: 0,
                    embedding: [0.1, 0.2, 0.3],
                },
            ],
            model: 'text-embedding-3-small',
            object: 'list',
            usage: {
                prompt_tokens: 10,
                total_tokens: 10,
            },
        }
    })

    test('basic completion', async () => {
        // We ensure calls to create a completion return our mock
        // This is handled by the inherited Chat.Completions mock in openai
        const response = await client.chat.completions.create({
            model: 'gpt-4',
            messages: [{ role: 'user', content: 'Hello' }],
            posthog_distinct_id: 'test-id',
            posthog_properties: { foo: 'bar' },
        })

        expect(response).toEqual(mockOpenAiChatResponse)
        // We expect 1 capture call
        expect(mockPostHogClient.capture).toHaveBeenCalledTimes(1)
        // Check the capture arguments
        const [captureArgs] = (mockPostHogClient.capture as jest.Mock).mock.calls
        const { distinctId, event, properties } = captureArgs[0]

        expect(distinctId).toBe('test-id')
        expect(event).toBe('$ai_generation')
        expect(properties['$ai_provider']).toBe('openai')
        expect(properties['$ai_model']).toBe('gpt-4')
        expect(properties['$ai_input']).toEqual([{ role: 'user', content: 'Hello' }])
        expect(properties['$ai_output_choices']).toEqual([
            { role: 'assistant', content: 'Hello from OpenAI!' },
        ])
        expect(properties['$ai_input_tokens']).toBe(20)
        expect(properties['$ai_output_tokens']).toBe(10)
        expect(properties['$ai_http_status']).toBe(200)
        expect(properties['foo']).toBe('bar')
        expect(typeof properties['$ai_latency']).toBe('number')
    })

    test('embeddings', async () => {
        // Since embeddings calls are not implemented in the snippet by default,
        // we'll demonstrate how you *would* do it if WrappedEmbeddings is used.
        // Let's override the internal embeddings to return our mock.
        const mockEmbeddingsCreate = jest.fn().mockResolvedValue(mockOpenAiEmbeddingResponse)
        ;(client as any).embeddings = {
            create: mockEmbeddingsCreate,
        }

        const response = await (client as any).embeddings.create({
            model: 'text-embedding-3-small',
            input: 'Hello world',
            posthog_distinct_id: 'test-id',
            posthog_properties: { foo: 'bar' },
        })

        expect(response).toEqual(mockOpenAiEmbeddingResponse)
        expect(mockPostHogClient.capture).toHaveBeenCalledTimes(1)

        const [captureArgs] = (mockPostHogClient.capture as jest.Mock).mock.calls
        const { distinctId, event, properties } = captureArgs[0]

        expect(distinctId).toBe('test-id')
        expect(event).toBe('$ai_embedding')
        expect(properties['$ai_provider']).toBe('openai')
        expect(properties['$ai_model']).toBe('text-embedding-3-small')
        expect(properties['$ai_input']).toBe('Hello world')
        expect(properties['$ai_input_tokens']).toBe(10)
        expect(properties['$ai_http_status']).toBe(200)
        expect(properties['foo']).toBe('bar')
        expect(typeof properties['$ai_latency']).toBe('number')
    })

    test('groups', async () => {
        await client.chat.completions.create({
            model: 'gpt-4',
            messages: [{ role: 'user', content: 'Hello' }],
            posthog_distinct_id: 'test-id',
            posthog_groups: { company: 'test_company' },
        })
        expect(mockPostHogClient.capture).toHaveBeenCalledTimes(1)
        const [captureArgs] = (mockPostHogClient.capture as jest.Mock).mock.calls
        const { groups } = captureArgs[0]
        expect(groups).toEqual({ company: 'test_company' })
    })

    test('privacy mode local', async () => {
        await client.chat.completions.create({
            model: 'gpt-4',
            messages: [{ role: 'user', content: 'Hello' }],
            posthog_distinct_id: 'test-id',
            posthog_privacy_mode: true,
        })

        expect(mockPostHogClient.capture).toHaveBeenCalledTimes(1)
        const [captureArgs] = (mockPostHogClient.capture as jest.Mock).mock.calls
        const { properties } = captureArgs[0]
        expect(properties['$ai_input']).toBeNull()
        expect(properties['$ai_output_choices']).toBeNull()
    })

    test('privacy mode global', async () => {
        // override mock to appear globally in privacy mode
        ;(mockPostHogClient as any).privacy_mode = true

        await client.chat.completions.create({
            model: 'gpt-4',
            messages: [{ role: 'user', content: 'Hello' }],
            posthog_distinct_id: 'test-id',
            // we attempt to override locally, but it should still be null if global is true
            posthog_privacy_mode: false,
        })

        expect(mockPostHogClient.capture).toHaveBeenCalledTimes(1)
        const [captureArgs] = (mockPostHogClient.capture as jest.Mock).mock.calls
        const { properties } = captureArgs[0]
        expect(properties['$ai_input']).toBeNull()
        expect(properties['$ai_output_choices']).toBeNull()
    })

    test('core model params', async () => {
        mockOpenAiChatResponse.usage = {
            prompt_tokens: 20,
            completion_tokens: 10,
        }

        await client.chat.completions.create({
            model: 'gpt-4',
            // using openai-like params
            temperature: 0.5,
            max_completion_tokens: 100,
            stream: false,
            messages: [{ role: 'user', content: 'Hello' }],
            posthog_distinct_id: 'test-id',
            posthog_properties: { foo: 'bar' },
        })

        expect(mockPostHogClient.capture).toHaveBeenCalledTimes(1)
        const [captureArgs] = (mockPostHogClient.capture as jest.Mock).mock.calls
        const { properties } = captureArgs[0]

        expect(properties['$ai_model_parameters']).toEqual({
            temperature: 0.5,
            max_completion_tokens: 100,
            stream: false,
        })
        expect(properties['$ai_temperature']).toBe(0.5)
        expect(properties['$ai_max_tokens']).toBe(100)
        expect(properties['$ai_stream']).toBe(false)
        expect(properties['foo']).toBe('bar')
    })
})
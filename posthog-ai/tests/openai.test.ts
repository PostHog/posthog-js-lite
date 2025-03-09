import { PostHog } from 'posthog-node'
import PostHogOpenAI from '../src/openai'

jest.mock('posthog-node', () => {
  return {
    PostHog: jest.fn().mockImplementation(() => {
      return {
        capture: jest.fn(),
        privacyMode: false,
      }
    }),
  }
})

let mockOpenAiChatResponse: any = {}
let mockOpenAiEmbeddingResponse: any = {}

describe('PostHogOpenAI - Jest test suite', () => {
  let mockPostHogClient: PostHog
  let client: PostHogOpenAI

  beforeAll(() => {
    if (!process.env.OPENAI_API_KEY) {
      console.warn('⚠️ Skipping OpenAI tests: No OPENAI_API_KEY environment variable set')
    }
  })

  beforeEach(() => {
    // Skip all tests if no API key is present
    if (!process.env.OPENAI_API_KEY) {
      return
    }

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

  // Wrap each test with conditional skip
  const conditionalTest = process.env.OPENAI_API_KEY ? test : test.skip

  conditionalTest('basic completion', async () => {
    // We ensure calls to create a completion return our mock
    // This is handled by the inherited Chat.Completions mock in openai
    const response = await client.chat.completions.create({
      model: 'gpt-4',
      messages: [{ role: 'user', content: 'Hello' }],
      posthogDistinctId: 'test-id',
      posthogProperties: { foo: 'bar' },
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
    expect(properties['$ai_output_choices']).toEqual([{ role: 'assistant', content: 'Hello from OpenAI!' }])
    expect(properties['$ai_input_tokens']).toBe(20)
    expect(properties['$ai_output_tokens']).toBe(10)
    expect(properties['$ai_http_status']).toBe(200)
    expect(properties['foo']).toBe('bar')
    expect(typeof properties['$ai_latency']).toBe('number')
  })

  conditionalTest('embeddings', async () => {
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

  conditionalTest('groups', async () => {
    await client.chat.completions.create({
      model: 'gpt-4',
      messages: [{ role: 'user', content: 'Hello' }],
      posthogDistinctId: 'test-id',
      posthogGroups: { company: 'test_company' },
    })
    expect(mockPostHogClient.capture).toHaveBeenCalledTimes(1)
    const [captureArgs] = (mockPostHogClient.capture as jest.Mock).mock.calls
    const { groups } = captureArgs[0]
    expect(groups).toEqual({ company: 'test_company' })
  })

  conditionalTest('privacy mode local', async () => {
    await client.chat.completions.create({
      model: 'gpt-4',
      messages: [{ role: 'user', content: 'Hello' }],
      posthogDistinctId: 'test-id',
      posthogPrivacyMode: true,
    })

    expect(mockPostHogClient.capture).toHaveBeenCalledTimes(1)
    const [captureArgs] = (mockPostHogClient.capture as jest.Mock).mock.calls
    const { properties } = captureArgs[0]
    expect(properties['$ai_input']).toBeNull()
    expect(properties['$ai_output_choices']).toBeNull()
  })

  conditionalTest('privacy mode global', async () => {
    // override mock to appear globally in privacy mode
    ;(mockPostHogClient as any).privacy_mode = true

    await client.chat.completions.create({
      model: 'gpt-4',
      messages: [{ role: 'user', content: 'Hello' }],
      posthogDistinctId: 'test-id',
      // we attempt to override locally, but it should still be null if global is true
      posthogPrivacyMode: false,
    })

    expect(mockPostHogClient.capture).toHaveBeenCalledTimes(1)
    const [captureArgs] = (mockPostHogClient.capture as jest.Mock).mock.calls
    const { properties } = captureArgs[0]
    expect(properties['$ai_input']).toBeNull()
    expect(properties['$ai_output_choices']).toBeNull()
  })

  conditionalTest('core model params', async () => {
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
      posthogDistinctId: 'test-id',
      posthogProperties: { foo: 'bar' },
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

  conditionalTest('reasoning and cache tokens', async () => {
    // Set up mock response with standard token usage
    mockOpenAiChatResponse.usage = {
      prompt_tokens: 20,
      completion_tokens: 10,
      total_tokens: 30,
      // Add the detailed token usage that OpenAI would return
      completion_tokens_details: {
        reasoning_tokens: 15,
      },
      prompt_tokens_details: {
        cached_tokens: 5,
      },
    }

    // Create a completion with additional token tracking
    await client.chat.completions.create({
      model: 'gpt-4',
      messages: [{ role: 'user', content: 'Hello' }],
      posthogDistinctId: 'test-id',
      posthogProperties: { foo: 'bar' },
    })

    expect(mockPostHogClient.capture).toHaveBeenCalledTimes(1)
    const [captureArgs] = (mockPostHogClient.capture as jest.Mock).mock.calls
    const { properties } = captureArgs[0]

    // Check standard token properties
    expect(properties['$ai_input_tokens']).toBe(20)
    expect(properties['$ai_output_tokens']).toBe(10)

    // Check the new token properties
    expect(properties['$ai_reasoning_tokens']).toBe(15)
    expect(properties['$ai_cache_read_input_tokens']).toBe(5)
  })
})

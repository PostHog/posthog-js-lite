import OpenAIOrignal from 'openai'
import { PostHog } from 'posthog-node'
import { v4 as uuidv4 } from 'uuid'
import { PassThrough } from 'stream'
import { mergeSystemPrompt, MonitoringParams, sendEventToPosthog } from '../utils'

type ChatCompletion = OpenAIOrignal.ChatCompletion
type ChatCompletionChunk = OpenAIOrignal.ChatCompletionChunk
type ChatCompletionCreateParamsBase = OpenAIOrignal.Chat.Completions.ChatCompletionCreateParams
type ChatCompletionCreateParamsNonStreaming = OpenAIOrignal.Chat.Completions.ChatCompletionCreateParamsNonStreaming
type ChatCompletionCreateParamsStreaming = OpenAIOrignal.Chat.Completions.ChatCompletionCreateParamsStreaming
import type { APIPromise, RequestOptions } from 'openai/core'
import type { Stream } from 'openai/streaming'

interface MonitoringOpenAIConfig {
  apiKey: string
  posthog: PostHog
  baseURL?: string
}

export class PostHogOpenAI extends OpenAIOrignal {
  private readonly phClient: PostHog

  constructor(config: MonitoringOpenAIConfig) {
    const { posthog, ...openAIConfig } = config
    super(openAIConfig)
    this.phClient = posthog
    this.chat = new WrappedChat(this, this.phClient)
  }

  public chat: WrappedChat
}

export class WrappedChat extends OpenAIOrignal.Chat {
  constructor(parentClient: PostHogOpenAI, phClient: PostHog) {
    super(parentClient)
    this.completions = new WrappedCompletions(parentClient, phClient)
  }

  public completions: WrappedCompletions
}

export class WrappedCompletions extends OpenAIOrignal.Chat.Completions {
  private readonly phClient: PostHog

  constructor(client: OpenAIOrignal, phClient: PostHog) {
    super(client)
    this.phClient = phClient
  }

  // --- Overload #1: Non-streaming
  public create(
    body: ChatCompletionCreateParamsNonStreaming & MonitoringParams,
    options?: RequestOptions
  ): APIPromise<ChatCompletion>

  // --- Overload #2: Streaming
  public create(
    body: ChatCompletionCreateParamsStreaming & MonitoringParams,
    options?: RequestOptions
  ): APIPromise<Stream<ChatCompletionChunk>>

  // --- Overload #3: Generic base
  public create(
    body: ChatCompletionCreateParamsBase & MonitoringParams,
    options?: RequestOptions
  ): APIPromise<ChatCompletion | Stream<ChatCompletionChunk>>

  // --- Implementation Signature
  public create(
    body: ChatCompletionCreateParamsBase & MonitoringParams,
    options?: RequestOptions
  ): APIPromise<ChatCompletion | Stream<ChatCompletionChunk>> {
    const {
      posthog_distinct_id,
      posthog_trace_id,
      posthog_properties,
      posthog_privacy_mode = false,
      posthog_groups,
      ...openAIParams
    } = body

    const traceId = posthog_trace_id ?? uuidv4()
    const startTime = Date.now()

    const parentPromise = super.create(openAIParams, options)

    if (openAIParams.stream) {
      return parentPromise.then((value) => {
        const passThroughStream = new PassThrough({ objectMode: true })
        let accumulatedContent = ''
        let usage: { input_tokens: number; output_tokens: number } = {
          input_tokens: 0,
          output_tokens: 0,
        }
        if ('tee' in value) {
          const openAIStream = value
          ;(async () => {
            try {
              for await (const chunk of openAIStream) {
                const delta = chunk?.choices?.[0]?.delta?.content ?? ''
                accumulatedContent += delta
                if (chunk.usage) {
                  usage = {
                    input_tokens: chunk.usage.prompt_tokens ?? 0,
                    output_tokens: chunk.usage.completion_tokens ?? 0,
                  }
                }
                passThroughStream.write(chunk)
              }
              const latency = (Date.now() - startTime) / 1000
              sendEventToPosthog({
                client: this.phClient,
                distinctId: posthog_distinct_id ?? traceId,
                traceId,
                model: openAIParams.model,
                provider: 'openai',
                input: posthog_privacy_mode ? '' : mergeSystemPrompt(openAIParams, 'openai'),
                output: [{ content: accumulatedContent, role: 'assistant' }],
                latency,
                baseURL: (this as any).baseURL ?? '',
                params: body,
                httpStatus: 200,
                usage,
              })
              passThroughStream.end()
            } catch (error) {
              // error handling
              sendEventToPosthog({
                client: this.phClient,
                distinctId: posthog_distinct_id ?? traceId,
                traceId,
                model: openAIParams.model,
                provider: 'openai',
                input: posthog_privacy_mode ? '' : mergeSystemPrompt(openAIParams, 'openai'),
                output: [],
                latency: 0,
                baseURL: (this as any).baseURL ?? '',
                params: body,
                httpStatus: 500,
                usage: {
                  input_tokens: 0,
                  output_tokens: 0,
                },
              })
              passThroughStream.emit('error', error)
            }
          })()
        }
        return passThroughStream as unknown as Stream<ChatCompletionChunk>
      }) as APIPromise<Stream<ChatCompletionChunk>>
    } else {
      const wrappedPromise = parentPromise.then(
        (result) => {
          if ('choices' in result) {
            const latency = (Date.now() - startTime) / 1000
            sendEventToPosthog({
              client: this.phClient,
              distinctId: posthog_distinct_id ?? traceId,
              traceId,
              model: openAIParams.model,
              provider: 'openai',
              input: posthog_privacy_mode ? '' : mergeSystemPrompt(openAIParams, 'openai'),
              output: [{ content: result.choices[0].message.content, role: 'assistant' }],
              latency,
              baseURL: (this as any).baseURL ?? '',
              params: body,
              httpStatus: 200,
              usage: {
                input_tokens: result.usage?.prompt_tokens ?? 0,
                output_tokens: result.usage?.completion_tokens ?? 0,
              },
            })
          }
          return result
        },
        (error) => {
          sendEventToPosthog({
            client: this.phClient,
            distinctId: posthog_distinct_id ?? traceId,
            traceId,
            model: openAIParams.model,
            provider: 'openai',
            input: posthog_privacy_mode ? '' : mergeSystemPrompt(openAIParams, 'openai'),
            output: [],
            latency: 0,
            baseURL: (this as any).baseURL ?? '',
            params: body,
            httpStatus: 500,
            usage: {
              input_tokens: 0,
              output_tokens: 0,
            },
          })
          throw error
        }
      ) as APIPromise<ChatCompletion>

      return wrappedPromise
    }
  }
}

export default PostHogOpenAI

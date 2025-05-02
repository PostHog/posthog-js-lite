import OpenAIOrignal, { AzureOpenAI } from 'openai'
import { PostHog } from 'posthog-node'
import { v4 as uuidv4 } from 'uuid'
import { formatResponseOpenAI, MonitoringParams, sendEventToPosthog } from '../utils'

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

export class PostHogAzureOpenAI extends AzureOpenAI {
  private readonly phClient: PostHog
  public chat: WrappedChat

  constructor(config: MonitoringOpenAIConfig) {
    const { posthog, ...openAIConfig } = config
    super(openAIConfig)
    this.phClient = posthog
    this.chat = new WrappedChat(this, this.phClient)
  }
}

export class WrappedChat extends AzureOpenAI.Chat {
  constructor(parentClient: PostHogAzureOpenAI, phClient: PostHog) {
    super(parentClient)
    this.completions = new WrappedCompletions(parentClient, phClient)
  }

  public completions: WrappedCompletions
}

export class WrappedCompletions extends AzureOpenAI.Chat.Completions {
  private readonly phClient: PostHog

  constructor(client: AzureOpenAI, phClient: PostHog) {
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
      posthogDistinctId,
      posthogTraceId,
      posthogProperties,
      // eslint-disable-next-line @typescript-eslint/no-unused-vars
      posthogPrivacyMode = false,
      posthogGroups,
      ...openAIParams
    } = body

    const traceId = posthogTraceId ?? uuidv4()
    const startTime = Date.now()
    const parentPromise = super.create(openAIParams, options)

    if (openAIParams.stream) {
      return parentPromise.then((value) => {
        let accumulatedContent = ''
        let usage: {
          inputTokens: number
          outputTokens: number
          reasoningTokens?: number
          cacheReadInputTokens?: number
        } = {
          inputTokens: 0,
          outputTokens: 0,
        }
        let model = openAIParams.model
        if ('tee' in value) {
          const [stream1, stream2] = value.tee()
          ;(async () => {
            try {
              for await (const chunk of stream1) {
                const delta = chunk?.choices?.[0]?.delta?.content ?? ''
                accumulatedContent += delta
                if (chunk.usage) {
                  if (chunk.model != model) {
                    model = chunk.model
                  }
                  usage = {
                    inputTokens: chunk.usage.prompt_tokens ?? 0,
                    outputTokens: chunk.usage.completion_tokens ?? 0,
                    reasoningTokens: chunk.usage.completion_tokens_details?.reasoning_tokens ?? 0,
                    cacheReadInputTokens: chunk.usage.prompt_tokens_details?.cached_tokens ?? 0,
                  }
                }
              }
              const latency = (Date.now() - startTime) / 1000
              sendEventToPosthog({
                client: this.phClient,
                distinctId: posthogDistinctId ?? traceId,
                traceId,
                model,
                provider: 'azure',
                input: openAIParams.messages,
                output: [{ content: accumulatedContent, role: 'assistant' }],
                latency,
                baseURL: (this as any).baseURL ?? '',
                params: body,
                httpStatus: 200,
                usage,
              })
            } catch (error: any) {
              // error handling
              sendEventToPosthog({
                client: this.phClient,
                distinctId: posthogDistinctId ?? traceId,
                traceId,
                model,
                provider: 'azure',
                input: openAIParams.messages,
                output: JSON.stringify(error),
                latency: 0,
                baseURL: (this as any).baseURL ?? '',
                params: body,
                httpStatus: error?.status ? error.status : 500,
                usage: {
                  inputTokens: 0,
                  outputTokens: 0,
                },
                isError: true,
                error: JSON.stringify(error),
              })
            }
          })()

          // Return the other stream to the user
          return stream2
        }
        return value
      }) as APIPromise<Stream<ChatCompletionChunk>>
    } else {
      const wrappedPromise = parentPromise.then(
        (result) => {
          if ('choices' in result) {
            const latency = (Date.now() - startTime) / 1000
            let model = openAIParams.model
            if (result.model != model) {
              model = result.model
            }
            sendEventToPosthog({
              client: this.phClient,
              distinctId: posthogDistinctId ?? traceId,
              traceId,
              model,
              provider: 'azure',
              input: openAIParams.messages,
              output: formatResponseOpenAI(result),
              latency,
              baseURL: (this as any).baseURL ?? '',
              params: body,
              httpStatus: 200,
              usage: {
                inputTokens: result.usage?.prompt_tokens ?? 0,
                outputTokens: result.usage?.completion_tokens ?? 0,
                reasoningTokens: result.usage?.completion_tokens_details?.reasoning_tokens ?? 0,
                cacheReadInputTokens: result.usage?.prompt_tokens_details?.cached_tokens ?? 0,
              },
            })
          }
          return result
        },
        (error: any) => {
          sendEventToPosthog({
            client: this.phClient,
            distinctId: posthogDistinctId ?? traceId,
            traceId,
            model: openAIParams.model,
            provider: 'azure',
            input: openAIParams.messages,
            output: [],
            latency: 0,
            baseURL: (this as any).baseURL ?? '',
            params: body,
            httpStatus: error?.status ? error.status : 500,
            usage: {
              inputTokens: 0,
              outputTokens: 0,
            },
            isError: true,
            error: JSON.stringify(error),
          })
          throw error
        }
      ) as APIPromise<ChatCompletion>

      return wrappedPromise
    }
  }
}

export default PostHogAzureOpenAI

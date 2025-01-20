import type { ChatCompletionCreateParamsBase } from 'openai/resources/chat/completions';
import type { ChatCompletionCreateParamsStreaming } from 'openai/resources/chat/completions';
import OpenAIOrignal from 'openai';
import type { PostHog } from 'posthog-node';
import { v4 as uuidv4 } from 'uuid';
import { PassThrough } from 'stream'
import { mergeSystemPrompt, type MonitoringParams, sendEventToPosthog } from '../utils';

type ChatCompletion = OpenAIOrignal.ChatCompletion;
type ChatCompletionChunk = OpenAIOrignal.ChatCompletionChunk;
import type { ChatCompletionCreateParamsNonStreaming } from 'openai/resources/chat/completions'
import type { APIPromise, RequestOptions } from 'openai/core';
import type { Stream } from 'openai/streaming';

interface MonitoringOpenAIConfig {
  apiKey: string;
  posthog: PostHog;
  baseURL?: string;
}

export class PostHogOpenAI extends OpenAIOrignal {
  private readonly phClient: PostHog;

  constructor(config: MonitoringOpenAIConfig) {
    const { posthog, ...openAIConfig } = config;
    super(openAIConfig);
    this.phClient = posthog;
    this.chat = new WrappedChat(this, this.phClient);
  }

  public chat: WrappedChat;
}

export class WrappedChat extends OpenAIOrignal.Chat {
  constructor(parentClient: PostHogOpenAI, phClient: PostHog) {
    super(parentClient);
    this.completions = new WrappedCompletions(parentClient, phClient);
  }

  public completions: WrappedCompletions;
}

export class WrappedCompletions extends OpenAIOrignal.Chat.Completions {
  private readonly phClient: PostHog;

  constructor(client: OpenAIOrignal, phClient: PostHog) {
    super(client);
    this.phClient = phClient;
  }

  // --- Overload #1: Non-streaming
  public create(
    body: ChatCompletionCreateParamsNonStreaming & MonitoringParams,
    options?: RequestOptions
  ): APIPromise<ChatCompletion>;

  // --- Overload #2: Streaming
  public create(
    body: ChatCompletionCreateParamsStreaming & MonitoringParams,
    options?: RequestOptions
  ): APIPromise<Stream<ChatCompletionChunk>>;

  // --- Overload #3: Generic base
  public create(
    body: ChatCompletionCreateParamsBase & MonitoringParams,
    options?: RequestOptions
  ): APIPromise<ChatCompletion | Stream<ChatCompletionChunk>>;

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
    } = body;

    const traceId = posthog_trace_id ?? uuidv4();
    const startTime = Date.now();

    const parentPromise = super.create(openAIParams, options);

    if (openAIParams.stream) {
      return parentPromise.then((value) => {
        const passThroughStream = new PassThrough({ objectMode: true });
        let accumulatedContent = "";
        let usage: { input_tokens: number; output_tokens: number } = {
          input_tokens: 0,
          output_tokens: 0
        };
        if ('tee' in value) {
          const openAIStream = value;
          (async () => {
            try {
              for await (const chunk of openAIStream) {
                const delta = chunk?.choices?.[0]?.delta?.content ?? "";
                accumulatedContent += delta;
                if (chunk.usage) {
                  usage = {
                    input_tokens: chunk.usage.prompt_tokens ?? 0,
                    output_tokens: chunk.usage.completion_tokens ?? 0
                  };
                }
                passThroughStream.write(chunk);
              }
              const latency = (Date.now() - startTime) / 1000;
              sendEventToPosthog({
                client: this.phClient,
                distinctId: posthog_distinct_id ?? traceId,
                traceId,
                model: openAIParams.model,
                provider: 'openai',
                input: mergeSystemPrompt(openAIParams, 'openai'),
                output: [{ content: accumulatedContent, role: 'assistant' }],
                latency,
                baseURL: (this as any).baseURL ?? '',
                params: body,
                httpStatus: 200,
                usage
              });
              passThroughStream.end();
            } catch (error) {
              // error handling
              passThroughStream.emit('error', error);
            }
          })();
        }
        return passThroughStream as unknown as Stream<ChatCompletionChunk>;
      }) as APIPromise<Stream<ChatCompletionChunk>>;
    } else {
      const wrappedPromise = parentPromise.then(
        (result) => {
          if ('choices' in result) {
            const latency = (Date.now() - startTime) / 1000;
            sendEventToPosthog({
              client: this.phClient,
              distinctId: posthog_distinct_id ?? traceId,
              traceId,
              model: openAIParams.model,
              provider: 'openai',
              input: mergeSystemPrompt(openAIParams, 'openai'),
              output: [{ content: result.choices[0].message.content, role: 'assistant' }],
              latency,
              baseURL: (this as any).baseURL ?? '',
              params: body,
              httpStatus: 200,
              usage: {
                input_tokens: result.usage?.prompt_tokens ?? 0,
                output_tokens: result.usage?.completion_tokens ?? 0
              }
            });
          }
          return result;
        },
        (error) => {
          throw error;
        }
      ) as APIPromise<ChatCompletion>;

      return wrappedPromise;
    }
  }
}

//   export class WrappedEmbeddings {
//     private readonly baseEmbeddings: Embedding;
//     private readonly phClient: PostHog;
//     private readonly parentClient: OpenAI;

//     constructor(parentClient: OpenAI, phClient: PostHog) {
//       this.baseEmbeddings = parentClient.embeddings;
//       this.phClient = phClient;
//       this.parentClient = parentClient;
//     }

//     public create = async (
//       params: CreateEmbeddingRequest & {
//         posthog_distinct_id?: string;
//         posthog_trace_id?: string;
//         posthog_properties?: Record<string, any>;
//         posthog_privacy_mode?: boolean;
//         posthog_groups?: Record<string, any>;
//       }
//     ) => {
//       const {
//         posthog_distinct_id,
//         posthog_trace_id,
//         posthog_properties,
//         posthog_privacy_mode,
//         posthog_groups,
//         ...openAIParams
//       } = params;

//       const traceId = posthog_trace_id ?? uuidv4();
//       const startTime = Date.now();

//       let response: any;
//       let error: any;

//       try {
//         response = await this.baseEmbeddings.create(openAIParams);
//       } catch (err) {
//         error = err;
//         throw err;
//       } finally {
//         const latency = (Date.now() - startTime) / 1000.0;

//         // Example usage data from response. The openai Node library may differ slightly:
//         const usage_stats = response?.usage ?? {};
//         const { prompt_tokens } = usage_stats;

//         this.phClient.capture({
//           distinctId: posthog_distinct_id ?? traceId,
//           event: '$ai_embedding',
//           groups: posthog_groups,
//           properties: {
//             $ai_provider: 'openai',
//             $ai_model: openAIParams.model,
//             $ai_http_status: error ? 500 : 200,
//             $ai_latency: latency,
//             $ai_trace_id: traceId,
//             $ai_input_tokens: prompt_tokens ?? 0,
//             ...posthog_properties,
//           },
//         });
//       }

//       return response;

export default PostHogOpenAI;
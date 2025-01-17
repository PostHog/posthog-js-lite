import type { ChatCompletionCreateParamsBase } from 'openai/resources/chat/completions.mjs';
import type { ChatCompletionCreateParamsStreaming } from 'openai/resources/chat/completions.mjs';
import OpenAIOrignal from './node_modules/openai';
import type { PostHog } from 'posthog-node'; // or your custom client
import { v4 as uuidv4 } from 'uuid';


type Chat = OpenAIOrignal.Chat;
type ChatCompletion = OpenAIOrignal.ChatCompletion;
type ChatCompletionChunk = OpenAIOrignal.ChatCompletionChunk;
import type { ChatCompletionCreateParamsNonStreaming } from 'openai/resources/chat/completions.mjs'
import type { APIPromise, RequestOptions } from 'openai/core.mjs';
import type { Stream } from 'openai/streaming.mjs';

interface MonitoringOpenAIConfig {
    apiKey: string;
    posthog: PostHog;
    // add others
    baseURL?: string;
  }

interface MonitoringParams {
    posthog_distinct_id?: string;
    posthog_trace_id?: string;
    posthog_properties?: Record<string, any>;
    posthog_privacy_mode?: boolean;
    posthog_groups?: Record<string, any>;
}


export class PostHogOpenAI extends OpenAIOrignal {
    private readonly phClient: PostHog;
  
    // coming soon
    private readonly defaultGroups?: Record<string, any>;
  
    constructor(config: MonitoringOpenAIConfig) {
      super({
        apiKey: config.apiKey,
        baseURL: config.baseURL,
        // need to decontruct
      });
  
      this.phClient = config.posthog;
      this.chat = new WrappedChat(this, this.phClient);
    }
  
    public chat: WrappedChat;
  }
  
  export class WrappedChat extends OpenAIOrignal.Chat {
    private readonly baseChat: Chat;
    private readonly phClient: PostHog;
    private readonly parentClient: PostHogOpenAI;
  
    constructor(parentClient: PostHogOpenAI, phClient: PostHog) {
      super(parentClient);
      this.phClient = phClient;
      this.parentClient = parentClient;
      this.baseChat = parentClient.chat;
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
        posthog_privacy_mode,
        posthog_groups,
        ...openAIParams
      } = body;
  
      const traceId = posthog_trace_id ?? uuidv4();
      const startTime = Date.now();
  
      const parentPromise = super.create(openAIParams, options);
  
      const wrappedPromise = parentPromise.then(
        (result) => {
          // success
          const latency = (Date.now() - startTime) / 1000;
        //   this.phClient.capture({
        //     distinctId: posthog_distinct_id ?? traceId,
        //     event: '$ai_generation',
        //     properties: {
        //       $ai_http_status: 200,
        //       $ai_latency: latency,
        //       $ai_trace_id: traceId,
        //       $ai_model: openAIParams.model,
        //       ...posthog_properties,
        //     },
        //   });
        console.log("WRAPPED PROMISE", 
            {
                    distinctId: posthog_distinct_id ?? traceId,
                    event: '$ai_generation',
                    properties: {
                      $ai_http_status: 200,
                      $ai_latency: latency,
                      $ai_trace_id: traceId,
                      $ai_model: openAIParams.model,
                      ...posthog_properties,
                    }
        });
          return result;
        },
        (error) => {
          // fail
          const latency = (Date.now() - startTime) / 1000;
        //   this.phClient.capture({
        //     distinctId: posthog_distinct_id ?? traceId,
        //     event: '$ai_generation',
        //     properties: {
        //       $ai_http_status: 500,
        //       $ai_latency: latency,
        //       $ai_trace_id: traceId,
        //       $ai_model: openAIParams.model,
        //       error: String(error),
        //       ...posthog_properties,
        //     },
        //   });
          console.log("ERROR");
          throw error;
        }
      ) as APIPromise<ChatCompletion | Stream<ChatCompletionChunk>>;

      return wrappedPromise;
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
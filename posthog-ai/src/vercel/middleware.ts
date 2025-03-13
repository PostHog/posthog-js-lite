import { experimental_wrapLanguageModel as wrapLanguageModel } from 'ai'
import type { LanguageModelV1, LanguageModelV1Middleware, LanguageModelV1Prompt, LanguageModelV1StreamPart } from 'ai'
import { v4 as uuidv4 } from 'uuid'
import { PostHog } from 'posthog-node'
import { CostOverride, sendEventToPosthog } from '../utils'

interface ClientOptions {
  posthogDistinctId?: string
  posthogTraceId?: string
  posthogProperties?: Record<string, any>
  posthogPrivacyMode?: boolean
  posthogGroups?: Record<string, any>
  posthogModelOverride?: string
  posthogProviderOverride?: string
  posthogCostOverride?: CostOverride
}

interface CreateInstrumentationMiddlewareOptions {
  posthogDistinctId: string
  posthogTraceId: string
  posthogProperties?: Record<string, any>
  posthogPrivacyMode?: boolean
  posthogGroups?: Record<string, any>
  posthogModelOverride?: string
  posthogProviderOverride?: string
  posthogCostOverride?: CostOverride
}

interface PostHogInput {
  role: string
  type?: string
  content?:
    | string
    | {
        [key: string]: any
      }
}

const mapVercelParams = (params: any): Record<string, any> => {
  return {
    temperature: params.temperature,
    max_tokens: params.maxTokens,
    top_p: params.topP,
    frequency_penalty: params.frequencyPenalty,
    presence_penalty: params.presencePenalty,
    stop: params.stopSequences,
    stream: params.stream,
  }
}

const mapVercelPrompt = (prompt: LanguageModelV1Prompt): PostHogInput[] => {
  return prompt.map((p) => {
    let content = {}
    if (Array.isArray(p.content)) {
      content = p.content.map((c) => {
        if (c.type === 'text') {
          return {
            type: 'text',
            content: c.text,
          }
        } else if (c.type === 'image') {
          return {
            type: 'image',
            content: {
              // if image is a url use it, or use "none supported"
              image: c.image instanceof URL ? c.image.toString() : 'raw images not supported',
              mimeType: c.mimeType,
            },
          }
        } else if (c.type === 'file') {
          return {
            type: 'file',
            content: {
              file: c.data instanceof URL ? c.data.toString() : 'raw files not supported',
              mimeType: c.mimeType,
            },
          }
        } else if (c.type === 'tool-call') {
          return {
            type: 'tool-call',
            content: {
              toolCallId: c.toolCallId,
              toolName: c.toolName,
              args: c.args,
            },
          }
        } else if (c.type === 'tool-result') {
          return {
            type: 'tool-result',
            content: {
              toolCallId: c.toolCallId,
              toolName: c.toolName,
              result: c.result,
              isError: c.isError,
            },
          }
        }
        return {
          content: '',
        }
      })
    } else {
      content = {
        type: 'text',
        text: p.content,
      }
    }
    return {
      role: p.role,
      content,
    }
  })
}

const mapVercelOutput = (result: any): PostHogInput[] => {
  const output = {
    ...(result.text ? { text: result.text } : {}),
    ...(result.object ? { object: result.object } : {}),
    ...(result.reasoning ? { reasoning: result.reasoning } : {}),
    ...(result.response ? { response: result.response } : {}),
    ...(result.finishReason ? { finishReason: result.finishReason } : {}),
    ...(result.usage ? { usage: result.usage } : {}),
    ...(result.warnings ? { warnings: result.warnings } : {}),
    ...(result.providerMetadata ? { toolCalls: result.providerMetadata } : {}),
  }
  // if text and no object or reasoning, return text
  if (output.text && !output.object && !output.reasoning) {
    return [{ content: output.text, role: 'assistant' }]
  }
  return [{ content: JSON.stringify(output), role: 'assistant' }]
}

const extractProvider = (model: LanguageModelV1): string => {
  // vercel provider is in the format of provider.endpoint
  const provider = model.provider.toLowerCase()
  const providerName = provider.split('.')[0]
  return providerName
}

export const createInstrumentationMiddleware = (
  phClient: PostHog,
  model: LanguageModelV1,
  options: CreateInstrumentationMiddlewareOptions
): LanguageModelV1Middleware => {
  const middleware: LanguageModelV1Middleware = {
    wrapGenerate: async ({ doGenerate, params }) => {
      const startTime = Date.now()
      const mergedParams = {
        ...options,
        ...mapVercelParams(params),
      }
      try {
        const result = await doGenerate()
        const latency = (Date.now() - startTime) / 1000
        const modelId =
          options.posthogModelOverride ?? (result.response?.modelId ? result.response.modelId : model.modelId)
        const provider = options.posthogProviderOverride ?? extractProvider(model)
        const baseURL = '' // cannot currently get baseURL from vercel
        const content = mapVercelOutput(result)
        // let tools = result.toolCalls
        const providerMetadata = result.providerMetadata
        const additionalTokenValues = {
          ...(providerMetadata?.openai?.reasoningTokens
            ? { reasoningTokens: providerMetadata.openai.reasoningTokens }
            : {}),
          ...(providerMetadata?.openai?.cachedPromptTokens
            ? { cacheReadInputTokens: providerMetadata.openai.cachedPromptTokens }
            : {}),
          ...(providerMetadata?.anthropic
            ? {
                cacheReadInputTokens: providerMetadata.anthropic.cacheReadInputTokens,
                cacheCreationInputTokens: providerMetadata.anthropic.cacheCreationInputTokens,
              }
            : {}),
        }
        sendEventToPosthog({
          client: phClient,
          distinctId: options.posthogDistinctId,
          traceId: options.posthogTraceId,
          model: modelId,
          provider: provider,
          input: options.posthogPrivacyMode ? '' : mapVercelPrompt(params.prompt),
          output: [{ content, role: 'assistant' }],
          latency,
          baseURL,
          params: mergedParams as any,
          httpStatus: 200,
          usage: {
            inputTokens: result.usage.promptTokens,
            outputTokens: result.usage.completionTokens,
            ...additionalTokenValues,
          },
        })

        return result
      } catch (error: any) {
        const modelId = model.modelId
        sendEventToPosthog({
          client: phClient,
          distinctId: options.posthogDistinctId,
          traceId: options.posthogTraceId,
          model: modelId,
          provider: model.provider,
          input: options.posthogPrivacyMode ? '' : mapVercelPrompt(params.prompt),
          output: [],
          latency: 0,
          baseURL: '',
          params: mergedParams as any,
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
    },

    wrapStream: async ({ doStream, params }) => {
      const startTime = Date.now()
      let generatedText = ''
      let usage: {
        inputTokens?: number
        outputTokens?: number
        reasoningTokens?: any
        cacheReadInputTokens?: any
        cacheCreationInputTokens?: any
      } = {}
      const mergedParams = {
        ...options,
        ...mapVercelParams(params),
      }

      const modelId = options.posthogModelOverride ?? model.modelId
      const provider = options.posthogProviderOverride ?? extractProvider(model)
      const baseURL = '' // cannot currently get baseURL from vercel
      try {
        const { stream, ...rest } = await doStream()
        const transformStream = new TransformStream<LanguageModelV1StreamPart, LanguageModelV1StreamPart>({
          transform(chunk, controller) {
            if (chunk.type === 'text-delta') {
              generatedText += chunk.textDelta
            }
            if (chunk.type === 'finish') {
              usage = {
                inputTokens: chunk.usage?.promptTokens,
                outputTokens: chunk.usage?.completionTokens,
              }
              if (chunk.providerMetadata?.openai?.reasoningTokens) {
                usage.reasoningTokens = chunk.providerMetadata.openai.reasoningTokens
              }
              if (chunk.providerMetadata?.openai?.cachedPromptTokens) {
                usage.cacheReadInputTokens = chunk.providerMetadata.openai.cachedPromptTokens
              }
              if (chunk.providerMetadata?.anthropic?.cacheReadInputTokens) {
                usage.cacheReadInputTokens = chunk.providerMetadata.anthropic.cacheReadInputTokens
              }
              if (chunk.providerMetadata?.anthropic?.cacheCreationInputTokens) {
                usage.cacheCreationInputTokens = chunk.providerMetadata.anthropic.cacheCreationInputTokens
              }
            }
            controller.enqueue(chunk)
          },

          flush() {
            const latency = (Date.now() - startTime) / 1000
            sendEventToPosthog({
              client: phClient,
              distinctId: options.posthogDistinctId,
              traceId: options.posthogTraceId,
              model: modelId,
              provider: provider,
              input: options.posthogPrivacyMode ? '' : mapVercelPrompt(params.prompt),
              output: [{ content: generatedText, role: 'assistant' }],
              latency,
              baseURL,
              params: mergedParams as any,
              httpStatus: 200,
              usage,
            })
          },
        })

        return {
          stream: stream.pipeThrough(transformStream),
          ...rest,
        }
      } catch (error: any) {
        sendEventToPosthog({
          client: phClient,
          distinctId: options.posthogDistinctId,
          traceId: options.posthogTraceId,
          model: modelId,
          provider: provider,
          input: options.posthogPrivacyMode ? '' : mapVercelPrompt(params.prompt),
          output: [],
          latency: 0,
          baseURL: '',
          params: mergedParams as any,
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
    },
  }

  return middleware
}

export const wrapVercelLanguageModel = (
  model: LanguageModelV1,
  phClient: PostHog,
  options: ClientOptions
): LanguageModelV1 => {
  const traceId = options.posthogTraceId ?? uuidv4()
  const middleware = createInstrumentationMiddleware(phClient, model, {
    ...options,
    posthogTraceId: traceId,
    posthogDistinctId: options.posthogDistinctId ?? traceId,
  })

  const wrappedModel = wrapLanguageModel({
    model,
    middleware,
  })

  return wrappedModel
}

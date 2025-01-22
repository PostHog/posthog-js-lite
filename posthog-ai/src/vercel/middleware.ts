import { experimental_wrapLanguageModel as wrapLanguageModel } from 'ai'
import type {
  LanguageModelV1,
  Experimental_LanguageModelV1Middleware as LanguageModelV1Middleware,
  LanguageModelV1Prompt,
  LanguageModelV1StreamPart,
} from 'ai'
import { v4 as uuidv4 } from 'uuid'
import { PostHog } from 'posthog-node'
import { sendEventToPosthog } from '../utils'

interface CreateInstrumentationMiddlewareOptions {
  posthogDistinctId?: string
  posthogTraceId: string
  posthogProperties?: Record<string, any>
  posthogPrivacyMode?: boolean
  posthogGroups?: Record<string, any>
}

interface PostHogInput {
  content: string
  role: string
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
    let content = ''
    if (Array.isArray(p.content)) {
      content = p.content
        .map((c) => {
          if (c.type === 'text') {
            return c.text
          }
          return ''
        })
        .join('')
    } else {
      content = p.content
    }
    return {
      role: p.role,
      content,
    }
  })
}

export const createInstrumentationMiddleware = (
  phClient: PostHog,
  model: LanguageModelV1,
  options: CreateInstrumentationMiddlewareOptions
): LanguageModelV1Middleware => {
  const middleware: LanguageModelV1Middleware = {
    wrapGenerate: async ({ doGenerate, params }) => {
      const startTime = Date.now()
      let mergedParams = {
        ...options,
        ...mapVercelParams(params),
      }
      try {
        const result = await doGenerate()
        const latency = (Date.now() - startTime) / 1000

        sendEventToPosthog({
          client: phClient,
          distinctId: options.posthogDistinctId,
          traceId: options.posthogTraceId,
          model: model.modelId,
          provider: 'vercel',
          input: options.posthogPrivacyMode ? '' : mapVercelPrompt(params.prompt),
          output: [{ content: result.text, role: 'assistant' }],
          latency,
          baseURL: '',
          params: mergedParams as any,
          httpStatus: 200,
          usage: {
            inputTokens: result.usage.promptTokens,
            outputTokens: result.usage.completionTokens,
          },
        })

        return result
      } catch (error) {
        sendEventToPosthog({
          client: phClient,
          distinctId: options.posthogDistinctId,
          traceId: options.posthogTraceId,
          model: model.modelId,
          provider: 'vercel',
          input: options.posthogPrivacyMode ? '' : mapVercelPrompt(params.prompt),
          output: [],
          latency: 0,
          baseURL: '',
          params: mergedParams as any,
          httpStatus: 500,
          usage: {
            inputTokens: 0,
            outputTokens: 0,
          },
        })
        throw error
      }
    },

    wrapStream: async ({ doStream, params }) => {
      const startTime = Date.now()
      let generatedText = ''
      let usage: { inputTokens?: number; outputTokens?: number } = {}
      let mergedParams = {
        ...options,
        ...mapVercelParams(params),
      }
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
            }
            controller.enqueue(chunk)
          },

          flush() {
            const latency = (Date.now() - startTime) / 1000
            sendEventToPosthog({
              client: phClient,
              distinctId: options.posthogDistinctId,
              traceId: options.posthogTraceId,
              model: model.modelId,
              provider: 'vercel',
              input: options.posthogPrivacyMode ? '' : mapVercelPrompt(params.prompt),
              output: [{ content: generatedText, role: 'assistant' }],
              latency,
              baseURL: '',
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
      } catch (error) {
        sendEventToPosthog({
          client: phClient,
          distinctId: options.posthogDistinctId,
          traceId: options.posthogTraceId,
          model: model.modelId,
          provider: 'vercel',
          input: options.posthogPrivacyMode ? '' : mapVercelPrompt(params.prompt),
          output: [],
          latency: 0,
          baseURL: '',
          params: mergedParams as any,
          httpStatus: 500,
          usage: {
            inputTokens: 0,
            outputTokens: 0,
          },
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
  options: CreateInstrumentationMiddlewareOptions
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

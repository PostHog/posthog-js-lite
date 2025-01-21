import { experimental_wrapLanguageModel as wrapLanguageModel } from 'ai'
import type {
  LanguageModelV1,
  Experimental_LanguageModelV1Middleware as LanguageModelV1Middleware,
  LanguageModelV1StreamPart,
} from 'ai'
import { v4 as uuidv4 } from 'uuid'
import type { PostHog } from 'posthog-node'
import { sendEventToPosthog } from '../utils'

interface CreateInstrumentationMiddlewareOptions {
  posthogDistinctId?: string
  posthogTraceId: string
  posthogProperties?: Record<string, any>
  posthogPrivacyMode?: boolean
  posthogGroups?: string[]
}

export const createInstrumentationMiddleware = (
  phClient: PostHog,
  model: LanguageModelV1,
  options: CreateInstrumentationMiddlewareOptions
): LanguageModelV1Middleware => {
  const middleware: LanguageModelV1Middleware = {
    wrapGenerate: async ({ doGenerate, params }) => {
      const startTime = Date.now()

      try {
        const result = await doGenerate()
        const latency = (Date.now() - startTime) / 1000

        sendEventToPosthog({
          client: phClient,
          distinctId: options.posthogDistinctId,
          traceId: options.posthogTraceId,
          model: model.modelId,
          provider: 'vercel',
          input: options.posthogPrivacyMode ? '' : params.prompt,
          output: [{ content: result.text, role: 'assistant' }],
          latency,
          baseURL: '',
          params: { posthog_properties: options } as any,
          httpStatus: 200,
          usage: {
            input_tokens: result.usage.promptTokens,
            output_tokens: result.usage.completionTokens,
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
          input: options.posthogPrivacyMode ? '' : params.prompt,
          output: [],
          latency: 0,
          baseURL: '',
          params: { posthog_properties: options } as any,
          httpStatus: 500,
          usage: {
            input_tokens: 0,
            output_tokens: 0,
          },
        })
        throw error
      }
    },

    wrapStream: async ({ doStream, params }) => {
      const startTime = Date.now()
      let generatedText = ''
      let usage: { input_tokens?: number; output_tokens?: number } = {}

      try {
        const { stream, ...rest } = await doStream()

        const transformStream = new TransformStream<LanguageModelV1StreamPart, LanguageModelV1StreamPart>({
          transform(chunk, controller) {
            if (chunk.type === 'text-delta') {
              generatedText += chunk.textDelta
            }
            if (chunk.type === 'finish') {
              usage = {
                input_tokens: chunk.usage?.promptTokens,
                output_tokens: chunk.usage?.completionTokens,
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
              input: options.posthogPrivacyMode ? '' : params.prompt,
              output: [{ content: generatedText, role: 'assistant' }],
              latency,
              baseURL: '',
              params: { posthog_properties: options } as any,
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
          input: options.posthogPrivacyMode ? '' : params.prompt,
          output: [],
          latency: 0,
          baseURL: '',
          params: { posthog_properties: options } as any,
          httpStatus: 500,
          usage: {
            input_tokens: 0,
            output_tokens: 0,
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

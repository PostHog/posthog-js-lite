import { experimental_wrapLanguageModel as wrapLanguageModel } from 'ai';
import type {
    LanguageModelV1,
    Experimental_LanguageModelV1Middleware as LanguageModelV1Middleware,
    LanguageModelV1StreamPart,
} from 'ai';
import { v4 as uuidv4 } from 'uuid';
import type { PostHog } from 'posthog-node';
import { sendEventToPosthog } from '../utils';

interface CreateInstrumentationMiddlewareOptions {
    posthog_distinct_id: string;
    posthog_trace_id: string;
    posthog_properties: Record<string, any>;
    posthog_privacy_mode: boolean;
    posthog_groups: string[];
}

export const createInstrumentationMiddleware = (phClient: PostHog, model: LanguageModelV1, options: CreateInstrumentationMiddlewareOptions): LanguageModelV1Middleware => {
    const middleware: LanguageModelV1Middleware = {
        wrapGenerate: async ({ doGenerate, params }) => {
            const startTime = Date.now();

            try {
                const result = await doGenerate();
                const latency = (Date.now() - startTime) / 1000;

                sendEventToPosthog({
                    client: phClient,
                    distinctId: options.posthog_distinct_id,
                    traceId: options.posthog_trace_id,
                    model: model.modelId,
                    provider: 'vercel',
                    input: options.posthog_privacy_mode ? '' : params.prompt,
                    output: [{ content: result.text, role: 'assistant' }],
                    latency,
                    baseURL: "",
                    params: { posthog_properties: options } as any,
                    httpStatus: 200,
                    usage: {
                        input_tokens: 0,
                        output_tokens: 0,
                    },
                });

                return result;
            } catch (error) {
                sendEventToPosthog({
                    client: phClient,
                    distinctId: options.posthog_distinct_id,
                    traceId: options.posthog_trace_id,
                    model: model.modelId,
                    provider: 'vercel',
                    input: options.posthog_privacy_mode ? '' : params.prompt,
                    output: [],
                    latency: 0,
                    baseURL: "",
                    params: { posthog_properties: options } as any,
                    httpStatus: 500,
                    usage: {
                        input_tokens: 0,
                        output_tokens: 0,
                    },
                });
                throw error;
            }
        },

        wrapStream: async ({ doStream, params }) => {
            const startTime = Date.now();
            let generatedText = '';

            try {
                const { stream, ...rest } = await doStream();

                const transformStream = new TransformStream<
                    LanguageModelV1StreamPart,
                    LanguageModelV1StreamPart
                >({
                    transform(chunk, controller) {
                        if (chunk.type === 'text-delta') {
                            generatedText += chunk.textDelta;
                        }
                        controller.enqueue(chunk);
                    },

                    flush() {
                        const latency = (Date.now() - startTime) / 1000;
                        sendEventToPosthog({
                            client: phClient,
                            distinctId: options.posthog_distinct_id,
                            traceId: options.posthog_trace_id,
                            model: model.modelId,
                            provider: 'vercel',
                            input: options.posthog_privacy_mode ? '' : params.prompt,
                            output: [{ content: generatedText, role: 'assistant' }],
                            latency,
                            baseURL: "",
                            params: { posthog_properties: options } as any,
                            httpStatus: 200,
                            usage: {
                                input_tokens: 0,
                                output_tokens: 0,
                            },
                        });
                    },
                });

                return {
                    stream: stream.pipeThrough(transformStream),
                    ...rest,
                };
            } catch (error) {
                sendEventToPosthog({
                    client: phClient,
                    distinctId: options.posthog_distinct_id,
                    traceId: options.posthog_trace_id,
                    model: model.modelId,
                    provider: 'vercel',
                    input: options.posthog_privacy_mode ? '' : params.prompt,
                    output: [],
                    latency: 0,
                    baseURL: "",
                    params: { posthog_properties: options } as any,
                    httpStatus: 500,
                    usage: {
                        input_tokens: 0,
                        output_tokens: 0,
                    },
                });
                throw error;
            }
        },
    };

    return middleware;
};

export const wrapVercelLanguageModel = (
    model: LanguageModelV1,
    phClient: PostHog,
    options: CreateInstrumentationMiddlewareOptions
): LanguageModelV1 => {
    const traceId = options.posthog_trace_id ?? uuidv4();
    const middleware = createInstrumentationMiddleware(phClient, model, {
        ...options,
        posthog_trace_id: traceId,
        posthog_distinct_id: options.posthog_distinct_id ?? traceId,
    });

    const wrappedModel = wrapLanguageModel({
        model,
        middleware,
    });

    return wrappedModel;
};
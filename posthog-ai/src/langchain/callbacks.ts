import { PostHog } from 'posthog-node'
import { withPrivacyMode, getModelParams } from '../utils'
import { BaseCallbackHandler } from '@langchain/core/callbacks/base'

interface SpanMetadata {
  /** Name of the trace/span (e.g. chain name) */
  name: string
  /** Timestamp (in ms) when the run started */
  startTime: number
  /** Timestamp (in ms) when the run ended (if already finished) */
  endTime?: number
  /** The input state */
  input?: any
}

interface GenerationMetadata extends SpanMetadata {
  /** Provider used (e.g. openai, anthropic) */
  provider?: string
  /** Model name used in the generation */
  model?: string
  /** The model parameters (temperature, max_tokens, etc.) */
  modelParams?: Record<string, any>
  /** The base URL—for example, the API base used */
  baseUrl?: string
}

/** A run may either be a Span or a Generation */
type RunMetadata = SpanMetadata | GenerationMetadata

/** Storage for run metadata */
type RunMetadataStorage = { [runId: string]: RunMetadata }

interface UsageMetadata {
  input_tokens?: number
  output_tokens?: number
  prompt_token_count?: number
  candidates_token_count?: number
  inputTokenCount?: number | number[]
  outputTokenCount?: number | number[]
  input_token_count?: number
  generated_token_count?: number
  [key: string]: any
}

function parseUsageModel(usage: UsageMetadata): [number | null, number | null] {
  const conversionList: [string, 'input' | 'output'][] = [
    // langchain-anthropic (works also for Bedrock-Anthropic)
    ['input_tokens', 'input'],
    ['output_tokens', 'output'],
    // Google Vertex AI
    ['prompt_token_count', 'input'],
    ['candidates_token_count', 'output'],
    // Bedrock
    ['inputTokenCount', 'input'],
    ['outputTokenCount', 'output'],
    // langchain-ibm
    ['input_token_count', 'input'],
    ['generated_token_count', 'output'],
  ]

  const parsedUsage: { input?: number; output?: number } = {}

  for (const [modelKey, typeKey] of conversionList) {
    if (modelKey in usage) {
      const capturedCount = usage[modelKey]
      // For Bedrock, the token count is a list when streamed
      const finalCount = Array.isArray(capturedCount)
        ? capturedCount.reduce((sum, count) => sum + count, 0)
        : capturedCount

      parsedUsage[typeKey] = finalCount
    }
  }

  return [parsedUsage.input ?? null, parsedUsage.output ?? null]
}

function parseUsage(response: any): [number | null, number | null] {
  // langchain-anthropic uses the usage field
  const llmUsageKeys = ['token_usage', 'usage']
  let llmUsage: [number | null, number | null] = [null, null]

  if (response.llm_output) {
    for (const key of llmUsageKeys) {
      if (response.llm_output[key]) {
        llmUsage = parseUsageModel(response.llm_output[key])
        break
      }
    }
  }

  if (response.generations) {
    for (const generation of response.generations) {
      for (const generationChunk of generation) {
        if (generationChunk.generation_info?.usage_metadata) {
          llmUsage = parseUsageModel(generationChunk.generation_info.usage_metadata)
          break
        }

        const messageChunk = generationChunk.message || {}
        const responseMetadata = messageChunk.response_metadata || {}

        // for Bedrock-Anthropic
        const bedrockAnthropicUsage = typeof responseMetadata === 'object' ? responseMetadata.usage : null
        // for Bedrock-Titan
        const bedrockTitanUsage =
          typeof responseMetadata === 'object' ? responseMetadata['amazon-bedrock-invocationMetrics'] : null
        // for Ollama
        const ollamaUsage = messageChunk.usage_metadata

        const chunkUsage = bedrockAnthropicUsage || bedrockTitanUsage || ollamaUsage
        if (chunkUsage) {
          llmUsage = parseUsageModel(chunkUsage)
          break
        }
      }
    }
  }

  return llmUsage
}

export class LangChainCallbackHandler extends BaseCallbackHandler {
  public name = 'PosthogCallbackHandler'
  private client: PostHog
  private distinctId?: string | number
  private traceId?: string | number
  private properties: Record<string, any>
  private privacyMode: boolean
  private groups: Record<string, any>
  private debug: boolean

  private runs: RunMetadataStorage = {}
  private parentTree: { [runId: string]: string } = {}

  constructor(options: {
    client: PostHog
    distinctId?: string | number
    traceId?: string | number
    properties?: Record<string, any>
    privacyMode?: boolean
    groups?: Record<string, any>
    debug?: boolean
  }) {
    if (!options.client) {
      throw new Error('PostHog client is required')
    }
    super()
    this.client = options.client
    this.distinctId = options.distinctId
    this.traceId = options.traceId
    this.properties = options.properties || {}
    this.privacyMode = options.privacyMode || false
    this.groups = options.groups || {}
    this.debug = options.debug || false
  }

  // ===== CALLBACK METHODS =====

  public handleChainStart(
    serialized: any,
    inputs: any,
    runId: string,
    parentRunId?: string,
    metadata?: any,
    ...args: any[]
  ): void {
    this._logDebugEvent('on_chain_start', runId, parentRunId, { inputs })
    this._setParentOfRun(runId, parentRunId)
    this._setTraceOrSpanMetadata(serialized, inputs, runId, parentRunId, ...args)
  }

  public handleChainEnd(outputs: any, runId: string, parentRunId?: string, ...args: any[]): void {
    this._logDebugEvent('on_chain_end', runId, parentRunId, { outputs })
    this._popRunAndCaptureTraceOrSpan(runId, parentRunId, outputs)
  }

  public handleChainError(error: Error, runId: string, parentRunId?: string, ...args: any[]): void {
    this._logDebugEvent('on_chain_error', runId, parentRunId, { error })
    this._popRunAndCaptureTraceOrSpan(runId, parentRunId, error)
  }

  public handleChatModelStart(
    serialized: any,
    messages: any[][],
    runId: string,
    parentRunId?: string,
    ...args: any[]
  ): void {
    this._logDebugEvent('on_chat_model_start', runId, parentRunId, { messages })
    this._setParentOfRun(runId, parentRunId)
    // Flatten the two-dimensional messages and convert each message to a plain object
    const input = messages.flat().map((m) => this._convertMessageToDict(m))
    this._setLLMMetadata(serialized, runId, input, ...args)
  }

  public handleLLMStart(serialized: any, prompts: string[], runId: string, parentRunId?: string, ...args: any[]): void {
    this._logDebugEvent('on_llm_start', runId, parentRunId, { prompts })
    this._setParentOfRun(runId, parentRunId)
    this._setLLMMetadata(serialized, runId, prompts, ...args)
  }

  public handleLLMEnd(response: any, runId: string, parentRunId?: string, ...args: any[]): void {
    this._logDebugEvent('on_llm_end', runId, parentRunId, { response })
    this._popRunAndCaptureGeneration(runId, parentRunId, response)
  }

  public handleLLMError(error: Error, runId: string, parentRunId?: string, ...args: any[]): void {
    this._logDebugEvent('on_llm_error', runId, parentRunId, { error })
    this._popRunAndCaptureGeneration(runId, parentRunId, error)
  }

  public handleToolStart(
    serialized: any,
    inputStr: string,
    runId: string,
    parentRunId?: string,
    metadata?: any,
    ...args: any[]
  ): void {
    this._logDebugEvent('on_tool_start', runId, parentRunId, { inputStr })
    this._setTraceOrSpanMetadata(serialized, inputStr, runId, parentRunId, ...args)
  }

  public handleToolEnd(output: string, runId: string, parentRunId?: string, ...args: any[]): void {
    this._logDebugEvent('on_tool_end', runId, parentRunId, { output })
    this._popRunAndCaptureTraceOrSpan(runId, parentRunId, output)
  }

  public handleToolError(error: Error, runId: string, parentRunId?: string, tags?: string[], ...args: any[]): void {
    this._logDebugEvent('on_tool_error', runId, parentRunId, { error, tags })
    this._popRunAndCaptureTraceOrSpan(runId, parentRunId, error)
  }

  public handleRetrieverStart(
    serialized: any,
    query: string,
    runId: string,
    parentRunId?: string,
    metadata?: any,
    ...args: any[]
  ): void {
    this._logDebugEvent('on_retriever_start', runId, parentRunId, { query })
    this._setTraceOrSpanMetadata(serialized, query, runId, parentRunId, ...args)
  }

  public handleRetrieverEnd(documents: any[], runId: string, parentRunId?: string, ...args: any[]): void {
    this._logDebugEvent('on_retriever_end', runId, parentRunId, { documents })
    this._popRunAndCaptureTraceOrSpan(runId, parentRunId, documents)
  }

  public handleRetrieverError(
    error: Error,
    runId: string,
    parentRunId?: string,
    tags?: string[],
    ...args: any[]
  ): void {
    this._logDebugEvent('on_retriever_error', runId, parentRunId, { error, tags })
    this._popRunAndCaptureTraceOrSpan(runId, parentRunId, error)
  }

  public handleAgentAction(action: any, runId: string, parentRunId?: string, ...args: any[]): void {
    this._logDebugEvent('on_agent_action', runId, parentRunId, { action })
    this._setParentOfRun(runId, parentRunId)
    this._setTraceOrSpanMetadata(null, action, runId, parentRunId, ...args)
  }

  public handleAgentEnd(finish: any, runId: string, parentRunId?: string, ...args: any[]): void {
    this._logDebugEvent('on_agent_finish', runId, parentRunId, { finish })
    this._popRunAndCaptureTraceOrSpan(runId, parentRunId, finish)
  }

  // ===== PRIVATE HELPERS =====

  private _setParentOfRun(runId: string, parentRunId?: string): void {
    if (parentRunId) {
      this.parentTree[runId] = parentRunId
    }
  }

  private _popParentOfRun(runId: string): void {
    delete this.parentTree[runId]
  }

  private _findRootRun(runId: string): string {
    let id = runId
    while (this.parentTree[id]) {
      id = this.parentTree[id]
    }
    return id
  }

  private _setTraceOrSpanMetadata(
    serialized: any,
    input: any,
    runId: string,
    parentRunId?: string,
    ...args: any[]
  ): void {
    const defaultName = parentRunId ? 'span' : 'trace'
    const runName = this._getLangchainRunName(serialized, ...args) || defaultName
    this.runs[runId] = {
      name: runName,
      input,
      startTime: Date.now(),
    } as SpanMetadata
  }

  private _setLLMMetadata(
    serialized: any,
    runId: string,
    messages: any,
    metadata?: any,
    invocationParams?: any,
    ...args: any[]
  ): void {
    const runName = this._getLangchainRunName(serialized, ...args) || 'generation'
    const generation: GenerationMetadata = {
      name: runName,
      input: messages,
      startTime: Date.now(),
    }
    if (metadata) {
      generation.modelParams = getModelParams(metadata.invocation_params)
    }
    let modelData = args[0]
    if (modelData.ls_model_name) {
      generation.model = modelData.ls_model_name
    }
    if (modelData.ls_provider) {
      generation.provider = modelData.ls_provider
    }
    if (serialized && serialized.kwargs && serialized.kwargs.openai_api_base) {
      generation.baseUrl = serialized.kwargs.openai_api_base
    }
    this.runs[runId] = generation
  }

  private _popRunMetadata(runId: string): RunMetadata | undefined {
    const endTime = Date.now()
    const run = this.runs[runId]
    if (!run) {
      console.warn(`No run metadata found for run ${runId}`)
      return undefined
    }
    run.endTime = endTime
    delete this.runs[runId]
    return run
  }

  private _getTraceId(runId: string): string {
    return this.traceId ? String(this.traceId) : this._findRootRun(runId)
  }

  private _getParentRunId(traceId: string, runId: string, parentRunId?: string): string | undefined {
    // Replace the parent-run if not found in our stored parent tree.
    if (parentRunId && !this.parentTree[parentRunId]) {
      return traceId
    }
    return parentRunId
  }

  private _popRunAndCaptureTraceOrSpan(runId: string, parentRunId: string | undefined, outputs: any): void {
    const traceId = this._getTraceId(runId)
    this._popParentOfRun(runId)
    const run = this._popRunMetadata(runId)
    if (!run) return
    if ('modelParams' in run) {
      console.warn(`Run ${runId} is a generation, but attempted to be captured as a trace/span.`)
      return
    }
    const actualParentRunId = this._getParentRunId(traceId, runId, parentRunId)
    this._captureTraceOrSpan(traceId, runId, run as SpanMetadata, outputs, actualParentRunId)
  }

  private _captureTraceOrSpan(
    traceId: string,
    runId: string,
    run: SpanMetadata,
    outputs: any,
    parentRunId?: string
  ): void {
    const eventName = parentRunId ? '$ai_span' : '$ai_trace'
    const latency = run.endTime ? (run.endTime - run.startTime) / 1000 : 0
    const eventProperties: Record<string, any> = {
      $ai_trace_id: traceId,
      $ai_input_state: withPrivacyMode(this.client, this.privacyMode, run.input),
      $ai_latency: latency,
      $ai_span_name: run.name,
      $ai_span_id: runId,
    }
    if (parentRunId) {
      eventProperties['$ai_parent_id'] = parentRunId
    }
    Object.assign(eventProperties, this.properties)
    if (!this.distinctId) {
      eventProperties['$process_person_profile'] = false
    }
    if (outputs instanceof Error) {
      eventProperties['$ai_error'] = outputs.toString()
      eventProperties['$ai_is_error'] = true
    } else if (outputs !== undefined) {
      eventProperties['$ai_output_state'] = withPrivacyMode(this.client, this.privacyMode, outputs)
    }
    this.client.capture({
      distinctId: (this.distinctId as string) || runId,
      event: eventName,
      properties: eventProperties,
      groups: this.groups,
    })
  }

  private _popRunAndCaptureGeneration(runId: string, parentRunId: string | undefined, response: any): void {
    const traceId = this._getTraceId(runId)
    this._popParentOfRun(runId)
    const run = this._popRunMetadata(runId)
    if (!run || !('modelParams' in run)) {
      console.warn(`Run ${runId} is not a generation, but attempted to be captured as such.`)
      return
    }
    const actualParentRunId = this._getParentRunId(traceId, runId, parentRunId)
    this._captureGeneration(traceId, runId, run as GenerationMetadata, response, actualParentRunId)
  }

  private _captureGeneration(
    traceId: string,
    runId: string,
    run: GenerationMetadata,
    output: any,
    parentRunId?: string
  ): void {
    const latency = run.endTime ? (run.endTime - run.startTime) / 1000 : 0
    const eventProperties: Record<string, any> = {
      $ai_trace_id: traceId,
      $ai_span_id: runId,
      $ai_span_name: run.name,
      $ai_parent_id: parentRunId,
      $ai_provider: run.provider,
      $ai_model: run.model,
      $ai_model_parameters: run.modelParams,
      $ai_input: withPrivacyMode(this.client, this.privacyMode, run.input),
      $ai_http_status: 200,
      $ai_latency: latency,
      $ai_base_url: run.baseUrl,
    }

    if (output instanceof Error) {
      eventProperties['$ai_http_status'] = (output as any).status || 500
      eventProperties['$ai_error'] = output.toString()
      eventProperties['$ai_is_error'] = true
    } else {
      // Handle token usage
      const [inputTokens, outputTokens] = parseUsage(output)
      eventProperties['$ai_input_tokens'] = inputTokens
      eventProperties['$ai_output_tokens'] = outputTokens

      // Handle generations/completions
      let completions
      if (output.generations && Array.isArray(output.generations)) {
        const lastGeneration = output.generations[output.generations.length - 1]
        if (Array.isArray(lastGeneration)) {
          completions = lastGeneration.map((gen) => {
            if (gen.message) {
              // Handle ChatGeneration
              return this._convertMessageToDict(gen.message)
            } else {
              // Handle regular Generation
              return { role: 'assistant', content: gen.text || gen.content }
            }
          })
        }
      } else if (output.content) {
        // Simple content response
        completions = [{ role: 'assistant', content: output.content }]
      }

      if (completions) {
        eventProperties['$ai_output_choices'] = withPrivacyMode(this.client, this.privacyMode, completions)
      }
    }

    Object.assign(eventProperties, this.properties)
    if (!this.distinctId) {
      eventProperties['$process_person_profile'] = false
    }

    this.client.capture({
      distinctId: (this.distinctId as string) || traceId,
      event: '$ai_generation',
      properties: eventProperties,
      groups: this.groups,
    })
  }

  private _logDebugEvent(eventName: string, runId: string, parentRunId: string | undefined, extra: any): void {
    if (this.debug) {
      console.log(`Event: ${eventName}, runId: ${runId}, parentRunId: ${parentRunId}, extra:`, extra)
    }
  }

  private _getLangchainRunName(serialized: any, ...args: any[]): string | undefined {
    if (args && args.length > 0) {
      for (const arg of args) {
        if (arg && arg.name) return arg.name
      }
    }
    if (serialized && serialized.name) return serialized.name
    if (serialized && serialized.id) {
      return Array.isArray(serialized.id) ? serialized.id[serialized.id.length - 1] : serialized.id
    }
    return undefined
  }

  private _convertMessageToDict(message: any): Record<string, any> {
    let messageDict: Record<string, any> = {}

    // Check the _getType() method or type property instead of instanceof
    const messageType = message._getType?.() || message.type

    switch (messageType) {
      case 'human':
        messageDict = { role: 'user', content: message.content }
        break
      case 'ai':
        messageDict = { role: 'assistant', content: message.content }
        break
      case 'system':
        messageDict = { role: 'system', content: message.content }
        break
      case 'tool':
        messageDict = { role: 'tool', content: message.content }
        break
      case 'function':
        messageDict = { role: 'function', content: message.content }
        break
      default:
        messageDict = { role: messageType || 'unknown', content: String(message.content) }
    }

    if (message.additional_kwargs) {
      messageDict = { ...messageDict, ...message.additional_kwargs }
    }
    return messageDict
  }
}

import type { LlmAdapter } from "./adapter.js"
import type { LlmInputItem, LlmRequest, LlmResponse, LlmToolCall } from "./types.js"

type OpenAIConfig = {
  apiKey: string
  model: string
  baseUrl?: string
  timeoutMs?: number
  maxOutputTokens?: number
}

type OpenAIOutputItem = Record<string, unknown> & {
  type?: string
  call_id?: string
  name?: string
  arguments?: string
  content?: unknown
}

type OpenAIResponse = {
  id?: string
  output?: OpenAIOutputItem[]
  output_text?: string
  usage?: {
    input_tokens?: number
    output_tokens?: number
    total_tokens?: number
  }
  error?: { message?: string }
}

function textFromOutput(output: OpenAIOutputItem[]): string {
  const chunks: string[] = []
  for (const item of output) {
    if (item.type !== "message" || !Array.isArray(item.content)) continue
    for (const part of item.content) {
      if (!part || typeof part !== "object") continue
      const value = part as { type?: string; text?: string }
      if ((value.type === "output_text" || value.type === "text") && typeof value.text === "string") {
        chunks.push(value.text)
      }
    }
  }
  return chunks.join("\n").trim()
}

function toolCallsFromOutput(output: OpenAIOutputItem[]): LlmToolCall[] {
  return output.flatMap((item) => {
    if (item.type !== "function_call" || typeof item.name !== "string" || typeof item.call_id !== "string") return []
    let parsed: unknown = {}
    try { parsed = JSON.parse(typeof item.arguments === "string" ? item.arguments : "{}") }
    catch { parsed = { __invalid_json: item.arguments ?? "" } }
    return [{ callId: item.call_id, name: item.name, arguments: parsed }]
  })
}

export class OpenAIResponsesAdapter implements LlmAdapter {
  readonly provider = "openai"
  readonly model: string
  private readonly apiKey: string
  private readonly baseUrl: string
  private readonly timeoutMs: number
  private readonly maxOutputTokens: number

  constructor(config: OpenAIConfig) {
    if (!config.apiKey.trim()) throw new Error("OPENAI_API_KEY no está configurada")
    this.apiKey = config.apiKey
    this.model = config.model
    this.baseUrl = (config.baseUrl ?? "https://api.openai.com/v1").replace(/\/$/, "")
    this.timeoutMs = config.timeoutMs ?? 30_000
    this.maxOutputTokens = config.maxOutputTokens ?? 3_000
  }

  async send(request: LlmRequest): Promise<LlmResponse> {
    const controller = new AbortController()
    const timer = setTimeout(() => controller.abort(), this.timeoutMs)
    try {
      const response = await fetch(`${this.baseUrl}/responses`, {
        method: "POST",
        headers: {
          Authorization: `Bearer ${this.apiKey}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          model: this.model,
          instructions: request.instructions,
          input: request.input,
          tools: request.tools,
          tool_choice: "auto",
          parallel_tool_calls: false,
          max_output_tokens: this.maxOutputTokens,
          store: false,
        }),
        signal: controller.signal,
      })

      const body = await response.json().catch(() => ({})) as OpenAIResponse
      if (!response.ok) {
        const message = body.error?.message ?? `HTTP ${response.status}`
        throw new Error(`OpenAI Responses API: ${message}`)
      }

      const output = Array.isArray(body.output) ? body.output : []
      const inputTokens = body.usage?.input_tokens ?? 0
      const outputTokens = body.usage?.output_tokens ?? 0
      return {
        id: body.id ?? "response-unknown",
        text: typeof body.output_text === "string" && body.output_text.trim() ? body.output_text.trim() : textFromOutput(output),
        output: output as LlmInputItem[],
        toolCalls: toolCallsFromOutput(output),
        usage: {
          inputTokens,
          outputTokens,
          totalTokens: body.usage?.total_tokens ?? inputTokens + outputTokens,
        },
      }
    } catch (error) {
      if (error instanceof Error && error.name === "AbortError") {
        throw new Error(`OpenAI Responses API excedió el timeout de ${this.timeoutMs} ms`)
      }
      throw error
    } finally {
      clearTimeout(timer)
    }
  }
}

export function openAIFromEnv(env: NodeJS.ProcessEnv = process.env): OpenAIResponsesAdapter {
  const config: OpenAIConfig = {
    apiKey: env.OPENAI_API_KEY ?? "",
    model: env.OPENAI_MODEL ?? "gpt-6-astra",
    timeoutMs: Number(env.LLM_TIMEOUT_MS ?? "30000"),
    maxOutputTokens: Number(env.MAX_OUTPUT_TOKENS ?? "3000"),
  }
  if (env.OPENAI_BASE_URL) config.baseUrl = env.OPENAI_BASE_URL
  return new OpenAIResponsesAdapter(config)
}

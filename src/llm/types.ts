export type JsonObject = Record<string, unknown>

export type LlmFunctionTool = {
  type: "function"
  name: string
  description: string
  parameters: JsonObject
  strict: boolean
}

export type LlmInputItem = Record<string, unknown>

export type LlmToolCall = {
  callId: string
  name: string
  arguments: unknown
}

export type LlmUsage = {
  inputTokens: number
  outputTokens: number
  totalTokens: number
}

export type LlmResponse = {
  id: string
  text: string
  output: LlmInputItem[]
  toolCalls: LlmToolCall[]
  usage: LlmUsage
}

export type LlmRequest = {
  instructions: string
  input: LlmInputItem[]
  tools: LlmFunctionTool[]
}

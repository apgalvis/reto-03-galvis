import type { LlmRequest, LlmResponse } from "./types.js"

export interface LlmAdapter {
  readonly provider: string
  readonly model: string
  send(request: LlmRequest): Promise<LlmResponse>
}

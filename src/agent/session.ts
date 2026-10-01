export type ChatMessage = {
  role: "user" | "assistant"
  content: string
  ts: string
}

export type VisibleToolCall = {
  name: string
  arguments: unknown
  result: unknown
}

export type PendingConfirmation = {
  actionId: string
  caso: string
  reasons: string[]
  createdAt: string
}

export type AgentSession = {
  id: string
  messages: ChatMessage[]
  toolCalls: VisibleToolCall[]
  pendingConfirmation: PendingConfirmation | null
  tokenUsage: number
}

export class MemorySessionStore {
  private readonly sessions = new Map<string, AgentSession>()

  getOrCreate(id: string): AgentSession {
    const current = this.sessions.get(id)
    if (current) return current
    const created: AgentSession = { id, messages: [], toolCalls: [], pendingConfirmation: null, tokenUsage: 0 }
    this.sessions.set(id, created)
    return created
  }

  get(id: string): AgentSession | null {
    return this.sessions.get(id) ?? null
  }
}

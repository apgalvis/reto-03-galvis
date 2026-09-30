import type { Clock } from "./clock.js"

export type ToolContext = {
  directory: string
  sessionId: string
  actor?: string
  clock: Clock
}

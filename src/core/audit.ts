import fs from "node:fs/promises"
import path from "node:path"
import { resolveOutPath } from "./fileGuard.js"
import type { ToolContext } from "./types.js"

export async function appendToolLog(
  ctx: ToolContext,
  event: { tool: string; args: unknown; result: unknown },
): Promise<void> {
  const target = resolveOutPath(ctx.directory, "log.jsonl")
  await fs.mkdir(path.dirname(target), { recursive: true })
  const line = JSON.stringify({
    ts: ctx.clock.now().toISOString(),
    sessionId: ctx.sessionId,
    ...event,
  })
  await fs.appendFile(target, `${line}\n`, "utf8")
}

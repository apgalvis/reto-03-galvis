import fs from "node:fs/promises"
import path from "node:path"
import { resolveOutPath } from "./fileGuard.js"
import type { ToolContext } from "./types.js"

type ConfirmationRecord = { caso: string; actor: string; grantedAt: string }

function safeSessionId(value: string): string {
  return value.replace(/[^a-zA-Z0-9_-]/g, "_")
}

function target(ctx: ToolContext): string {
  return resolveOutPath(ctx.directory, "confirmations", `${safeSessionId(ctx.sessionId)}.json`)
}

async function read(ctx: ToolContext): Promise<ConfirmationRecord[]> {
  const content = await fs.readFile(target(ctx), "utf8").catch(() => "[]")
  return JSON.parse(content) as ConfirmationRecord[]
}

export async function grantConfirmation(ctx: ToolContext, caso: string): Promise<void> {
  const records = await read(ctx)
  if (!records.some((r) => r.caso === caso)) {
    records.push({ caso, actor: ctx.actor ?? ctx.sessionId, grantedAt: ctx.clock.now().toISOString() })
  }
  const file = target(ctx)
  await fs.mkdir(path.dirname(file), { recursive: true })
  await fs.writeFile(file, `${JSON.stringify(records, null, 2)}\n`, "utf8")
}

export async function hasConfirmation(ctx: ToolContext, caso: string): Promise<boolean> {
  return (await read(ctx)).some((r) => r.caso === caso)
}

import { z, type ZodTypeAny } from "zod"
import { appendToolLog } from "./audit.js"
import type { ToolContext } from "./types.js"

export type ToolDefinition<TArgs extends Record<string, unknown>> = {
  description: string
  args: { [K in keyof TArgs]: ZodTypeAny }
  parameters: Record<string, unknown>
  strict?: boolean
  execute(args: TArgs, ctx: ToolContext): Promise<string>
}

function argsSchema<TArgs extends Record<string, unknown>>(tool: ToolDefinition<TArgs>) {
  return z.object(tool.args as z.ZodRawShape)
}

export async function executeTool<TArgs extends Record<string, unknown>>(
  name: string,
  tool: ToolDefinition<TArgs>,
  rawArgs: unknown,
  ctx: ToolContext,
): Promise<string> {
  const parsed = argsSchema(tool).safeParse(rawArgs)
  if (!parsed.success) {
    const result = JSON.stringify({ ok: false, error: parsed.error.issues.map((i: { message: string }) => i.message).join("; ") })
    await appendToolLog(ctx, { tool: name, args: rawArgs, result: JSON.parse(result) })
    return result
  }

  let result: string
  try {
    result = await tool.execute(parsed.data as TArgs, ctx)
  } catch (error) {
    result = JSON.stringify({ ok: false, error: error instanceof Error ? error.message : "Error inesperado" })
  }

  let normalized: unknown = result
  try { normalized = JSON.parse(result) } catch { /* keep raw string */ }
  await appendToolLog(ctx, { tool: name, args: parsed.data, result: normalized })
  return result
}

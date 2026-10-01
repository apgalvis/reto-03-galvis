import crypto from "node:crypto"
import type { LlmAdapter } from "../llm/adapter.js"
import type { LlmFunctionTool, LlmInputItem } from "../llm/types.js"
import { executeTool } from "../core/tool.js"
import type { ToolContext } from "../core/types.js"
import { grantConfirmation } from "../core/confirmation.js"
import { tools } from "../tools/index.js"
import { isExplicitConfirmation, isExplicitRejection } from "./confirmationIntent.js"
import type { AgentSession, VisibleToolCall } from "./session.js"

export type AgentTurnResult = {
  reply: string
  toolCalls: VisibleToolCall[]
  needsConfirmation: boolean
  pendingConfirmation: AgentSession["pendingConfirmation"]
  usage: { totalTokens: number }
}

type RunOptions = {
  instructions: string
  maxIterations: number
  maxSessionTokens: number
}

function toolSpecs(): LlmFunctionTool[] {
  return Object.entries(tools).map(([name, tool]) => ({
    type: "function" as const,
    name,
    description: tool.description,
    parameters: tool.parameters,
    strict: tool.strict ?? false,
  }))
}

function parseToolResult(value: string): unknown {
  try { return JSON.parse(value) }
  catch { return value }
}

function confirmationFromValidation(name: string, args: unknown, result: unknown, ctx: ToolContext): AgentSession["pendingConfirmation"] {
  if (name !== "oc_validar" || !args || typeof args !== "object" || !result || typeof result !== "object") return null
  const caso = (args as { caso?: unknown }).caso
  const wrapper = result as { ok?: unknown; data?: unknown }
  if (typeof caso !== "string" || wrapper.ok !== true || !wrapper.data || typeof wrapper.data !== "object") return null
  const confirmations = (wrapper.data as { confirmaciones?: unknown }).confirmaciones
  if (!Array.isArray(confirmations) || confirmations.length === 0) return null
  const reasons = confirmations.flatMap((item) => {
    if (!item || typeof item !== "object") return []
    const issue = item as { codigo?: unknown; detalle?: unknown }
    return [typeof issue.codigo === "string" && typeof issue.detalle === "string" ? `${issue.codigo}: ${issue.detalle}` : JSON.stringify(item)]
  })
  return {
    actionId: crypto.randomUUID(),
    caso,
    reasons,
    createdAt: ctx.clock.now().toISOString(),
  }
}

function historyInput(session: AgentSession, message: string): LlmInputItem[] {
  const history = session.messages.slice(-12).map((item) => ({ role: item.role, content: item.content }))
  return [...history, { role: "user", content: message }]
}

export async function runAgentTurn(
  adapter: LlmAdapter,
  session: AgentSession,
  ctx: ToolContext,
  message: string,
  options: RunOptions,
): Promise<AgentTurnResult> {
  const turnCalls: VisibleToolCall[] = []

  if (session.pendingConfirmation && isExplicitRejection(message)) {
    const cancelled = session.pendingConfirmation
    session.pendingConfirmation = null
    session.messages.push({ role: "user", content: message, ts: ctx.clock.now().toISOString() })
    const reply = `Entendido. No crearé la OC de ${cancelled.caso}. La confirmación pendiente fue cancelada.`
    session.messages.push({ role: "assistant", content: reply, ts: ctx.clock.now().toISOString() })
    return { reply, toolCalls: [], needsConfirmation: false, pendingConfirmation: null, usage: { totalTokens: session.tokenUsage } }
  }

  if (session.pendingConfirmation && isExplicitConfirmation(message)) {
    await grantConfirmation(ctx, session.pendingConfirmation.caso)
  }

  if (session.tokenUsage >= options.maxSessionTokens) {
    const reply = "La sesión alcanzó el límite de tokens configurado. Inicia una nueva sesión para continuar."
    return { reply, toolCalls: [], needsConfirmation: Boolean(session.pendingConfirmation), pendingConfirmation: session.pendingConfirmation, usage: { totalTokens: session.tokenUsage } }
  }

  let input = historyInput(session, message)
  let finalText = ""

  for (let iteration = 0; iteration < options.maxIterations; iteration += 1) {
    const response = await adapter.send({ instructions: options.instructions, input, tools: toolSpecs() })
    session.tokenUsage += response.usage.totalTokens
    if (session.tokenUsage > options.maxSessionTokens) {
      finalText = "La sesión alcanzó el límite de tokens configurado. Inicia una nueva sesión para continuar."
      break
    }

    if (response.toolCalls.length === 0) {
      finalText = response.text || "No recibí una respuesta textual del modelo."
      break
    }

    input = [...input, ...response.output]
    for (const call of response.toolCalls) {
      const tool = tools[call.name as keyof typeof tools]
      let rawResult: string
      if (!tool) {
        rawResult = JSON.stringify({ ok: false, error: `Herramienta desconocida: ${call.name}` })
      } else {
        rawResult = await executeTool(call.name, tool, call.arguments as never, ctx)
      }
      const parsed = parseToolResult(rawResult)
      const visible = { name: call.name, arguments: call.arguments, result: parsed }
      turnCalls.push(visible)
      session.toolCalls.push(visible)

      const pending = confirmationFromValidation(call.name, call.arguments, parsed, ctx)
      if (pending) session.pendingConfirmation = pending

      if (call.name === "oc_crear" && parsed && typeof parsed === "object" && (parsed as { ok?: unknown }).ok === true) {
        session.pendingConfirmation = null
      }

      input.push({ type: "function_call_output", call_id: call.callId, output: rawResult })
    }
  }

  if (!finalText) {
    finalText = `Alcancé el máximo de ${options.maxIterations} iteraciones de herramientas. Revisa las llamadas ejecutadas y vuelve a intentar si hace falta.`
  }

  session.messages.push({ role: "user", content: message, ts: ctx.clock.now().toISOString() })
  session.messages.push({ role: "assistant", content: finalText, ts: ctx.clock.now().toISOString() })

  return {
    reply: finalText,
    toolCalls: turnCalls,
    needsConfirmation: Boolean(session.pendingConfirmation),
    pendingConfirmation: session.pendingConfirmation,
    usage: { totalTokens: session.tokenUsage },
  }
}

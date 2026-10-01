import test from "node:test"
import assert from "node:assert/strict"
import path from "node:path"
import fs from "node:fs/promises"
import type { LlmAdapter } from "../src/llm/adapter.js"
import type { LlmRequest, LlmResponse } from "../src/llm/types.js"
import { runAgentTurn } from "../src/agent/loop.js"
import { MemorySessionStore } from "../src/agent/session.js"
import { FixedClock } from "../src/core/clock.js"
import { hasConfirmation } from "../src/core/confirmation.js"
import { isExplicitConfirmation, isExplicitRejection } from "../src/agent/confirmationIntent.js"

const root = path.resolve(process.cwd())
const clock = new FixedClock(new Date("2026-09-30T12:00:00-05:00"))

class QueueAdapter implements LlmAdapter {
  readonly provider = "fake"
  readonly model = "fake-model"
  constructor(private readonly replies: LlmResponse[]) {}
  async send(_request: LlmRequest): Promise<LlmResponse> {
    const next = this.replies.shift()
    if (!next) throw new Error("No fake response configured")
    return next
  }
}

function toolResponse(name: string, callId: string, args: unknown): LlmResponse {
  return {
    id: `resp-${callId}`,
    text: "",
    output: [{ type: "function_call", call_id: callId, name, arguments: JSON.stringify(args) }],
    toolCalls: [{ callId, name, arguments: args }],
    usage: { inputTokens: 10, outputTokens: 5, totalTokens: 15 },
  }
}

function textResponse(text: string): LlmResponse {
  return {
    id: "resp-text",
    text,
    output: [{ type: "message", role: "assistant", content: [{ type: "output_text", text }] }],
    toolCalls: [],
    usage: { inputTokens: 10, outputTokens: 5, totalTokens: 15 },
  }
}

test("intención de confirmación exige lenguaje explícito", () => {
  assert.equal(isExplicitConfirmation("confirmo"), true)
  assert.equal(isExplicitConfirmation("sí, confirmo"), true)
  assert.equal(isExplicitConfirmation("tal vez"), false)
  assert.equal(isExplicitConfirmation("no confirmo"), false)
  assert.equal(isExplicitRejection("no confirmo"), true)
})

test("agent loop detecta confirmación pendiente desde oc_validar", async () => {
  await fs.rm(path.join(root, "out"), { recursive: true, force: true })
  const paquete = JSON.parse(await (await import("../src/tools/oc.js")).leer_paquete.execute({ caso: "sol-004" }, { directory: root, sessionId: "prep", actor: "tester", clock })) as { data: unknown }
  const adapter = new QueueAdapter([
    toolResponse("oc_validar", "call-1", { caso: "sol-004", paquete: paquete.data }),
    textResponse("La diferencia es 6.00%. ¿Confirmas que continúe con la creación de la OC?"),
  ])
  const store = new MemorySessionStore()
  const session = store.getOrCreate("agent-pending")
  const ctx = { directory: root, sessionId: session.id, actor: "tester", clock }
  const result = await runAgentTurn(adapter, session, ctx, "Procesa sol-004", {
    instructions: "test",
    maxIterations: 5,
    maxSessionTokens: 1000,
  })
  assert.equal(result.needsConfirmation, true)
  assert.equal(result.pendingConfirmation?.caso, "sol-004")
  assert.match(result.reply, /Confirmas/)
  assert.equal(await hasConfirmation(ctx, "sol-004"), false)
})

test("confirmación del siguiente mensaje se registra en backend", async () => {
  await fs.rm(path.join(root, "out"), { recursive: true, force: true })
  const store = new MemorySessionStore()
  const session = store.getOrCreate("agent-confirm")
  session.pendingConfirmation = { actionId: "action-1", caso: "sol-004", reasons: ["RC5"], createdAt: clock.now().toISOString() }
  const ctx = { directory: root, sessionId: session.id, actor: "tester", clock }
  const adapter = new QueueAdapter([textResponse("Confirmación registrada; continuaré con las herramientas antes de crear.")])
  await runAgentTurn(adapter, session, ctx, "confirmo", {
    instructions: "test",
    maxIterations: 3,
    maxSessionTokens: 1000,
  })
  assert.equal(await hasConfirmation(ctx, "sol-004"), true)
})

test("rechazo cancela pending sin llamar al modelo", async () => {
  const store = new MemorySessionStore()
  const session = store.getOrCreate("agent-reject")
  session.pendingConfirmation = { actionId: "action-2", caso: "sol-005", reasons: ["RC8"], createdAt: clock.now().toISOString() }
  const adapter = new QueueAdapter([])
  const result = await runAgentTurn(adapter, session, { directory: root, sessionId: session.id, actor: "tester", clock }, "no confirmo", {
    instructions: "test",
    maxIterations: 3,
    maxSessionTokens: 1000,
  })
  assert.equal(result.needsConfirmation, false)
  assert.match(result.reply, /No crearé/)
})

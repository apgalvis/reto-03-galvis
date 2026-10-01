import http, { type IncomingMessage, type ServerResponse } from "node:http"
import path from "node:path"
import { fileURLToPath } from "node:url"
import { SystemClock } from "./core/clock.js"
import { openAIFromEnv } from "./llm/openai.js"
import { loadAgentInstructions } from "./agent/prompt.js"
import { MemorySessionStore } from "./agent/session.js"
import { runAgentTurn } from "./agent/loop.js"

const here = path.dirname(fileURLToPath(import.meta.url))
const directory = path.resolve(here, "..", "..")
const clock = new SystemClock()
const sessions = new MemorySessionStore()
const adapter = openAIFromEnv()
const instructions = await loadAgentInstructions(directory)
const port = parseInteger(process.env.PORT, 3000, 1, 65_535)
const maxIterations = parseInteger(process.env.MAX_AGENT_ITERATIONS, 25, 1, 50)
const maxSessionTokens = parseInteger(process.env.MAX_SESSION_TOKENS, 12_000, 1_000, 200_000)

function parseInteger(value: string | undefined, fallback: number, min: number, max: number): number {
  const parsed = Number(value ?? fallback)
  if (!Number.isInteger(parsed) || parsed < min || parsed > max) return fallback
  return parsed
}

function sendJson(res: ServerResponse, status: number, data: unknown): void {
  const body = JSON.stringify(data)
  res.writeHead(status, {
    "Content-Type": "application/json; charset=utf-8",
    "Content-Length": Buffer.byteLength(body),
    "Cache-Control": "no-store",
    "X-Content-Type-Options": "nosniff",
  })
  res.end(body)
}

async function readJsonBody(req: IncomingMessage): Promise<unknown> {
  const chunks: Buffer[] = []
  let size = 0
  for await (const chunk of req) {
    const buffer = Buffer.isBuffer(chunk) ? chunk : Buffer.from(chunk)
    size += buffer.length
    if (size > 16 * 1024) throw new Error("El cuerpo de la solicitud supera 16 KB")
    chunks.push(buffer)
  }
  if (chunks.length === 0) return {}
  try { return JSON.parse(Buffer.concat(chunks).toString("utf8")) }
  catch { throw new Error("JSON inválido") }
}

function validSessionId(value: unknown): value is string {
  return typeof value === "string" && /^[a-zA-Z0-9_-]{1,80}$/.test(value)
}

async function handleChat(req: IncomingMessage, res: ServerResponse): Promise<void> {
  const body = await readJsonBody(req) as { sessionId?: unknown; message?: unknown }
  if (!validSessionId(body.sessionId)) {
    sendJson(res, 400, { error: "sessionId inválido; usa 1-80 caracteres alfanuméricos, _ o -" })
    return
  }
  if (typeof body.message !== "string" || body.message.trim().length === 0 || body.message.length > 4_000) {
    sendJson(res, 400, { error: "message debe tener entre 1 y 4000 caracteres" })
    return
  }

  const session = sessions.getOrCreate(body.sessionId)
  const result = await runAgentTurn(
    adapter,
    session,
    { directory, sessionId: session.id, actor: "web-user", clock },
    body.message.trim(),
    { instructions, maxIterations, maxSessionTokens },
  )
  sendJson(res, 200, result)
}

const server = http.createServer(async (req, res) => {
  try {
    const url = new URL(req.url ?? "/", `http://${req.headers.host ?? "localhost"}`)
    if (req.method === "GET" && url.pathname === "/api/health") {
      sendJson(res, 200, { ok: true, provider: adapter.provider, model: adapter.model })
      return
    }

    if (req.method === "POST" && url.pathname === "/api/chat") {
      await handleChat(req, res)
      return
    }

    if (req.method === "GET" && url.pathname.startsWith("/api/sessions/")) {
      const id = decodeURIComponent(url.pathname.slice("/api/sessions/".length))
      if (!validSessionId(id)) {
        sendJson(res, 400, { error: "sessionId inválido" })
        return
      }
      const session = sessions.get(id)
      if (!session) {
        sendJson(res, 404, { error: "Sesión no encontrada" })
        return
      }
      sendJson(res, 200, session)
      return
    }

    if (req.method === "OPTIONS") {
      res.writeHead(204, { Allow: "GET,POST,OPTIONS" })
      res.end()
      return
    }

    sendJson(res, 404, { error: "Ruta no encontrada" })
  } catch (error) {
    const message = error instanceof Error ? error.message : "Error inesperado"
    sendJson(res, 500, { error: message })
  }
})

server.requestTimeout = 40_000
server.headersTimeout = 45_000
server.listen(port, () => {
  console.log(`Reto 03 API escuchando en http://localhost:${port}`)
  console.log(`Proveedor LLM: ${adapter.provider} / ${adapter.model}`)
})

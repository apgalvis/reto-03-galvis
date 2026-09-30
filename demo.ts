import fs from "node:fs/promises"
import path from "node:path"
import { FixedClock } from "./src/core/clock.js"
import { executeTool } from "./src/core/tool.js"
import type { ToolContext } from "./src/core/types.js"
import { tools } from "./src/tools/index.js"

type Envelope<T> = { ok: true; data: T } | { ok: false; error: string }
function unwrap<T>(raw: string): T {
  const envelope = JSON.parse(raw) as Envelope<T>
  if (!envelope.ok) throw new Error(envelope.error)
  return envelope.data
}

const directory = process.cwd()
await fs.rm(path.join(directory, "out"), { recursive: true, force: true })
const ctx: ToolContext = {
  directory,
  sessionId: "demo-session",
  actor: "demo-human",
  clock: new FixedClock(new Date("2026-09-30T12:00:00-05:00")),
}

async function call<T>(name: keyof typeof tools, args: unknown): Promise<T> {
  return unwrap<T>(await executeTool(name, tools[name] as never, args, ctx))
}

async function processCase(caseName: string, confirm = false) {
  const paquete = await call<any>("oc_leer_paquete", { caso: caseName })
  const validation = await call<any>("oc_validar", { caso: caseName, paquete })
  let numero: string | null = null
  let motivo: string | null = null

  if (validation.apta) {
    await call("oc_generar_evidencia", { caso: caseName })
    const built = await call<any>("oc_construir_payload", { caso: caseName, paquete, derivados: validation.derivados })
    const createRaw = await executeTool("oc_crear", tools.oc_crear, { caso: caseName, payload: built.orden, confirmado: confirm }, ctx)
    const create = JSON.parse(createRaw) as Envelope<any>
    if (create.ok) numero = create.data.numero_oc
    else motivo = create.error
  } else {
    // Registra el intento bloqueado a través de oc_crear no es posible sin payload;
    // el demo reporta el bloqueo directamente desde la validación.
    motivo = validation.bloqueos.map((x: any) => `${x.codigo}: ${x.detalle}`).join(" | ")
  }

  const result = {
    caso: caseName,
    apta: validation.apta,
    bloqueos: validation.bloqueos,
    confirmaciones: validation.confirmaciones,
    retroactiva: validation.retroactiva,
    numero_oc: numero,
    motivo,
  }
  console.log(JSON.stringify(result, null, 2))
  return { paquete, validation, numero, motivo }
}

console.log("\n=== Reto 03 · demo determinística sin LLM ===\n")
await processCase("sol-001")
console.log("\n--- Idempotencia sol-001 ---")
await processCase("sol-001")
await processCase("sol-002")
await processCase("sol-003")
console.log("\n--- sol-004 primero SIN confirmación ---")
await processCase("sol-004", false)
console.log("\n--- sol-004 tras confirmación explícita ---")
await processCase("sol-004", true)
console.log("\n--- sol-005 tras confirmación por retroactividad ---")
await processCase("sol-005", true)
console.log("\n--- sol-006 tras confirmación de IVA derivado ---")
await processCase("sol-006", true)

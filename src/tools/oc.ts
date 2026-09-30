import { z } from "zod"
import { fail, ok } from "../core/result.js"
import type { ToolDefinition } from "../core/tool.js"
import { PaqueteSchema, OrdenCompraSchema, type Paquete } from "../domain/schemas.js"
import { readPackage } from "../domain/package.js"
import { validatePackage, type ValidationResult } from "../domain/controls.js"
import { generateEvidence } from "../domain/evidence.js"
import { buildPayload } from "../domain/payload.js"
import { createOrder } from "../domain/create.js"

export const leer_paquete: ToolDefinition<{ caso: string }> = {
  description: "Lee y normaliza correo, solicitud, cotización, aprobación y factura opcional de un caso de orden de compra.",
  args: { caso: z.string().min(1).describe("Nombre de la carpeta del caso en fixtures/reto-03/solicitudes/") },
  async execute(args, ctx) {
    try { return JSON.stringify(ok(await readPackage(ctx.directory, args.caso))) }
    catch (e) { return JSON.stringify(fail(e instanceof Error ? e.message : "No se pudo leer el paquete")) }
  },
}

export const validar: ToolDefinition<{ caso: string; paquete: Paquete }> = {
  description: "Aplica RC1 a RC10 al paquete y devuelve bloqueos, confirmaciones, derivados y marca de retroactividad.",
  args: {
    caso: z.string().min(1).describe("Nombre del caso"),
    paquete: PaqueteSchema.describe("Paquete normalizado devuelto por oc_leer_paquete"),
  },
  async execute(args, ctx) {
    try { return JSON.stringify(ok(await validatePackage(ctx.directory, args.paquete))) }
    catch (e) { return JSON.stringify(fail(e instanceof Error ? e.message : "No se pudo validar")) }
  },
}

export const generar_evidencia: ToolDefinition<{ caso: string }> = {
  description: "Genera la evidencia TXT y PDF del correo de aprobación y devuelve rutas y SHA256.",
  args: { caso: z.string().min(1).describe("Nombre del caso") },
  async execute(args, ctx) {
    try { return JSON.stringify(ok(await generateEvidence(ctx.directory, args.caso))) }
    catch (e) { return JSON.stringify(fail(e instanceof Error ? e.message : "No se pudo generar evidencia")) }
  },
}

export const construir_payload: ToolDefinition<{ caso: string; paquete: Paquete; derivados: ValidationResult["derivados"] }> = {
  description: "Construye y valida el payload SAP, usando únicamente el paquete, maestros y valores derivados ya validados.",
  args: {
    caso: z.string().min(1).describe("Nombre del caso"),
    paquete: PaqueteSchema.describe("Paquete normalizado"),
    derivados: z.record(z.object({ value: z.unknown(), source: z.string(), requiresConfirmation: z.boolean() })).describe("Valores derivados por oc_validar"),
  },
  async execute(args, ctx) {
    try {
      const validation = await validatePackage(ctx.directory, args.paquete)
      validation.derivados = args.derivados
      return JSON.stringify(ok(await buildPayload(ctx.directory, args.caso, args.paquete, validation)))
    } catch (e) { return JSON.stringify(fail(e instanceof Error ? e.message : "No se pudo construir payload")) }
  },
}

export const crear: ToolDefinition<{ caso: string; payload: unknown; confirmado?: boolean }> = {
  description: "Crea la OC idempotente en SAP simulado si no hay bloqueos y toda confirmación humana requerida ya fue otorgada.",
  args: {
    caso: z.string().min(1).describe("Nombre del caso"),
    payload: OrdenCompraSchema.describe("Payload validado de la orden de compra"),
    confirmado: z.boolean().optional().describe("True solo tras confirmación humana explícita en el turno siguiente"),
  },
  async execute(args, ctx) {
    try { return JSON.stringify(ok(await createOrder(ctx, args.caso, args.payload, args.confirmado === true))) }
    catch (e) { return JSON.stringify(fail(e instanceof Error ? e.message : "No se pudo crear la OC")) }
  },
}

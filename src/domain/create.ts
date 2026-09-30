import type { ToolContext } from "../core/types.js"
import { FileSapAdapter } from "../sap/mock.js"
import { readPackage } from "./package.js"
import { validatePackage } from "./controls.js"
import { OrdenCompraSchema, type OrdenCompra } from "./schemas.js"
import { appendControl } from "../repositories/control.js"
import { hasConfirmation } from "../core/confirmation.js"

export async function createOrder(ctx: ToolContext, caseName: string, rawPayload: unknown, confirmed: boolean) {
  const paquete = await readPackage(ctx.directory, caseName)
  const validation = await validatePackage(ctx.directory, paquete)
  const reasons = validation.bloqueos.map((x) => `${x.codigo}: ${x.detalle}`)
  const confirmations = validation.confirmaciones.map((x) => `${x.codigo}: ${x.detalle}`)

  if (!validation.apta) {
    await appendControl(ctx.directory, ctx.clock, {
      solicitud_id: paquete.solicitud.solicitud_id,
      resultado: "blocked",
      retroactiva: validation.retroactiva,
      bloqueos: reasons,
      confirmaciones: confirmations,
    })
    throw new Error(`OC bloqueada: ${reasons.join(" | ")}`)
  }
  const backendConfirmed = validation.confirmaciones.length === 0 ? true : await hasConfirmation(ctx, caseName)
  if (validation.confirmaciones.length > 0 && (!confirmed || !backendConfirmed)) {
    await appendControl(ctx.directory, ctx.clock, {
      solicitud_id: paquete.solicitud.solicitud_id,
      resultado: "pending_confirmation",
      retroactiva: validation.retroactiva,
      bloqueos: reasons,
      confirmaciones: confirmations,
    })
    const gate = confirmed && !backendConfirmed ? "El flag confirmado=true no tiene una confirmación humana validada por backend." : "Se requiere confirmación humana."
    throw new Error(`${gate} ${confirmations.join(" | ")}`)
  }

  const order = OrdenCompraSchema.parse(rawPayload)
  const withConfirmation: OrdenCompra = {
    ...order,
    excepciones: order.excepciones.map((e) => ({
      ...e,
      confirmado_por: e.confirmado_por ?? (validation.confirmaciones.some((c) => c.codigo === e.codigo) ? (ctx.actor ?? ctx.sessionId) : null),
    })),
  }
  const sap = new FileSapAdapter(ctx.directory, ctx.clock)
  const existing = await sap.buscarOrdenPorReferencia(order.referencia.solicitud_id)
  if (existing) {
    await appendControl(ctx.directory, ctx.clock, {
      solicitud_id: order.referencia.solicitud_id,
      resultado: "idempotent",
      numero_oc: existing.numero_oc,
      retroactiva: validation.retroactiva,
      bloqueos: reasons,
      confirmaciones: confirmations,
    })
    return { numero_oc: existing.numero_oc, fecha: ctx.clock.now().toISOString(), idempotente: true }
  }

  const created = await sap.crearOrden(withConfirmation)
  await appendControl(ctx.directory, ctx.clock, {
    solicitud_id: order.referencia.solicitud_id,
    resultado: "created",
    numero_oc: created.numero_oc,
    retroactiva: validation.retroactiva,
    bloqueos: reasons,
    confirmaciones: confirmations,
  })
  return { ...created, idempotente: false }
}

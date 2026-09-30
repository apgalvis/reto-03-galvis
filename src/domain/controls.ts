import type { Paquete, Proveedor } from "./schemas.js"
import { loadMasters } from "../repositories/files.js"
import { normalizeName, normalizeNit } from "./normalize.js"

export type ControlStatus = "passed" | "blocked" | "confirmation" | "derived" | "not_applicable"
export type ControlResult = { codigo: `RC${number}`; status: ControlStatus; detalle: string }
export type Issue = { codigo: string; detalle: string }
export type DerivedValue<T = unknown> = { value: T; source: string; requiresConfirmation: boolean }

export type ValidationResult = {
  apta: boolean
  bloqueos: Issue[]
  confirmaciones: Issue[]
  derivados: Record<string, DerivedValue>
  retroactiva: boolean
  controles: ControlResult[]
}

function dateOnly(value: string): string {
  return value.slice(0, 10)
}

export async function validatePackage(directory: string, paquete: Paquete): Promise<ValidationResult> {
  const masters = await loadMasters(directory)
  const s = paquete.solicitud
  const controls: ControlResult[] = []
  const blocks: Issue[] = []
  const confirmations: Issue[] = []
  const derived: Record<string, DerivedValue> = {}

  let supplier: Proveedor | undefined
  if (s.proveedor_nit) {
    const nit = normalizeNit(s.proveedor_nit)
    supplier = masters.proveedores.find((p) => normalizeNit(p.nit) === nit)
  } else {
    const name = normalizeName(s.proveedor_nombre)
    supplier = masters.proveedores.find((p) => normalizeName(p.nombre) === name)
  }

  if (!supplier) {
    const issue = { codigo: "RC1", detalle: `Proveedor no encontrado: ${s.proveedor_nombre}` }
    blocks.push(issue); controls.push({ ...issue, status: "blocked" })
  } else if (!supplier.activo) {
    const issue = { codigo: "RC1", detalle: `Proveedor inactivo: ${supplier.nombre}` }
    blocks.push(issue); controls.push({ ...issue, status: "blocked" })
  } else {
    controls.push({ codigo: "RC1", status: "passed", detalle: `Proveedor activo ${supplier.codigo_sap}` })
    derived.proveedor = { value: supplier, source: "maestro.proveedores", requiresConfirmation: false }
  }

  const center = masters.centros.find((c) => c.centro_costo === s.centro_costo)
  const approver = center && paquete.aprobacion
    ? center.aprobadores.find((a) => a.email.toLowerCase() === paquete.aprobacion?.de.toLowerCase())
    : undefined

  if (!paquete.aprobacion) {
    const issue = { codigo: "RC2", detalle: "No existe evidencia de aprobación" }
    blocks.push(issue); controls.push({ ...issue, status: "blocked" })
  } else if (!paquete.aprobacion.aprobado) {
    const issue = { codigo: "RC2", detalle: "La aprobación no contiene la palabra 'Aprobado'" }
    blocks.push(issue); controls.push({ ...issue, status: "blocked" })
  } else if (!center) {
    const issue = { codigo: "RC2", detalle: `Centro de costo inexistente: ${s.centro_costo}` }
    blocks.push(issue); controls.push({ ...issue, status: "blocked" })
  } else if (!approver) {
    const issue = { codigo: "RC2", detalle: `${paquete.aprobacion.de} no es aprobador autorizado de ${s.centro_costo}` }
    blocks.push(issue); controls.push({ ...issue, status: "blocked" })
  } else {
    controls.push({ codigo: "RC2", status: "passed", detalle: `Aprobador autorizado: ${approver.email}` })
  }

  if (!approver) {
    controls.push({ codigo: "RC3", status: "not_applicable", detalle: "No se evalúa tope porque no existe aprobador autorizado para el centro" })
  } else if (s.valor_total > approver.tope) {
    const issue = { codigo: "RC3", detalle: `Valor ${s.valor_total} excede el tope ${approver.tope} de ${approver.email}` }
    blocks.push(issue); controls.push({ ...issue, status: "blocked" })
  } else {
    controls.push({ codigo: "RC3", status: "passed", detalle: `Valor dentro del tope ${approver.tope}` })
  }

  if (!center) {
    const issue = { codigo: "RC4", detalle: `Centro de costo inexistente: ${s.centro_costo}` }
    blocks.push(issue); controls.push({ ...issue, status: "blocked" })
  } else if (!center.subareas.includes(s.subarea)) {
    const issue = { codigo: "RC4", detalle: `Subárea ${s.subarea} no pertenece a ${s.centro_costo}` }
    blocks.push(issue); controls.push({ ...issue, status: "blocked" })
  } else {
    controls.push({ codigo: "RC4", status: "passed", detalle: `Subárea válida para ${s.centro_costo}` })
  }

  if (!paquete.cotizacion) {
    const issue = { codigo: "RC5", detalle: "No hay cotización; requiere confirmación" }
    confirmations.push(issue); controls.push({ ...issue, status: "confirmation" })
  } else if (s.valor_total === 0) {
    const issue = { codigo: "RC5", detalle: "No se puede calcular diferencia porque valor_total es 0" }
    confirmations.push(issue); controls.push({ ...issue, status: "confirmation" })
  } else {
    const difference = Math.abs(paquete.cotizacion.total - s.valor_total) / s.valor_total
    if (difference > 0.02) {
      const issue = {
        codigo: "RC5",
        detalle: `Cotización ${paquete.cotizacion.total} vs solicitud ${s.valor_total}; diferencia ${(difference * 100).toFixed(2)}%`,
      }
      confirmations.push(issue); controls.push({ ...issue, status: "confirmation" })
    } else {
      controls.push({ codigo: "RC5", status: "passed", detalle: `Diferencia ${(difference * 100).toFixed(2)}% dentro del 2%` })
    }
  }

  if (!s.indicador_iva) {
    if (supplier) {
      const issue = { codigo: "RC6", detalle: `IVA ausente; derivado ${supplier.indicador_iva_default} desde proveedor` }
      confirmations.push(issue); controls.push({ ...issue, status: "confirmation" })
      derived.indicador_iva = { value: supplier.indicador_iva_default, source: "maestro.proveedores.indicador_iva_default", requiresConfirmation: true }
    } else {
      controls.push({ codigo: "RC6", status: "not_applicable", detalle: "No se puede derivar IVA sin proveedor resuelto" })
    }
  } else {
    controls.push({ codigo: "RC6", status: "passed", detalle: `IVA informado: ${s.indicador_iva}` })
  }

  if (!s.condiciones_pago) {
    if (supplier) {
      controls.push({ codigo: "RC7", status: "derived", detalle: `Condición de pago derivada: ${supplier.condiciones_pago_default}` })
      derived.condiciones_pago = { value: supplier.condiciones_pago_default, source: "maestro.proveedores.condiciones_pago_default", requiresConfirmation: false }
    } else {
      controls.push({ codigo: "RC7", status: "not_applicable", detalle: "No se puede derivar pago sin proveedor resuelto" })
    }
  } else {
    controls.push({ codigo: "RC7", status: "passed", detalle: `Condición de pago informada: ${s.condiciones_pago}` })
  }

  const retroactive = Boolean(paquete.factura && paquete.factura.fecha < s.fecha_solicitud)
  if (retroactive && paquete.factura) {
    const issue = { codigo: "RC8", detalle: `Factura ${paquete.factura.numero} (${paquete.factura.fecha}) anterior a solicitud (${s.fecha_solicitud})` }
    confirmations.push(issue); controls.push({ ...issue, status: "confirmation" })
  } else {
    controls.push({ codigo: "RC8", status: "passed", detalle: "No se detecta OC retroactiva" })
  }

  if (!paquete.aprobacion) {
    controls.push({ codigo: "RC9", status: "not_applicable", detalle: "No hay aprobación para comparar fecha" })
  } else if (dateOnly(paquete.aprobacion.fecha) < s.fecha_solicitud) {
    const issue = { codigo: "RC9", detalle: `Aprobación ${dateOnly(paquete.aprobacion.fecha)} anterior a solicitud ${s.fecha_solicitud}` }
    confirmations.push(issue); controls.push({ ...issue, status: "confirmation" })
  } else {
    controls.push({ codigo: "RC9", status: "passed", detalle: "Fecha de aprobación válida" })
  }

  const calculated = s.cantidad * s.valor_unitario
  if (Math.abs(calculated - s.valor_total) > 1) {
    const issue = { codigo: "RC10", detalle: `cantidad × valor_unitario = ${calculated}, pero valor_total = ${s.valor_total}` }
    blocks.push(issue); controls.push({ ...issue, status: "blocked" })
  } else {
    controls.push({ codigo: "RC10", status: "passed", detalle: "Aritmética consistente" })
  }

  return { apta: blocks.length === 0, bloqueos: blocks, confirmaciones: confirmations, derivados: derived, retroactiva: retroactive, controles: controls }
}

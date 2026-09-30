import fs from "node:fs/promises"
import crypto from "node:crypto"
import path from "node:path"
import { resolveOutPath } from "../core/fileGuard.js"
import { type Paquete, OrdenCompraSchema, type OrdenCompra, type Proveedor } from "./schemas.js"
import type { ValidationResult } from "./controls.js"
import { writeJson } from "../repositories/files.js"

function inferUnit(description: string): "UN" | "H" | "MES" {
  const text = description.toLowerCase()
  if (/\b(hora|horas)\b/.test(text)) return "H"
  if (/\b(mensualidad|mensualidades)\b/.test(text) || /\b(mes|meses) de (servicio|suscripci[oó]n)\b/.test(text)) return "MES"
  return "UN"
}

function shortText(value: string): string {
  return Array.from(value).slice(0, 40).join("")
}

async function evidenceHash(directory: string, caseName: string): Promise<string> {
  const p = resolveOutPath(directory, caseName, "aprobacion.txt")
  const content = await fs.readFile(p, "utf8").catch(() => null)
  if (!content) throw new Error("Primero genera la evidencia de aprobación")
  const declared = content.match(/SHA256:\s*([a-f0-9]{64})/i)?.[1]
  if (!declared) throw new Error("Evidencia sin SHA256")
  const base = content.replace(/\n\nSHA256:\s*[a-f0-9]{64}\s*\n?$/i, "")
  const calculated = crypto.createHash("sha256").update(base, "utf8").digest("hex")
  if (calculated !== declared) throw new Error("Integridad de evidencia inválida")
  return declared
}

export async function buildPayload(
  directory: string,
  caseName: string,
  paquete: Paquete,
  validation: ValidationResult,
): Promise<{ orden: OrdenCompra; trazabilidad_ruta: string }> {
  if (!validation.apta) throw new Error("No se puede construir payload con bloqueos")
  const supplier = validation.derivados.proveedor?.value as Proveedor | undefined
  if (!supplier) throw new Error("Proveedor no resuelto")
  if (!paquete.aprobacion) throw new Error("Aprobación ausente")
  const iva = paquete.solicitud.indicador_iva ?? String(validation.derivados.indicador_iva?.value ?? "")
  const payment = paquete.solicitud.condiciones_pago ?? String(validation.derivados.condiciones_pago?.value ?? "")
  if (!iva || !payment) throw new Error("IVA o condición de pago no resueltos")

  const hash = await evidenceHash(directory, caseName)
  const orden: OrdenCompra = OrdenCompraSchema.parse({
    referencia: {
      solicitud_id: paquete.solicitud.solicitud_id,
      correo_id: paquete.correo.id,
      cotizacion_ref: paquete.cotizacion?.referencia ?? null,
    },
    sociedad: "1000",
    organizacion_compras: "1000",
    proveedor: { codigo_sap: supplier.codigo_sap, nit: supplier.nit, nombre: supplier.nombre },
    moneda: paquete.solicitud.moneda,
    condiciones_pago: payment,
    aprobador: { email: paquete.aprobacion.de, fecha_aprobacion: paquete.aprobacion.fecha, evidencia_sha256: hash },
    posiciones: [{
      numero: 10,
      descripcion: shortText(paquete.solicitud.descripcion),
      cantidad: paquete.solicitud.cantidad,
      unidad: inferUnit(paquete.solicitud.descripcion),
      precio_unitario: paquete.solicitud.valor_unitario,
      centro_costo: paquete.solicitud.centro_costo,
      subarea: paquete.solicitud.subarea,
      indicador_iva: iva,
    }],
    excepciones: validation.confirmaciones.map((c) => ({ codigo: c.codigo, detalle: c.detalle, confirmado_por: null })),
  })

  const trace = {
    "referencia.solicitud_id": "solicitud.solicitud_id",
    "referencia.correo_id": "correo.id",
    "referencia.cotizacion_ref": "cotizacion.referencia",
    "proveedor": "maestro.proveedores",
    "moneda": "solicitud.moneda",
    "condiciones_pago": paquete.solicitud.condiciones_pago ? "solicitud.condiciones_pago" : "derivado.condiciones_pago",
    "aprobador.email": "aprobacion.de",
    "aprobador.fecha_aprobacion": "aprobacion.fecha",
    "aprobador.evidencia_sha256": "evidencia.sha256",
    "posiciones[0].descripcion": "solicitud.descripcion (truncada a 40)",
    "posiciones[0].cantidad": "solicitud.cantidad",
    "posiciones[0].unidad": "derivado.unidad",
    "posiciones[0].precio_unitario": "solicitud.valor_unitario",
    "posiciones[0].centro_costo": "solicitud.centro_costo",
    "posiciones[0].subarea": "solicitud.subarea",
    "posiciones[0].indicador_iva": paquete.solicitud.indicador_iva ? "solicitud.indicador_iva" : "derivado.indicador_iva",
    "excepciones": "oc_validar.confirmaciones",
  }
  const tracePath = await writeJson(directory, [caseName, "trazabilidad.json"], trace)
  return { orden, trazabilidad_ruta: path.relative(directory, tracePath) }
}

export const _test = { inferUnit, shortText }

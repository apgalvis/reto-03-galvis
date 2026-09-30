import { parseInvoice, parseQuotation } from "./parsers.js"
import { PaqueteSchema, type Paquete } from "./schemas.js"
import { readCaseFiles } from "../repositories/files.js"

export async function readPackage(directory: string, caseName: string): Promise<Paquete> {
  const files = await readCaseFiles(directory, caseName)
  const missing: string[] = []
  if (!files.cotizacionText) missing.push("cotizacion.txt")
  if (!files.aprobacionRaw) missing.push("aprobacion.json")

  const paquete = {
    correo: {
      id: files.correo.id,
      de: files.correo.de,
      asunto: files.correo.asunto,
      fecha: files.correo.fecha,
    },
    solicitud: files.solicitud,
    cotizacion: files.cotizacionText ? parseQuotation(files.cotizacionText) : null,
    aprobacion: files.aprobacionRaw ? {
      de: files.aprobacionRaw.de,
      fecha: files.aprobacionRaw.fecha,
      aprobado: /\baprobado\b/i.test(files.aprobacionRaw.cuerpo),
      texto: [
        `De: ${files.aprobacionRaw.de}`,
        `Para: ${files.aprobacionRaw.para}`,
        `Fecha: ${files.aprobacionRaw.fecha}`,
        `Asunto: ${files.aprobacionRaw.asunto}`,
        "",
        files.aprobacionRaw.cuerpo,
      ].join("\n"),
    } : null,
    factura: files.facturaText ? parseInvoice(files.facturaText) : null,
    faltantes: missing,
  }
  return PaqueteSchema.parse(paquete)
}

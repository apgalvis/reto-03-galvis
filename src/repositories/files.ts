import fs from "node:fs/promises"
import path from "node:path"
import { resolveFixtureCase, resolveFixtureMasters, resolveOutPath } from "../core/fileGuard.js"
import { AprobacionRawSchema, CentroCostoSchema, CorreoSchema, ProveedorSchema, SolicitudSchema } from "../domain/schemas.js"
import { z } from "zod"

async function readJson(filePath: string): Promise<unknown> {
  return JSON.parse(await fs.readFile(filePath, "utf8"))
}

export async function readCaseFiles(directory: string, caseName: string) {
  const base = await resolveFixtureCase(directory, caseName)
  const correo = CorreoSchema.parse(await readJson(path.join(base, "correo.json")))
  const solicitud = SolicitudSchema.parse(await readJson(path.join(base, "solicitud.json")))

  const quotationPath = path.join(base, "cotizacion.txt")
  const approvalPath = path.join(base, "aprobacion.json")
  const invoicePath = path.join(base, "factura.txt")

  const cotizacionText = await fs.readFile(quotationPath, "utf8").catch(() => null)
  const aprobacionRaw = await readJson(approvalPath).then((x) => AprobacionRawSchema.parse(x)).catch(() => null)
  const facturaText = await fs.readFile(invoicePath, "utf8").catch(() => null)

  return { base, correo, solicitud, cotizacionText, aprobacionRaw, facturaText }
}

export async function loadMasters(directory: string) {
  const base = resolveFixtureMasters(directory)
  const proveedores = z.array(ProveedorSchema).parse(await readJson(path.join(base, "proveedores.json")))
  const centros = z.array(CentroCostoSchema).parse(await readJson(path.join(base, "centros-costo.json")))
  const iva = z.array(z.object({ codigo: z.string(), descripcion: z.string(), tasa: z.number() }))
    .parse(await readJson(path.join(base, "indicadores-iva.json")))
  const pagos = z.array(z.object({ codigo: z.string(), descripcion: z.string(), dias: z.number() }))
    .parse(await readJson(path.join(base, "condiciones-pago.json")))
  return { proveedores, centros, iva, pagos }
}

export async function writeJson(directory: string, relative: string[], data: unknown): Promise<string> {
  const target = resolveOutPath(directory, ...relative)
  await fs.mkdir(path.dirname(target), { recursive: true })
  await fs.writeFile(target, `${JSON.stringify(data, null, 2)}\n`, "utf8")
  return target
}

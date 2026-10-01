import fs from "node:fs/promises"
import path from "node:path"
import { resolveOutPath } from "../core/fileGuard.js"
import type { Clock } from "../core/clock.js"
import type { OrdenCompra } from "../domain/schemas.js"
import { loadMasters } from "../repositories/files.js"
import type { SapAdapter } from "./adapter.js"

export class FileSapAdapter implements SapAdapter {
  constructor(private readonly directory: string, private readonly clock: Clock) {}

  private orderFile() { return resolveOutPath(this.directory, "sap", "ordenes.jsonl") }

  private async records(): Promise<Array<{ numero_oc: string; fecha: string; orden: OrdenCompra }>> {
    const text = await fs.readFile(this.orderFile(), "utf8").catch(() => "")
    return text.split(/\r?\n/).filter(Boolean).map((line: string) => JSON.parse(line) as { numero_oc: string; fecha: string; orden: OrdenCompra })
  }

  async consultarProveedor(nit: string) {
    const { proveedores } = await loadMasters(this.directory)
    const p = proveedores.find((x: import("../domain/schemas.js").Proveedor) => x.nit === nit)
    return p ? { codigo_sap: p.codigo_sap, activo: p.activo } : null
  }

  async buscarOrdenPorReferencia(solicitud_id: string) {
    const found = (await this.records()).find((r) => r.orden.referencia.solicitud_id === solicitud_id)
    return found ? { numero_oc: found.numero_oc } : null
  }

  async crearOrden(orden: OrdenCompra) {
    const records = await this.records()
    const next = 4_500_000_001 + records.length
    const numero_oc = String(next)
    const fecha = this.clock.now().toISOString()
    const target = this.orderFile()
    await fs.mkdir(path.dirname(target), { recursive: true })
    await fs.appendFile(target, `${JSON.stringify({ numero_oc, fecha, orden })}\n`, "utf8")
    return { numero_oc, fecha }
  }
}

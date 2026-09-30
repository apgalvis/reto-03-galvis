import fs from "node:fs/promises"
import path from "node:path"
import { resolveOutPath } from "../core/fileGuard.js"
import type { Clock } from "../core/clock.js"

function csv(value: unknown): string {
  const text = Array.isArray(value) ? value.join(" | ") : String(value ?? "")
  return `"${text.replace(/"/g, '""')}"`
}

export async function appendControl(directory: string, clock: Clock, row: {
  solicitud_id: string
  resultado: string
  numero_oc?: string | null
  retroactiva: boolean
  bloqueos: string[]
  confirmaciones: string[]
}) {
  const target = resolveOutPath(directory, "control.csv")
  await fs.mkdir(path.dirname(target), { recursive: true })
  const exists = await fs.stat(target).then(() => true).catch(() => false)
  if (!exists) {
    await fs.writeFile(target, "solicitud_id,resultado,numero_oc,retroactiva,bloqueos,confirmaciones,ts\n", "utf8")
  }
  const values = [
    row.solicitud_id,
    row.resultado,
    row.numero_oc ?? "",
    row.retroactiva,
    row.bloqueos,
    row.confirmaciones,
    clock.now().toISOString(),
  ].map(csv).join(",")
  await fs.appendFile(target, `${values}\n`, "utf8")
}

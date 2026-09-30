import crypto from "node:crypto"
import fs from "node:fs/promises"
import path from "node:path"
import { resolveOutPath } from "../core/fileGuard.js"
import { readCaseFiles } from "../repositories/files.js"

export async function generateEvidence(directory: string, caseName: string) {
  const files = await readCaseFiles(directory, caseName)
  if (!files.aprobacionRaw) throw new Error("No existe aprobacion.json")
  const baseContent = [
    `De: ${files.aprobacionRaw.de}`,
    `Para: ${files.aprobacionRaw.para}`,
    `Fecha: ${files.aprobacionRaw.fecha}`,
    `Asunto: ${files.aprobacionRaw.asunto}`,
    "",
    files.aprobacionRaw.cuerpo,
  ].join("\n")
  const sha256 = crypto.createHash("sha256").update(baseContent, "utf8").digest("hex")
  const txtContent = `${baseContent}\n\nSHA256: ${sha256}\n`
  const txtPath = resolveOutPath(directory, caseName, "aprobacion.txt")
  await fs.mkdir(path.dirname(txtPath), { recursive: true })
  await fs.writeFile(txtPath, txtContent, "utf8")
  return { ruta: path.relative(directory, txtPath), sha256 }
}

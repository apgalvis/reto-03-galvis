import crypto from "node:crypto"
import fs from "node:fs/promises"
import path from "node:path"
import { PDFDocument, StandardFonts } from "pdf-lib"
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

  const pdf = await PDFDocument.create()
  const page = pdf.addPage([595.28, 841.89])
  const font = await pdf.embedFont(StandardFonts.Helvetica)
  let y = 800
  for (const line of txtContent.split("\n")) {
    const safe = line.replace(/[^\x20-\x7EÁÉÍÓÚáéíóúÑñÜü]/g, "")
    page.drawText(safe.slice(0, 105), { x: 45, y, size: 10, font })
    y -= 15
    if (y < 45) break
  }
  const pdfPath = resolveOutPath(directory, caseName, "aprobacion.pdf")
  await fs.writeFile(pdfPath, await pdf.save())
  return { ruta: path.relative(directory, txtPath), pdf_ruta: path.relative(directory, pdfPath), sha256 }
}

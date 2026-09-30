import path from "node:path"
import fs from "node:fs/promises"

function ensureInside(base: string, candidate: string): string {
  const resolvedBase = path.resolve(base)
  const resolvedCandidate = path.resolve(candidate)
  if (resolvedCandidate !== resolvedBase && !resolvedCandidate.startsWith(`${resolvedBase}${path.sep}`)) {
    throw new Error("Ruta fuera del directorio permitido")
  }
  return resolvedCandidate
}

export async function resolveFixtureCase(directory: string, caseName: string): Promise<string> {
  if (!/^[a-z0-9-]+$/i.test(caseName)) {
    throw new Error("Nombre de caso inválido")
  }
  const base = path.join(directory, "fixtures", "reto-03", "solicitudes")
  const candidate = ensureInside(base, path.join(base, caseName))
  const stat = await fs.stat(candidate).catch(() => null)
  if (!stat?.isDirectory()) throw new Error(`Caso no encontrado: ${caseName}`)
  return candidate
}

export function resolveFixtureMasters(directory: string): string {
  return ensureInside(
    path.join(directory, "fixtures", "reto-03"),
    path.join(directory, "fixtures", "reto-03", "maestros"),
  )
}

export function resolveOutPath(directory: string, ...segments: string[]): string {
  const base = path.join(directory, "out")
  return ensureInside(base, path.join(base, ...segments))
}

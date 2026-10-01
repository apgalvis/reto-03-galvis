import fs from "node:fs/promises"
import path from "node:path"

export async function loadAgentInstructions(directory: string): Promise<string> {
  const [prompt, knowledge] = await Promise.all([
    fs.readFile(path.join(directory, "agent", "prompt.md"), "utf8"),
    fs.readFile(path.join(directory, "src", "knowledge", "ordenes-compra.md"), "utf8"),
  ])
  return `${prompt.trim()}\n\n---\n\n${knowledge.trim()}`
}

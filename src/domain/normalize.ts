export function normalizeNit(value: string): string {
  const withoutCheckDigit = value.trim().replace(/-(\d)\s*$/, "")
  return withoutCheckDigit.replace(/\D/g, "")
}

export function normalizeName(value: string): string {
  return value
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase()
    .replace(/\b(s\.?a\.?s\.?|s\.?a\.?|ltda\.?|limitada)\b/g, "")
    .replace(/[^a-z0-9]+/g, " ")
    .trim()
    .replace(/\s+/g, " ")
}

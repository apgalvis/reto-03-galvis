export function normalizeNit(value: string): string {
  const digits = value.replace(/\D/g, "")
  return digits.length > 9 ? digits.slice(0, 9) : digits
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

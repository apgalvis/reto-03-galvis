import { normalizeNit } from "./normalize.js"

function moneyToNumber(raw: string): number {
  return Number(raw.replace(/[^0-9]/g, ""))
}

function addDays(dateText: string, days: number): string {
  const date = new Date(`${dateText}T00:00:00Z`)
  date.setUTCDate(date.getUTCDate() + days)
  return date.toISOString().slice(0, 10)
}

export function parseQuotation(text: string) {
  const reference = text.match(/^COTIZACI[ÓO]N\s+([^\r\n]+)/im)?.[1]?.trim() ?? null
  const provider = text.match(/^Proveedor:\s*(.+)$/im)?.[1]?.trim()
  const nitRaw = text.match(/^NIT:\s*([^\r\n]+)/im)?.[1]?.trim() ?? null
  const totalLine = text.match(/^TOTAL(?:\s*\([^)]*\))?:\s*([A-Z]{3})\s*([\d.,]+)/im)
  const dateText = text.match(/^Fecha:\s*(\d{4}-\d{2}-\d{2})$/im)?.[1]
  const validity = text.match(/Validez de la oferta:\s*(\d+)\s*d[ií]as/im)?.[1]
  if (!provider || !totalLine) throw new Error("Cotización incompleta: proveedor o TOTAL no encontrado")
  const totalRaw = totalLine[2]
  if (!totalRaw) throw new Error("Cotización incompleta: total no encontrado")

  return {
    referencia: reference,
    proveedor: provider,
    nit: nitRaw ? normalizeNit(nitRaw) : null,
    total: moneyToNumber(totalRaw),
    moneda: totalLine[1] ?? "COP",
    validez_hasta: dateText && validity ? addDays(dateText, Number(validity)) : null,
    texto: text,
  }
}

export function parseInvoice(text: string) {
  const number = text.match(/FACTURA(?:\s+ELECTR[ÓO]NICA\s+DE\s+VENTA)?\s+No\.\s*([^\r\n]+)/im)?.[1]?.trim()
  const date = text.match(/Fecha de emisi[óo]n:\s*(\d{4}-\d{2}-\d{2})/im)?.[1]
  const totalRaw = text.match(/^TOTAL:\s*[A-Z]{3}\s*([\d.,]+)/im)?.[1]
  if (!number || !date || !totalRaw) throw new Error("Factura incompleta: número, fecha o TOTAL no encontrado")
  return { numero: number, fecha: date, total: moneyToNumber(totalRaw) }
}

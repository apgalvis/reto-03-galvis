import { describe, expect, it } from "vitest"
import path from "node:path"
import { normalizeName, normalizeNit } from "../src/domain/normalize.js"
import { parseInvoice, parseQuotation } from "../src/domain/parsers.js"
import { readPackage } from "../src/domain/package.js"
import { validatePackage } from "../src/domain/controls.js"
import { _test as payloadHelpers } from "../src/domain/payload.js"

const root = path.resolve(process.cwd())

describe("normalización", () => {
  it("normaliza NIT con DV", () => expect(normalizeNit("900.555.111-2")).toBe("900555111"))
  it("normaliza nombres", () => expect(normalizeName("TecnoSuministros S.A.S.")).toBe("tecnosuministros"))
})

describe("parsers", () => {
  it("toma TOTAL de cotización, no subtotal", () => {
    const x = parseQuotation(`COTIZACIÓN X-1\nFecha: 2026-08-01\nProveedor: Demo S.A.S.\nNIT: 900.123.456-7\nSubtotal: COP 99.000\nTOTAL (IVA incluido): COP 120.000\nValidez de la oferta: 10 días`)
    expect(x.total).toBe(120000)
    expect(x.nit).toBe("900123456")
    expect(x.validez_hasta).toBe("2026-08-11")
  })
  it("parsea factura", () => {
    const x = parseInvoice(`FACTURA ELECTRÓNICA DE VENTA No. F-1\nFecha de emisión: 2026-08-10\nTOTAL: COP 3.200.000`)
    expect(x).toEqual({ numero: "F-1", fecha: "2026-08-10", total: 3200000 })
  })
})

describe("helpers SAP", () => {
  it("infiere H para horas", () => expect(payloadHelpers.inferUnit("Bolsa de 100 horas de arquitectura")).toBe("H"))
  it("trunca descripción a 40", () => expect(payloadHelpers.shortText("x".repeat(50))).toHaveLength(40))
})

describe("fixtures RC", () => {
  it("sol-001 pasa limpio", async () => {
    const p = await readPackage(root, "sol-001")
    const v = await validatePackage(root, p)
    expect(v.apta).toBe(true)
    expect(v.confirmaciones).toHaveLength(0)
  })
  it("sol-002 bloquea por proveedor", async () => {
    const p = await readPackage(root, "sol-002")
    const v = await validatePackage(root, p)
    expect(v.apta).toBe(false)
    expect(v.bloqueos.some((b) => b.codigo === "RC1")).toBe(true)
  })
  it("sol-003 bloquea autoridad", async () => {
    const p = await readPackage(root, "sol-003")
    const v = await validatePackage(root, p)
    expect(v.bloqueos.some((b) => b.codigo === "RC2")).toBe(true)
    expect(v.controles.find((c) => c.codigo === "RC3")?.status).toBe("not_applicable")
  })
  it("sol-004 pide confirmación por 6%", async () => {
    const p = await readPackage(root, "sol-004")
    const v = await validatePackage(root, p)
    expect(v.apta).toBe(true)
    expect(v.confirmaciones.some((c) => c.codigo === "RC5" && c.detalle.includes("6.00%"))).toBe(true)
  })
  it("sol-005 marca retroactiva", async () => {
    const p = await readPackage(root, "sol-005")
    const v = await validatePackage(root, p)
    expect(v.retroactiva).toBe(true)
    expect(v.confirmaciones.some((c) => c.codigo === "RC8")).toBe(true)
  })
  it("sol-006 deriva IVA y pago", async () => {
    const p = await readPackage(root, "sol-006")
    const v = await validatePackage(root, p)
    expect(v.apta).toBe(true)
    expect(v.derivados.indicador_iva?.value).toBe("C1")
    expect(v.derivados.condiciones_pago?.value).toBe("Z030")
    expect(v.confirmaciones.some((c) => c.codigo === "RC6")).toBe(true)
  })
})

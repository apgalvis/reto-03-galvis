import test from "node:test"
import assert from "node:assert/strict"
import path from "node:path"
import fs from "node:fs/promises"
import { normalizeName, normalizeNit } from "../src/domain/normalize.js"
import { parseInvoice, parseQuotation } from "../src/domain/parsers.js"
import { readPackage } from "../src/domain/package.js"
import { validatePackage } from "../src/domain/controls.js"
import { _test as payloadHelpers, buildPayload } from "../src/domain/payload.js"
import { generateEvidence } from "../src/domain/evidence.js"
import { createOrder } from "../src/domain/create.js"
import { FixedClock } from "../src/core/clock.js"
import { grantConfirmation } from "../src/core/confirmation.js"

const root = path.resolve(process.cwd())
const clock = new FixedClock(new Date("2026-09-30T12:00:00-05:00"))

test("normaliza NIT con DV", () => assert.equal(normalizeNit("900.555.111-2"), "900555111"))
test("normaliza nombres", () => assert.equal(normalizeName("TecnoSuministros S.A.S."), "tecnosuministros"))

test("parser toma TOTAL de cotización, no subtotal", () => {
  const x = parseQuotation(`COTIZACIÓN X-1\nFecha: 2026-08-01\nProveedor: Demo S.A.S.\nNIT: 900.123.456-7\nSubtotal: COP 99.000\nTOTAL (IVA incluido): COP 120.000\nValidez de la oferta: 10 días`)
  assert.equal(x.total, 120000)
  assert.equal(x.nit, "900123456")
  assert.equal(x.validez_hasta, "2026-08-11")
})

test("parsea factura", () => {
  const x = parseInvoice(`FACTURA ELECTRÓNICA DE VENTA No. F-1\nFecha de emisión: 2026-08-10\nTOTAL: COP 3.200.000`)
  assert.deepEqual(x, { numero: "F-1", fecha: "2026-08-10", total: 3200000 })
})

test("unidad: horas→H y vigencia en meses no convierte una licencia en MES", () => {
  assert.equal(payloadHelpers.inferUnit("Bolsa de 100 horas de arquitectura"), "H")
  assert.equal(payloadHelpers.inferUnit("Renovación licencias 120 puestos, vigencia 12 meses"), "UN")
})

test("trunca descripción a 40", () => assert.equal(payloadHelpers.shortText("x".repeat(50)).length, 40))

test("sol-001 pasa limpio", async () => {
  const p = await readPackage(root, "sol-001")
  const v = await validatePackage(root, p)
  assert.equal(v.apta, true)
  assert.equal(v.confirmaciones.length, 0)
})

test("sol-002 bloquea por proveedor", async () => {
  const p = await readPackage(root, "sol-002")
  const v = await validatePackage(root, p)
  assert.equal(v.apta, false)
  assert.equal(v.bloqueos.some((b) => b.codigo === "RC1"), true)
})

test("sol-003 bloquea autoridad y no inventa RC3", async () => {
  const p = await readPackage(root, "sol-003")
  const v = await validatePackage(root, p)
  assert.equal(v.bloqueos.some((b) => b.codigo === "RC2"), true)
  assert.equal(v.controles.find((c) => c.codigo === "RC3")?.status, "not_applicable")
})

test("sol-004 pide confirmación por 6%", async () => {
  const p = await readPackage(root, "sol-004")
  const v = await validatePackage(root, p)
  assert.equal(v.apta, true)
  assert.equal(v.confirmaciones.some((c) => c.codigo === "RC5" && c.detalle.includes("6.00%")), true)
})

test("sol-005 marca retroactiva", async () => {
  const p = await readPackage(root, "sol-005")
  const v = await validatePackage(root, p)
  assert.equal(v.retroactiva, true)
  assert.equal(v.confirmaciones.some((c) => c.codigo === "RC8"), true)
})

test("sol-006 deriva IVA y pago", async () => {
  const p = await readPackage(root, "sol-006")
  const v = await validatePackage(root, p)
  assert.equal(v.apta, true)
  assert.equal(v.derivados.indicador_iva?.value, "C1")
  assert.equal(v.derivados.condiciones_pago?.value, "Z030")
  assert.equal(v.confirmaciones.some((c) => c.codigo === "RC6"), true)
})

test("confirmado=true no bypassa el backend gate", async () => {
  await fs.rm(path.join(root, "out"), { recursive: true, force: true })
  const ctx = { directory: root, sessionId: "gate-test", actor: "tester", clock }
  const p = await readPackage(root, "sol-004")
  const v = await validatePackage(root, p)
  await generateEvidence(root, "sol-004")
  const { orden } = await buildPayload(root, "sol-004", p, v)
  await assert.rejects(() => createOrder(ctx, "sol-004", orden, true), /confirmación humana validada por backend/)
  await grantConfirmation(ctx, "sol-004")
  const created = await createOrder(ctx, "sol-004", orden, true)
  assert.equal(created.numero_oc, "4500000001")
})

test("payload alterado es rechazado aunque exista confirmación", async () => {
  await fs.rm(path.join(root, "out"), { recursive: true, force: true })
  const ctx = { directory: root, sessionId: "tamper-test", actor: "tester", clock }
  const p = await readPackage(root, "sol-004")
  const v = await validatePackage(root, p)
  await generateEvidence(root, "sol-004")
  const { orden } = await buildPayload(root, "sol-004", p, v)
  await grantConfirmation(ctx, "sol-004")
  const tampered = structuredClone(orden)
  tampered.posiciones[0]!.precio_unitario = 265000
  await assert.rejects(() => createOrder(ctx, "sol-004", tampered, true), /Payload rechazado/)
})


test("confirmación humana no se puede reutilizar", async () => {
  await fs.rm(path.join(root, "out"), { recursive: true, force: true })
  const ctx = { directory: root, sessionId: "single-use-test", actor: "tester", clock }
  const p = await readPackage(root, "sol-004")
  const v = await validatePackage(root, p)
  await generateEvidence(root, "sol-004")
  const { orden } = await buildPayload(root, "sol-004", p, v)
  await grantConfirmation(ctx, "sol-004")
  const first = await createOrder(ctx, "sol-004", orden, true)
  assert.equal(first.numero_oc, "4500000001")
  await assert.rejects(
    () => createOrder(ctx, "sol-004", orden, true),
    /confirmación humana validada por backend|ya fue utilizada/,
  )
})

# Reto 03 — Agente conversacional “Órdenes de Compra SAP”

Implementación TypeScript del reto técnico de Periferia IT Group.

## Milestone actual

Motor determinístico P0/P1 de lectura, RC1–RC10, evidencia TXT+PDF, payload SAP, SAP mock e idempotencia. `demo.ts` corre sin LLM/API key.

## Requisitos

- Node.js 20+
- npm 10+

## Ejecutar demo

```bash
npm install
npm run demo
```

## Tests y calidad

```bash
npm test
npm run typecheck
npm run build
```

`fixtures/` es solo lectura. `out/` se genera en ejecución y no se versiona.

# Reto 03 — Agente conversacional “Órdenes de Compra SAP”

Implementación TypeScript del reto técnico de Periferia IT Group.

## Estado

- Motor determinístico RC1–RC10 ✅
- `demo.ts` sin LLM/API key ✅
- SAP mock + idempotencia ✅
- Human-in-the-loop validado por backend ✅
- OpenAI Responses API adapter ✅
- Agent loop con tool calls visibles ✅
- API HTTP y sesiones en memoria ✅
- Front de chat ⏳
- Deploy público ⏳

## Requisitos

- Node.js 20+
- npm 10+

## Demo determinística (sin API key)

```bash
npm install
npm run demo
```

## Ejecutar el chat/API local

1. Copia `.env.example` a `.env`.
2. Define `OPENAI_API_KEY` únicamente en `.env`; nunca la subas al repositorio.
3. Arranca:

```bash
npm install
npm run dev
```

Por defecto la API queda en `http://localhost:3000`.

### API

```text
GET  /api/health
POST /api/chat
GET  /api/sessions/:id
```

Ejemplo de `POST /api/chat`:

```json
{
  "sessionId": "demo-001",
  "message": "Procesa sol-004. No crees la OC hasta que yo lo confirme."
}
```

La respuesta incluye `reply`, `toolCalls`, `needsConfirmation` y el estado de confirmación pendiente.

## Tests y calidad

```bash
npm test
npm run typecheck
npm run build
```

El suite actual cubre dominio, fixtures, anti-bypass de confirmación, integridad de payload y ciclo del agente con un adaptador LLM falso. Los tests no consumen la API de OpenAI.

## Seguridad

- `fixtures/` es solo lectura.
- `out/` se genera en ejecución y no se versiona.
- La API key vive solo en variables de entorno del backend.
- El LLM no puede autorizar una confirmación por sí mismo.
- `oc_crear` reconstruye el payload desde fuentes confiables antes de escribir en SAP mock.
- Hay topes configurables de iteraciones, tokens, tamaño de mensaje y timeout del proveedor.

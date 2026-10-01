# Reto 03 — Agente conversacional “Órdenes de Compra SAP”

Implementación TypeScript del reto técnico de Periferia IT Group.

## Enlaces

- **Aplicación pública:** https://reto-03-galvis.lovable.app
- **Backend / Health:** https://reto-03-galvis-production.up.railway.app/api/health
- **Repositorio:** https://github.com/apgalvis/reto-03-galvis

## Estado

- Motor determinístico RC1–RC10 ✅
- `demo.ts` sin LLM/API key ✅
- SAP mock + idempotencia ✅
- Human-in-the-loop validado por backend ✅
- Confirmaciones humanas de un solo uso ✅
- OpenAI Responses API adapter ✅
- Agent loop con tool calls visibles ✅
- API HTTP y sesiones en memoria ✅
- Front de chat público ✅
- Deploy público ✅
- Persistencia de runtime mediante Railway Volume ✅

## Arquitectura

El principio central de la solución es:

> **El modelo interpreta y orquesta; las reglas de negocio deciden.**

```text
Usuario
  ↓
Frontend conversacional
  ↓
API HTTP
  ↓
AgentLoop
  ↓
OpenAI Responses API
  ↓
Tools tipadas con Zod
  ↓
RC1–RC10 determinísticas
  ↓
Human-in-the-loop cuando aplica
  ↓
SAP mock + auditoría
```

## Requisitos

- Node.js 20+
- npm 10+

## Demo determinística (sin API key)

```bash
npm install
npm run demo
```

La demo procesa los fixtures directamente mediante las tools y no consume la API de OpenAI.

## Ejecutar el backend local

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

La respuesta incluye `reply`, `toolCalls`, `needsConfirmation`, `pendingConfirmation` y uso acumulado de tokens.

## Caso demostrativo: sol-004

El agente identifica una diferencia de **6 %** entre la solicitud y la cotización:

- Solicitud: COP 25.000.000
- Cotización: COP 26.500.000
- Regla: RC5
- Resultado: requiere confirmación humana

La OC no se crea hasta que el usuario confirme explícitamente en un turno posterior.

## Tests y calidad

```bash
npm test
npm run typecheck
npm run build
```

El suite cubre:

- dominio y fixtures;
- RC1–RC10;
- idempotencia;
- anti-bypass de confirmación;
- confirmaciones humanas de un solo uso;
- integridad del payload;
- ciclo del agente con un adaptador LLM falso.

Los tests no consumen la API de OpenAI.

## Seguridad

- `fixtures/` es solo lectura.
- La API key vive únicamente en variables de entorno del backend.
- El LLM no puede autorizar una confirmación por sí mismo.
- Una confirmación humana no puede reutilizarse.
- `oc_crear` reconstruye y compara el payload con las fuentes confiables antes de escribir en SAP mock.
- CORS se restringe al frontend público.
- Hay topes configurables de iteraciones, tokens, tamaño de mensaje y timeout del proveedor.
- La persistencia operativa se realiza fuera del repositorio mediante un volumen montado en Railway.

## Documentación técnica

Ver `SOLUCION.md` para arquitectura, decisiones de diseño, trade-offs, estrategia de integración SAP, supuestos, riesgos y aproximación productiva.

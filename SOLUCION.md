# SOLUCION — Reto 03

> Documento en construcción. La implementación determinística se completa antes de conectar el LLM, tal como exige `demo.ts`.

## 1. Problema
Automatizar la preparación y creación controlada de órdenes de compra, evitando digitación manual, bloqueando incumplimientos y haciendo visibles las excepciones que requieren decisión humana.

## 2. Arquitectura
El modelo interpreta y orquesta; las reglas de negocio deciden. El agente solo accede al dominio mediante tools Zod. `fixtures/` es read-only y `out/` concentra evidencia, trazabilidad, auditoría y SAP simulado.

## 3. Ciclo del agente
Implementado con un `AgentLoop` propio y un `LlmAdapter` desacoplado. El loop envía el system prompt y las tools al modelo, ejecuta cada function call mediante el registro de herramientas, devuelve `function_call_output` al modelo y repite hasta obtener respuesta textual o alcanzar `MAX_AGENT_ITERATIONS`. Cada tool call queda disponible para el frontend y auditado en `out/log.jsonl`.

La confirmación humana no se delega al modelo: `oc_validar` crea un estado pendiente; el turno termina con pregunta explícita; solo un mensaje posterior de confirmación registra la autorización del lado servidor. Aunque el modelo intente llamar `oc_crear` con `confirmado=true` antes de eso, el dominio lo rechaza.

La sesión también controla `MAX_SESSION_TOKENS` y el adaptador aplica timeout al proveedor LLM.

## 4. Elección del modelo
Proveedor elegido: OpenAI mediante Responses API. El modelo por defecto de desarrollo es `gpt-6-astra`, configurable con `OPENAI_MODEL`, para no acoplar el ciclo del agente a una versión específica. Se usa function calling nativo; las tools simples usan esquema estricto y las estructuras complejas mantienen validación Zod autoritativa en backend.

El costo por caso se cerrará con medición real de tokens cuando se ejecute el benchmark end-to-end. No se fija una cifra teórica como si fuera una medición observada.

## 5. Matriz de controles
Implementados RC1–RC10 en `src/domain/controls.ts` y cubiertos por tests de fixture.

## 6. Adaptador SAP real
Pendiente de desarrollar en detalle en la fase documental final.

## 7. Lectura del proceso
Pendiente de cierre.

## 8. Decisiones y trade-offs
1. Reglas determinísticas en código vs. reglas en prompt: se elige código para auditabilidad y demo sin LLM.
2. Filesystem vs. base de datos: se elige filesystem porque el PRD lo pide y DB está fuera de alcance.
3. Agent loop propio vs. framework pesado: se elige loop propio para explicabilidad y menor superficie de fallo.

## 9. Supuestos
La unidad SAP no existe explícitamente en el fixture; se deriva de forma determinística por semántica simple (horas→H, periodo mensual→MES, default→UN) y queda documentada.

## 10. Cobertura

| Historia | Estado | Evidencia |
|---|---|---|
| HU-1 Leer paquete | Hecho P0 | `oc_leer_paquete`, fixtures y tests |
| HU-2 Validar controles | Hecho P0 | RC1–RC10 + tests de los 6 casos |
| HU-3 Construir payload | Hecho P0 | Zod + `trazabilidad.json` |
| HU-4 Evidencia | Hecho P0 | TXT + SHA256; PDF queda P1 |
| HU-5 Crear OC | Hecho P0 | SAP mock, idempotencia y control CSV |
| HU-6 Manejo de errores | Hecho P0 backend | Resultados tipados y sesión recuperable |
| Chat público | Parcial | AgentLoop/API listos; front y deploy pendientes |

## 11. Uso de IA
Se utilizaron ChatGPT y herramientas conectadas para análisis del PRD, diseño, implementación asistida y revisión. Todo código se valida con tests y ejecución determinística; sugerencias no soportadas por el PRD se descartan o documentan como supuestos.

## 12. Riesgos
- **Alucinación o alteración de datos:** mitigada haciendo que valores y reglas vivan en tools determinísticas y reconstruyendo el payload antes de crear.
- **Autoaprobación del agente:** mitigada con confirmation gate persistido por sesión; `confirmado=true` del modelo no basta.
- **Costo/loops:** topes de iteraciones, tokens, tamaño de entrada y timeout.
- **Dependencia del proveedor LLM:** interfaz `LlmAdapter`; cambiar proveedor no modifica reglas ni tools.
- **Persistencia efímera en hosting serverless:** el P0 usa filesystem por requisito; para producción se abstraería storage sin cambiar dominio.

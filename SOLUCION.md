# SOLUCION — Reto 03

> Documento en construcción. La implementación determinística se completa antes de conectar el LLM, tal como exige `demo.ts`.

## 1. Problema
Automatizar la preparación y creación controlada de órdenes de compra, evitando digitación manual, bloqueando incumplimientos y haciendo visibles las excepciones que requieren decisión humana.

## 2. Arquitectura
El modelo interpreta y orquesta; las reglas de negocio deciden. El agente solo accede al dominio mediante tools Zod. `fixtures/` es read-only y `out/` concentra evidencia, trazabilidad, auditoría y SAP simulado.

## 3. Ciclo del agente
Pendiente de integrar en la siguiente fase. El diseño incluye límite de iteraciones y confirmación humana en turno separado.

## 4. Elección del modelo
Pendiente de benchmark/costo al integrar el adaptador LLM.

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
En progreso.

## 11. Uso de IA
Se utilizaron ChatGPT y herramientas conectadas para análisis del PRD, diseño, implementación asistida y revisión. Todo código se valida con tests y ejecución determinística; sugerencias no soportadas por el PRD se descartan o documentan como supuestos.

## 12. Riesgos
En progreso.

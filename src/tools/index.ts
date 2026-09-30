import { construir_payload, crear, generar_evidencia, leer_paquete, validar } from "./oc.js"

export const tools = {
  oc_leer_paquete: leer_paquete,
  oc_validar: validar,
  oc_construir_payload: construir_payload,
  oc_generar_evidencia: generar_evidencia,
  oc_crear: crear,
} as const

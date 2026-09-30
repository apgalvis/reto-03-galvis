---
name: ordenes-compra
description: Reglas y conocimiento para preparar, validar y crear órdenes de compra SAP.
---

# Conocimiento del proceso — Órdenes de Compra

- RC1: proveedor debe existir y estar activo.
- RC2: aprobación existe, contiene “Aprobado” y el remitente está autorizado para el centro de costo.
- RC3: el monto no supera el tope del aprobador autorizado.
- RC4: subárea pertenece al centro.
- RC5: cotización vs solicitud puede diferir máximo 2%; si excede o falta cotización, confirmar.
- RC6: IVA ausente se deriva del proveedor y se confirma.
- RC7: condición de pago ausente se deriva del proveedor y se informa.
- RC8: factura anterior a solicitud marca compra retroactiva y exige confirmación.
- RC9: aprobación anterior a solicitud exige confirmación.
- RC10: cantidad × valor unitario debe coincidir con total ±1.

Las reglas de negocio se implementan en código determinístico. Este archivo sirve como conocimiento legible para el agente y para el módulo reutilizable.

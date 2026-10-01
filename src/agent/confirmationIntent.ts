function normalized(value: string): string {
  return value.trim().toLowerCase().normalize("NFD").replace(/[\u0300-\u036f]/g, "")
}

export function isExplicitRejection(message: string): boolean {
  const value = normalized(message)
  return /\b(no confirmo|rechazo|cancelar|cancela|no crear|no procedas|detente)\b/.test(value)
}

export function isExplicitConfirmation(message: string): boolean {
  const value = normalized(message)
  if (isExplicitRejection(value)) return false
  return /\b(confirmo|confirmado|confirmar|si,? confirmo|proceder|procede)\b/.test(value)
}

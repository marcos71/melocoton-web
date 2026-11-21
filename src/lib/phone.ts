/**
 * The `tel:` link of a free-text phone (DI-51): only its digits and a leading `+`.
 * `null` when no digit is left, so the number is shown as plain text.
 */
export function telHref(phone: string): string | null {
  const digits = phone.replace(/\D/g, '')
  if (digits === '') return null
  return `tel:${phone.trim().startsWith('+') ? '+' : ''}${digits}`
}

export function parseVenuePhoneChile(
  raw: string | undefined | null
): { valid: true; value: string } | { valid: false } {
  const t = (raw ?? '').trim().replace(/\s/g, '')
  if (!t) return { valid: true, value: '' }
  if (/^\+569\d{8}$/.test(t)) return { valid: true, value: t }
  const digits = t.replace(/\D/g, '')
  if (digits.length === 8) return { valid: true, value: `+569${digits}` }
  if (digits.startsWith('569') && digits.length === 11) {
    return { valid: true, value: `+${digits}` }
  }
  return { valid: false }
}

export function whatsappUrlForPhone(
  phoneRaw: string | null | undefined,
  message: string
): string | null {
  const parsed = parseVenuePhoneChile(phoneRaw ?? '')
  if (!parsed.valid || !parsed.value) return null
  const digits = parsed.value.replace(/\D/g, '')
  if (digits.length < 10) return null
  return `https://wa.me/${digits}?text=${encodeURIComponent(message)}`
}

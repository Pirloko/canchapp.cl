import type { AccountType } from '@/lib/types'

const SPORTMATCH_URL =
  process.env.EXPO_PUBLIC_SPORTMATCH_URL?.trim() || 'https://www.sportmatch.cl'

export function isVenueAccount(accountType?: AccountType): boolean {
  return accountType === 'venue'
}

export function accessDeniedTitle(): string {
  return 'Acceso restringido'
}

export function accessDeniedMessage(accountType?: AccountType): string {
  if (accountType === 'admin') {
    return 'Las cuentas de administrador solo están disponibles en Sportmatch web.'
  }
  if (accountType === 'player') {
    return 'Esta app es solo para centros deportivos. Si eres jugador, usa Sportmatch.'
  }
  return 'Este tipo de cuenta no tiene acceso a Canchapp.'
}

export function accessDeniedDetail(accountType?: AccountType): string {
  return `${accessDeniedMessage(accountType)} Ingresa desde ${SPORTMATCH_URL}`
}

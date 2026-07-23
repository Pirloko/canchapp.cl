import type { VenueCourt, VenueReservationRow, VenueWeeklyHour } from '@/lib/types'
import { minutesOfDay, toDateInputValue } from '@/lib/venue-slots'

const DEFAULT_OPEN_MIN = 8 * 60
const DEFAULT_CLOSE_MIN = 23 * 60

export type DashboardStats = {
  pending: number
  confirmed: number
  occupancy: number
  confirmedRevenue: number
  pendingRevenue: number
  hasAnyPrice: boolean
}

function toMin(t: string): number {
  return Number(t.slice(0, 2)) * 60 + Number(t.slice(3, 5))
}

export function dayWindow(
  weeklyHours: VenueWeeklyHour[],
  day: Date
): { open: number; close: number } {
  const hours = weeklyHours.filter((h) => h.dayOfWeek === day.getDay())
  if (hours.length === 0) {
    return { open: DEFAULT_OPEN_MIN, close: DEFAULT_CLOSE_MIN }
  }
  let open = Number.POSITIVE_INFINITY
  let close = 0
  for (const h of hours) {
    open = Math.min(open, toMin(h.openTime))
    const c = toMin(h.closeTime)
    close = Math.max(close, c === 0 ? 24 * 60 : c)
  }
  return { open, close: Math.max(close, open + 60) }
}

export function reservationRevenue(
  r: VenueReservationRow,
  courts: VenueCourt[]
): number | null {
  const court = courts.find((c) => c.id === r.courtId)
  const price = r.pricePerHour ?? court?.pricePerHour ?? null
  if (price == null) return null
  return price * ((r.endsAt.getTime() - r.startsAt.getTime()) / 3_600_000)
}

/** Ocupación (0-100) de una cancha específica, agregada sobre un set de días (un día para vista semanal, una semana para vista mensual). */
export function courtBucketOccupancy(
  rows: VenueReservationRow[],
  courtId: string,
  weeklyHours: VenueWeeklyHour[],
  dayKeys: string[]
): number {
  let reservedMin = 0
  let capacityMin = 0
  for (const key of dayKeys) {
    const day = new Date(`${key}T12:00:00`)
    const window = dayWindow(weeklyHours, day)
    capacityMin += Math.max(window.close - window.open, 1)
    const dayRows = rows.filter(
      (r) =>
        r.courtId === courtId &&
        r.status !== 'cancelled' &&
        toDateInputValue(r.startsAt) === key
    )
    for (const r of dayRows) {
      const startRaw = minutesOfDay(r.startsAt)
      const endRaw = minutesOfDay(r.endsAt)
      const start = Math.max(startRaw, window.open)
      const end = Math.min(
        endRaw <= startRaw ? window.close : endRaw,
        window.close
      )
      if (end > start) reservedMin += end - start
    }
  }
  return capacityMin > 0
    ? Math.min(Math.round((reservedMin / capacityMin) * 100), 100)
    : 0
}

export function computeDashboardStats(
  rows: VenueReservationRow[],
  courts: VenueCourt[],
  weeklyHours: VenueWeeklyHour[],
  dayKeys: string[]
): DashboardStats {
  const active = rows.filter((r) => r.status !== 'cancelled')
  const pending = active.filter((r) => r.status === 'pending').length
  const confirmed = active.filter((r) => r.status === 'confirmed').length

  let reservedMin = 0
  let capacityMin = 0
  for (const key of dayKeys) {
    const day = new Date(`${key}T12:00:00`)
    const window = dayWindow(weeklyHours, day)
    const span = Math.max(window.close - window.open, 1)
    capacityMin += span * Math.max(courts.length, 1)
    const dayRows = active.filter((r) => toDateInputValue(r.startsAt) === key)
    for (const r of dayRows) {
      const startRaw = minutesOfDay(r.startsAt)
      const endRaw = minutesOfDay(r.endsAt)
      const start = Math.max(startRaw, window.open)
      const end = Math.min(
        endRaw <= startRaw ? window.close : endRaw,
        window.close
      )
      if (end > start) reservedMin += end - start
    }
  }

  const occupancy =
    capacityMin > 0
      ? Math.min(Math.round((reservedMin / capacityMin) * 100), 100)
      : 0

  let confirmedRevenue = 0
  let pendingRevenue = 0
  let hasAnyPrice = false
  for (const r of active) {
    const amount = reservationRevenue(r, courts)
    if (amount == null) continue
    hasAnyPrice = true
    if (r.status === 'confirmed') confirmedRevenue += amount
    else pendingRevenue += amount
  }

  return {
    pending,
    confirmed,
    occupancy,
    confirmedRevenue,
    pendingRevenue,
    hasAnyPrice,
  }
}

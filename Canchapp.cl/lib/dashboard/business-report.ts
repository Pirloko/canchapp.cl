import { getSupabase } from '@/lib/supabase/client'
import type { DashboardPeriod } from '@/lib/dashboard/period'
import type { DashboardStats } from '@/lib/dashboard/stats'
import type { SportsVenue, VenueCourt, VenueReservationRow } from '@/lib/types'
import { toDateInputValue } from '@/lib/venue-slots'

export type BusinessReportInput = {
  venue: SportsVenue
  courts: VenueCourt[]
  reservations: VenueReservationRow[]
  period: DashboardPeriod
  focusDate: Date
  stats: DashboardStats
}

export type BusinessReportResult =
  | { ok: true; report: string }
  | { ok: false; error: string; code?: 'not_deployed' | 'network' | 'unknown' }

function summarizeReservations(rows: VenueReservationRow[]) {
  const byStatus = { pending: 0, confirmed: 0, cancelled: 0 }
  const byWeekday: Record<number, number> = {}
  const byHour: Record<number, number> = {}

  for (const r of rows) {
    byStatus[r.status] += 1
    const d = r.startsAt
    byWeekday[d.getDay()] = (byWeekday[d.getDay()] ?? 0) + 1
    const hour = d.getHours()
    byHour[hour] = (byHour[hour] ?? 0) + 1
  }

  return { byStatus, byWeekday, byHour, total: rows.length }
}

export async function fetchBusinessReport(
  input: BusinessReportInput
): Promise<BusinessReportResult> {
  const supabase = getSupabase()
  const payload = {
    venue: {
      id: input.venue.id,
      name: input.venue.name,
      city: input.venue.city,
      courts: input.courts.length,
      slotMinutes: input.venue.slotDurationMinutes,
    },
    period: input.period,
    focusDate: toDateInputValue(input.focusDate),
    stats: input.stats,
    summary: summarizeReservations(input.reservations),
    sample: input.reservations.slice(0, 40).map((r) => ({
      date: toDateInputValue(r.startsAt),
      hour: r.startsAt.getHours(),
      status: r.status,
      courtId: r.courtId,
    })),
  }

  const { data, error } = await supabase.functions.invoke('venue-business-report', {
    body: payload,
  })

  const serverError =
    typeof data === 'object' && data && 'error' in data
      ? String((data as { error: string }).error)
      : null

  if (error || serverError) {
    const msg = serverError ?? error?.message ?? 'No se pudo generar el informe.'
    const notDeployed =
      msg.includes('404') ||
      msg.includes('not found') ||
      msg.includes('Failed to send')
    return {
      ok: false,
      error: notDeployed
        ? 'La función de informe aún no está desplegada en Supabase.'
        : msg,
      code: notDeployed ? 'not_deployed' : 'network',
    }
  }

  const report =
    typeof data === 'object' && data && 'report' in data
      ? String((data as { report: string }).report)
      : typeof data === 'string'
        ? data
        : null

  if (!report) {
    return { ok: false, error: 'Respuesta vacía del servidor.', code: 'unknown' }
  }

  return { ok: true, report }
}

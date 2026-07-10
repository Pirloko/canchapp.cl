import type { DashboardPeriod } from '@/lib/dashboard/period'
import { getPeriodRange } from '@/lib/dashboard/period'
import { dayWindow, reservationRevenue } from '@/lib/dashboard/stats'
import type { VenueCourt, VenueReservationRow, VenueWeeklyHour } from '@/lib/types'
import {
  WEEKDAY_SHORT_ES,
  formatDateLine,
  minutesOfDay,
  toDateInputValue,
} from '@/lib/venue-slots'

const HEAT_HOURS = [8, 9, 10, 11, 12, 13, 14, 15, 16, 17, 18, 19, 20, 21, 22]

export type HeatmapCell = { weekday: number; hour: number; count: number }

export type DailyBar = {
  key: string
  label: string
  count: number
  revenue: number
}

export type BoardBlock = {
  startMin: number
  endMin: number
  status: VenueReservationRow['status']
  label: string
}

export type BoardCourtRow = {
  name: string
  blocks: BoardBlock[]
}

export type VisualReportData = {
  periodLabel: string
  heatmap: HeatmapCell[]
  heatmapMax: number
  dailyBars: DailyBar[]
  statusBreakdown: { confirmed: number; pending: number; cancelled: number }
  boardDayKey: string
  boardDayLabel: string
  boardCourts: BoardCourtRow[]
  boardOpen: number
  boardClose: number
}

function activeRows(rows: VenueReservationRow[]): VenueReservationRow[] {
  return rows.filter((r) => r.status !== 'cancelled')
}

export function buildVisualReportData(input: {
  reservations: VenueReservationRow[]
  courts: VenueCourt[]
  weeklyHours: VenueWeeklyHour[]
  period: DashboardPeriod
  focusDate: Date
  focusDayKey: string
  periodLabel: string
}): VisualReportData {
  const { reservations, courts, weeklyHours, period, focusDate, focusDayKey } =
    input
  const range = getPeriodRange(period, focusDate)
  const periodRows = reservations.filter((r) =>
    range.dayKeys.includes(toDateInputValue(r.startsAt))
  )

  const heatCounts = new Map<string, number>()
  for (const r of activeRows(periodRows)) {
    const wd = r.startsAt.getDay()
    const hour = r.startsAt.getHours()
    if (!HEAT_HOURS.includes(hour)) continue
    const key = `${wd}-${hour}`
    heatCounts.set(key, (heatCounts.get(key) ?? 0) + 1)
  }

  const heatmap: HeatmapCell[] = []
  let heatmapMax = 0
  for (let wd = 0; wd < 7; wd++) {
    for (const hour of HEAT_HOURS) {
      const count = heatCounts.get(`${wd}-${hour}`) ?? 0
      heatmapMax = Math.max(heatmapMax, count)
      heatmap.push({ weekday: wd, hour, count })
    }
  }

  const dailyBars: DailyBar[] = range.dayKeys.map((key) => {
    const d = new Date(`${key}T12:00:00`)
    const rows = activeRows(
      periodRows.filter((r) => toDateInputValue(r.startsAt) === key)
    )
    let revenue = 0
    for (const r of rows) revenue += reservationRevenue(r, courts) ?? 0
    const label =
      period === 'month'
        ? `${d.getDate()}`
        : WEEKDAY_SHORT_ES[d.getDay()]
    return { key, label, count: rows.length, revenue }
  })

  const statusBreakdown = { confirmed: 0, pending: 0, cancelled: 0 }
  for (const r of periodRows) statusBreakdown[r.status] += 1

  const dayCounts = new Map<string, number>()
  for (const r of activeRows(periodRows)) {
    const key = toDateInputValue(r.startsAt)
    dayCounts.set(key, (dayCounts.get(key) ?? 0) + 1)
  }
  let boardDayKey = focusDayKey
  let best = 0
  for (const [key, count] of dayCounts) {
    if (count > best) {
      best = count
      boardDayKey = key
    }
  }
  if (best === 0) boardDayKey = focusDayKey

  const boardDay = new Date(`${boardDayKey}T12:00:00`)
  const window = dayWindow(weeklyHours, boardDay)
  const dayRows = activeRows(
    periodRows.filter((r) => toDateInputValue(r.startsAt) === boardDayKey)
  )

  const boardCourts: BoardCourtRow[] = courts.map((court) => ({
    name: court.name,
    blocks: dayRows
      .filter((r) => r.courtId === court.id)
      .map((r) => ({
        startMin: Math.max(minutesOfDay(r.startsAt), window.open),
        endMin: Math.min(
          minutesOfDay(r.endsAt) <= minutesOfDay(r.startsAt)
            ? window.close
            : minutesOfDay(r.endsAt),
          window.close
        ),
        status: r.status,
        label: `${r.status === 'confirmed' ? '✓' : '?'}`,
      }))
      .filter((b) => b.endMin > b.startMin),
  }))

  return {
    periodLabel: input.periodLabel,
    heatmap,
    heatmapMax: Math.max(heatmapMax, 1),
    dailyBars,
    statusBreakdown,
    boardDayKey,
    boardDayLabel: formatDateLine(boardDay),
    boardCourts,
    boardOpen: window.open,
    boardClose: window.close,
  }
}

export { HEAT_HOURS, WEEKDAY_SHORT_ES }

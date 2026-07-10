import { pad2, toDateInputValue } from '@/lib/venue-slots'

export type DashboardPeriod = 'day' | 'week' | 'month'

export type PeriodRange = {
  from: Date
  to: Date
  /** Días inclusivos del periodo (clave YYYY-MM-DD). */
  dayKeys: string[]
}

export function startOfDay(d: Date): Date {
  const copy = new Date(d)
  copy.setHours(0, 0, 0, 0)
  return copy
}

export function addDays(d: Date, days: number): Date {
  const copy = new Date(d)
  copy.setDate(copy.getDate() + days)
  return copy
}

export function addMonths(d: Date, months: number): Date {
  const copy = new Date(d)
  copy.setMonth(copy.getMonth() + months)
  return copy
}

/** Lunes como inicio de semana (es-CL). */
export function startOfWeek(d: Date): Date {
  const copy = startOfDay(d)
  const day = copy.getDay()
  const diff = day === 0 ? -6 : 1 - day
  copy.setDate(copy.getDate() + diff)
  return copy
}

export function startOfMonth(d: Date): Date {
  const copy = startOfDay(d)
  copy.setDate(1)
  return copy
}

export function buildDayKeys(from: Date, toExclusive: Date): string[] {
  const keys: string[] = []
  const cursor = startOfDay(from)
  const end = startOfDay(toExclusive)
  while (cursor < end) {
    keys.push(toDateInputValue(cursor))
    cursor.setDate(cursor.getDate() + 1)
  }
  return keys
}

export function getPeriodRange(
  period: DashboardPeriod,
  focusDate: Date
): PeriodRange {
  if (period === 'day') {
    const from = startOfDay(focusDate)
    const to = addDays(from, 1)
    return { from, to, dayKeys: [toDateInputValue(from)] }
  }

  if (period === 'week') {
    const from = startOfWeek(focusDate)
    const to = addDays(from, 7)
    return { from, to, dayKeys: buildDayKeys(from, to) }
  }

  const from = startOfMonth(focusDate)
  const to = addMonths(from, 1)
  return { from, to, dayKeys: buildDayKeys(from, to) }
}

export function shiftFocusDate(
  period: DashboardPeriod,
  focusDate: Date,
  direction: -1 | 1
): Date {
  if (period === 'day') return addDays(focusDate, direction)
  if (period === 'week') return addDays(focusDate, direction * 7)
  return addMonths(focusDate, direction)
}

export function formatPeriodNavigatorLabel(
  period: DashboardPeriod,
  focusDate: Date,
  compact = false
): string {
  if (period === 'day') {
    return focusDate.toLocaleDateString('es-CL', {
      weekday: compact ? 'short' : 'long',
      day: 'numeric',
      month: compact ? 'short' : 'long',
      year: compact ? undefined : 'numeric',
    })
  }

  const range = getPeriodRange(period, focusDate)
  const from = range.from
  const toLast = addDays(range.to, -1)

  if (period === 'week') {
    const sameMonth = from.getMonth() === toLast.getMonth()
    const fromStr = from.toLocaleDateString('es-CL', {
      day: 'numeric',
      month: sameMonth ? undefined : 'short',
    })
    const toStr = toLast.toLocaleDateString('es-CL', {
      day: 'numeric',
      month: 'short',
      year: compact ? undefined : 'numeric',
    })
    return `${fromStr} – ${toStr}`
  }

  return focusDate.toLocaleDateString('es-CL', {
    month: compact ? 'short' : 'long',
    year: 'numeric',
  })
}

export function periodChipLabel(period: DashboardPeriod): string {
  if (period === 'day') return 'Día'
  if (period === 'week') return 'Semana'
  return 'Mes'
}

export function monthWeekBuckets(dayKeys: string[]): string[][] {
  if (dayKeys.length === 0) return []
  const buckets: string[][] = []
  let current: string[] = []
  for (const key of dayKeys) {
    const d = new Date(`${key}T12:00:00`)
    if (current.length > 0 && d.getDay() === 1) {
      buckets.push(current)
      current = []
    }
    current.push(key)
  }
  if (current.length > 0) buckets.push(current)
  return buckets
}

export function isoRangeBounds(range: PeriodRange): {
  fromIso: string
  toIso: string
} {
  return {
    fromIso: range.from.toISOString(),
    toIso: range.to.toISOString(),
  }
}

export function fileStamp(d = new Date()): string {
  return `${d.getFullYear()}${pad2(d.getMonth() + 1)}${pad2(d.getDate())}`
}

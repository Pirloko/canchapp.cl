import type { VenueWeeklyHour } from '@/lib/types'
import { fetchBusinessReport, type BusinessReportInput } from '@/lib/dashboard/business-report'
import { formatPeriodNavigatorLabel } from '@/lib/dashboard/period'
import {
  buildVisualReportData,
  type VisualReportData,
} from '@/lib/dashboard/visual-report-data'
import { buildVisualReportHtml } from '@/lib/dashboard/visual-report-html'

export type BusinessReportBundle = {
  analysis: string
  visual: VisualReportData
  html: string
}

export async function generateBusinessReport(
  input: BusinessReportInput & {
    weeklyHours: VenueWeeklyHour[]
    focusDayKey: string
  }
): Promise<
  | { ok: true; report: BusinessReportBundle }
  | { ok: false; error: string; code?: string }
> {
  const periodLabel = formatPeriodNavigatorLabel(input.period, input.focusDate)
  const visual = buildVisualReportData({
    reservations: input.reservations,
    courts: input.courts,
    weeklyHours: input.weeklyHours,
    period: input.period,
    focusDate: input.focusDate,
    focusDayKey: input.focusDayKey,
    periodLabel,
  })

  const ai = await fetchBusinessReport(input)
  if (!ai.ok) return ai

  const html = buildVisualReportHtml({
    venueName: input.venue.name,
    periodLabel,
    stats: input.stats,
    visual,
    analysis: ai.report,
  })

  return {
    ok: true,
    report: { analysis: ai.report, visual, html },
  }
}

import type { DashboardPeriod } from '@/lib/dashboard/period'
import type { DashboardStats } from '@/lib/dashboard/stats'
import type {
  SportsVenue,
  VenueCourt,
  VenueReservationRow,
  VenueWeeklyHour,
} from '@/lib/types'

export type ExportContext = {
  venue: SportsVenue
  courts: VenueCourt[]
  reservations: VenueReservationRow[]
  period: DashboardPeriod
  focusDate: Date
  focusDayKey: string
  weeklyHours: VenueWeeklyHour[]
  stats: DashboardStats
  courtNameById: Map<string, string>
}

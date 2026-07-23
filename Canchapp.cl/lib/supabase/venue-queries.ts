import type { SupabaseClient } from '@supabase/supabase-js'

import type {
  SportsVenue,
  VenueCourt,
  VenueReservationRow,
  VenueWeeklyHour,
} from '@/lib/types'

const VENUE_SELECT =
  'id, owner_id, name, address, maps_url, phone, city, city_id, is_paused, slot_duration_minutes, created_at'

export function mapVenueRow(r: Record<string, unknown>): SportsVenue {
  return {
    id: r.id as string,
    ownerId: r.owner_id as string,
    name: r.name as string,
    address: (r.address as string) ?? '',
    mapsUrl: (r.maps_url as string | null) ?? null,
    phone: (r.phone as string) ?? '',
    cityId: (r.city_id as string | null) ?? '',
    city: (r.city as string) ?? 'Rancagua',
    isPaused: (r.is_paused as boolean) ?? false,
    slotDurationMinutes: (r.slot_duration_minutes as number) ?? 60,
    createdAt: new Date(r.created_at as string),
  }
}

function mapReservationRow(r: Record<string, unknown>): VenueReservationRow {
  return {
    id: r.id as string,
    courtId: r.court_id as string,
    startsAt: new Date(r.starts_at as string),
    endsAt: new Date(r.ends_at as string),
    bookerUserId: (r.booker_user_id as string | null) ?? null,
    matchOpportunityId: (r.match_opportunity_id as string | null) ?? null,
    status: r.status as VenueReservationRow['status'],
    paymentStatus:
      (r.payment_status as VenueReservationRow['paymentStatus']) ?? undefined,
    pricePerHour: (r.price_per_hour as number | null) ?? undefined,
    confirmedAt: r.confirmed_at ? new Date(r.confirmed_at as string) : null,
    cancelledAt: r.cancelled_at ? new Date(r.cancelled_at as string) : null,
    cancelledReason: (r.cancelled_reason as string | null) ?? null,
    confirmationSource:
      (r.confirmation_source as VenueReservationRow['confirmationSource']) ??
      null,
    confirmationNote: (r.confirmation_note as string | null) ?? null,
    notes: (r.notes as string | null) ?? null,
  }
}

export async function fetchVenueForOwner(
  supabase: SupabaseClient,
  ownerId: string
): Promise<SportsVenue | null> {
  const { data, error } = await supabase
    .from('sports_venues')
    .select(VENUE_SELECT)
    .eq('owner_id', ownerId)
    .maybeSingle()
  if (error || !data) return null
  return mapVenueRow(data as Record<string, unknown>)
}

export async function fetchVenueCourts(
  supabase: SupabaseClient,
  venueId: string
): Promise<VenueCourt[]> {
  const { data, error } = await supabase
    .from('venue_courts')
    .select('id, venue_id, name, sort_order, price_per_hour, sport_id')
    .eq('venue_id', venueId)
    .order('sort_order', { ascending: true })
    .order('name', { ascending: true })
  if (error || !data) return []
  return data.map((r) => ({
    id: r.id as string,
    venueId: r.venue_id as string,
    name: r.name as string,
    sortOrder: (r.sort_order as number) ?? 0,
    pricePerHour:
      r.price_per_hour != null ? (r.price_per_hour as number) : null,
    sportId: (r.sport_id as string) ?? 'football',
  }))
}

export async function fetchVenueWeeklyHours(
  supabase: SupabaseClient,
  venueId: string
): Promise<VenueWeeklyHour[]> {
  const { data, error } = await supabase
    .from('venue_weekly_hours')
    .select('id, venue_id, day_of_week, open_time, close_time')
    .eq('venue_id', venueId)
    .order('day_of_week', { ascending: true })
  if (error || !data) return []
  return data.map((r) => ({
    id: r.id as string,
    venueId: r.venue_id as string,
    dayOfWeek: r.day_of_week as number,
    openTime: (r.open_time as string).slice(0, 5),
    closeTime: (r.close_time as string).slice(0, 5),
  }))
}

export async function fetchVenueReservationsRange(
  supabase: SupabaseClient,
  venueId: string,
  fromIso: string,
  toIso: string
): Promise<VenueReservationRow[]> {
  const courts = await fetchVenueCourts(supabase, venueId)
  if (!courts.length) return []
  const courtIds = courts.map((c) => c.id)
  const { data, error } = await supabase
    .from('venue_reservations')
    .select(
      'id, court_id, starts_at, ends_at, booker_user_id, match_opportunity_id, status, payment_status, price_per_hour, confirmed_at, cancelled_at, cancelled_reason, confirmation_source, confirmation_note, notes'
    )
    .in('court_id', courtIds)
    .lt('starts_at', toIso)
    .gt('ends_at', fromIso)
    .order('starts_at', { ascending: true })
  if (error || !data) return []
  return data.map((r) => mapReservationRow(r as Record<string, unknown>))
}

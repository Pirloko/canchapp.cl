export type AccountType = 'player' | 'venue' | 'admin'

export interface VenueUser {
  id: string
  email: string
  name: string
  accountType: AccountType
}

export interface SportsVenue {
  id: string
  ownerId: string
  name: string
  address: string
  mapsUrl: string | null
  phone: string
  cityId: string
  city: string
  isPaused: boolean
  slotDurationMinutes: number
  createdAt: Date
}

export interface VenueCourt {
  id: string
  venueId: string
  name: string
  sortOrder: number
  pricePerHour?: number | null
  sportId: string
}

export interface VenueWeeklyHour {
  id: string
  venueId: string
  dayOfWeek: number
  openTime: string
  closeTime: string
}

export interface VenueReservationRow {
  id: string
  courtId: string
  startsAt: Date
  endsAt: Date
  bookerUserId: string | null
  matchOpportunityId: string | null
  status: 'pending' | 'confirmed' | 'cancelled'
  paymentStatus?: 'unpaid' | 'deposit_paid' | 'paid'
  pricePerHour?: number | null
  confirmedAt?: Date | null
  cancelledAt?: Date | null
  cancelledReason?: string | null
  confirmationSource?: 'venue_owner' | 'booker_self' | 'admin' | null
  confirmationNote?: string | null
  notes?: string | null
}

export interface VenueOnboardingData {
  name: string
  address: string
  phone: string
  city: string
  mapsUrl: string | null
  slotDurationMinutes: number
}

export type AuthRoute = 'loading' | 'login' | 'denied' | 'onboarding' | 'app'

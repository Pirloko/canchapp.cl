import type { SupabaseClient } from '@supabase/supabase-js'

import type { VenueReservationRow } from '@/lib/types'

export type MatchSnippet = { id: string; title: string; creatorId: string }
export type OrganizerSnippet = {
  id: string
  name: string
  whatsappPhone: string | null
}

export async function fetchMatchAndOrganizerMapsForVenueBookings(
  supabase: SupabaseClient,
  reservations: VenueReservationRow[]
): Promise<{
  matchById: Map<string, MatchSnippet>
  organizerById: Map<string, OrganizerSnippet>
}> {
  const matchById = new Map<string, MatchSnippet>()
  const organizerById = new Map<string, OrganizerSnippet>()

  const matchIds = [
    ...new Set(
      reservations.map((r) => r.matchOpportunityId).filter(Boolean)
    ),
  ] as string[]

  const contactIds = new Set<string>()
  for (const r of reservations) {
    if (r.bookerUserId) contactIds.add(r.bookerUserId)
  }

  if (matchIds.length > 0) {
    const { data: matches } = await supabase
      .from('match_opportunities')
      .select('id, title, creator_id')
      .in('id', matchIds)
    for (const m of matches ?? []) {
      const id = m.id as string
      const creatorId = m.creator_id as string
      contactIds.add(creatorId)
      matchById.set(id, {
        id,
        title: (m.title as string) ?? 'Partido',
        creatorId,
      })
    }
  }

  if (contactIds.size === 0) {
    return { matchById, organizerById }
  }

  const { data: profs } = await supabase
    .from('profiles')
    .select('id, name, whatsapp_phone')
    .in('id', [...contactIds])

  for (const p of profs ?? []) {
    organizerById.set(p.id as string, {
      id: p.id as string,
      name: (p.name as string) ?? 'Organizador',
      whatsappPhone: (p.whatsapp_phone as string | null) ?? null,
    })
  }

  return { matchById, organizerById }
}

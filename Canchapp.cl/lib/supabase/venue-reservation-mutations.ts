import type { PostgrestError, SupabaseClient } from '@supabase/supabase-js'

export async function insertVenueReservationRow(
  supabase: SupabaseClient,
  payload: Record<string, unknown>
): Promise<{ error: PostgrestError | null }> {
  const { error } = await supabase.from('venue_reservations').insert(payload)
  return { error }
}

export async function confirmVenueReservationAsVenueOwner(
  supabase: SupabaseClient,
  reservationId: string
): Promise<{ error: PostgrestError | null }> {
  const { error } = await supabase.rpc('confirm_venue_reservation_as_owner', {
    p_reservation_id: reservationId,
    p_mark_paid: true,
    p_note: 'Confirmada por centro deportivo',
  })
  return { error }
}

export async function cancelVenueReservationAsVenueOwner(
  supabase: SupabaseClient,
  reservationId: string,
  reason: string
): Promise<{ error: PostgrestError | null }> {
  const { error } = await supabase.rpc('cancel_venue_reservation_as_owner', {
    p_reservation_id: reservationId,
    p_reason: reason,
  })
  return { error }
}

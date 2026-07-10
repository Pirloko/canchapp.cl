import { useEffect, useId, useRef } from 'react'

import { getSupabase } from '@/lib/supabase/client'

export function useVenueReservationsRealtime(
  venueId: string | undefined,
  onRefresh: () => void
) {
  const onRefreshRef = useRef(onRefresh)
  onRefreshRef.current = onRefresh
  const instanceId = useId()

  useEffect(() => {
    if (!venueId) return
    const supabase = getSupabase()
    let debounceTimer: ReturnType<typeof setTimeout> | null = null
    const scheduleReload = () => {
      if (debounceTimer) clearTimeout(debounceTimer)
      debounceTimer = setTimeout(() => {
        onRefreshRef.current()
      }, 280)
    }

    // Cada pantalla usa su propio canal: reutilizar el mismo nombre tras subscribe()
    // falla si Resumen y Reservas están montadas a la vez (tabs de Expo Router).
    const channel = supabase
      .channel(`canchapp-venue-bookings:${venueId}:${instanceId}`)
      .on(
        'postgres_changes',
        { event: '*', schema: 'public', table: 'venue_reservations' },
        scheduleReload
      )
      .subscribe()

    return () => {
      if (debounceTimer) clearTimeout(debounceTimer)
      void supabase.removeChannel(channel)
    }
  }, [venueId, instanceId])
}

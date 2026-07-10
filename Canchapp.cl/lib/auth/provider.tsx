import type { Session } from '@supabase/supabase-js'
import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useState,
  type ReactNode,
} from 'react'

import { isVenueAccount } from '@/lib/auth/venue-guard'
import {
  getSupabase,
  getSupabaseOrNull,
  isSupabaseConfigured,
} from '@/lib/supabase/client'
import { fetchVenueForOwner } from '@/lib/supabase/venue-queries'
import type {
  AuthRoute,
  AccountType,
  SportsVenue,
  VenueOnboardingData,
  VenueUser,
} from '@/lib/types'

type AuthContextValue = {
  loading: boolean
  route: AuthRoute
  user: VenueUser | null
  venue: SportsVenue | null
  signIn: (
    email: string,
    password: string
  ) => Promise<{ ok: boolean; error?: string; route?: AuthRoute }>
  signOut: () => Promise<void>
  refreshVenue: () => Promise<void>
  completeOnboarding: (
    data: VenueOnboardingData
  ) => Promise<{ ok: boolean; error?: string }>
  updatePassword: (
    currentPassword: string,
    newPassword: string
  ) => Promise<{ ok: boolean; error?: string }>
}

const AuthContext = createContext<AuthContextValue | null>(null)

async function fetchProfile(
  userId: string,
  email: string
): Promise<VenueUser | null> {
  const supabase = getSupabase()
  const { data, error } = await supabase
    .from('profiles')
    .select('id, name, account_type')
    .eq('id', userId)
    .maybeSingle()
  if (error || !data) return null
  return {
    id: userId,
    email,
    name: (data.name as string) ?? 'Centro',
    accountType: (data.account_type as AccountType) ?? 'player',
  }
}

function resolveRoute(
  user: VenueUser | null,
  venue: SportsVenue | null
): AuthRoute {
  if (!user) return 'login'
  if (!isVenueAccount(user.accountType)) return 'denied'
  if (!venue) return 'onboarding'
  return 'app'
}

export function AuthProvider({ children }: { children: ReactNode }) {
  const [loading, setLoading] = useState(true)
  const [user, setUser] = useState<VenueUser | null>(null)
  const [venue, setVenue] = useState<SportsVenue | null>(null)

  const hydrateFromSession = useCallback(
    async (session: Session | null): Promise<AuthRoute> => {
      if (!session?.user) {
        setUser(null)
        setVenue(null)
        return 'login'
      }
      const profile = await fetchProfile(
        session.user.id,
        session.user.email ?? ''
      )
      if (!profile) {
        setUser(null)
        setVenue(null)
        return 'login'
      }
      setUser(profile)
      if (isVenueAccount(profile.accountType)) {
        const v = await fetchVenueForOwner(getSupabase(), profile.id)
        setVenue(v)
        return resolveRoute(profile, v)
      }
      setVenue(null)
      return resolveRoute(profile, null)
    },
    []
  )

  useEffect(() => {
    if (!isSupabaseConfigured()) {
      setLoading(false)
      return
    }
    const supabase = getSupabaseOrNull()
    if (!supabase) {
      setLoading(false)
      return
    }

    void supabase.auth.getSession().then(({ data }) => {
      void hydrateFromSession(data.session).finally(() => setLoading(false))
    })

    const { data: sub } = supabase.auth.onAuthStateChange((_event, session) => {
      void hydrateFromSession(session)
    })
    return () => sub.subscription.unsubscribe()
  }, [hydrateFromSession])

  const signIn = useCallback(async (email: string, password: string) => {
    if (!isSupabaseConfigured()) {
      return { ok: false, error: 'Supabase no configurado. Revisa .env' }
    }
    const supabase = getSupabase()
    const { data, error } = await supabase.auth.signInWithPassword({
      email: email.trim().toLowerCase(),
      password,
    })
    if (error) return { ok: false, error: error.message }
    const nextRoute = await hydrateFromSession(data.session)
    return { ok: true, route: nextRoute }
  }, [hydrateFromSession])

  const signOut = useCallback(async () => {
    const supabase = getSupabaseOrNull()
    if (supabase) await supabase.auth.signOut()
    setUser(null)
    setVenue(null)
  }, [])

  const refreshVenue = useCallback(async () => {
    if (!user || !isVenueAccount(user.accountType)) return
    const v = await fetchVenueForOwner(getSupabase(), user.id)
    setVenue(v)
  }, [user])

  const completeOnboarding = useCallback(
    async (data: VenueOnboardingData) => {
      if (!user || !isVenueAccount(user.accountType)) {
        return { ok: false, error: 'Solo aplica a cuentas centro.' }
      }
      const supabase = getSupabase()
      const existing = await fetchVenueForOwner(supabase, user.id)
      if (existing) {
        setVenue(existing)
        return { ok: true }
      }
      const slot = Math.min(
        180,
        Math.max(15, Math.round(data.slotDurationMinutes) || 60)
      )
      const { error: insErr } = await supabase.from('sports_venues').insert({
        owner_id: user.id,
        name: data.name.trim(),
        address: data.address.trim(),
        phone: data.phone.trim(),
        city: data.city.trim() || 'Rancagua',
        maps_url: data.mapsUrl?.trim() || null,
        slot_duration_minutes: slot,
      })
      if (insErr) return { ok: false, error: insErr.message }
      await supabase
        .from('profiles')
        .update({ name: data.name.trim() })
        .eq('id', user.id)
      const venueRow = await fetchVenueForOwner(supabase, user.id)
      setVenue(venueRow)
      setUser({ ...user, name: data.name.trim() })
      return { ok: true }
    },
    [user]
  )

  const updatePassword = useCallback(
    async (currentPassword: string, newPassword: string) => {
      if (!user?.email) return { ok: false, error: 'Sin sesión.' }
      const supabase = getSupabase()
      const { error: reauthErr } = await supabase.auth.signInWithPassword({
        email: user.email,
        password: currentPassword,
      })
      if (reauthErr) {
        return { ok: false, error: 'Contraseña actual incorrecta.' }
      }
      const { error } = await supabase.auth.updateUser({ password: newPassword })
      if (error) return { ok: false, error: error.message }
      return { ok: true }
    },
    [user]
  )

  const route = useMemo(() => resolveRoute(user, venue), [user, venue])

  const value = useMemo(
    () => ({
      loading,
      route,
      user,
      venue,
      signIn,
      signOut,
      refreshVenue,
      completeOnboarding,
      updatePassword,
    }),
    [
      loading,
      route,
      user,
      venue,
      signIn,
      signOut,
      refreshVenue,
      completeOnboarding,
      updatePassword,
    ]
  )

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>
}

export function useAuth() {
  const ctx = useContext(AuthContext)
  if (!ctx) throw new Error('useAuth debe usarse dentro de AuthProvider')
  return ctx
}

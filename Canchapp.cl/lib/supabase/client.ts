import 'react-native-url-polyfill/auto'

import AsyncStorage from '@react-native-async-storage/async-storage'
import { createClient as createSupabaseClient } from '@supabase/supabase-js'
import type { SupabaseClient } from '@supabase/supabase-js'
import { Platform } from 'react-native'

const storageKey = 'canchapp-auth'

let supabaseSingleton: SupabaseClient | null = null

function stripEnvQuotes(raw: string): string {
  const t = raw.trim()
  if (
    (t.startsWith('"') && t.endsWith('"')) ||
    (t.startsWith("'") && t.endsWith("'"))
  ) {
    return t.slice(1, -1).trim()
  }
  return t
}

function normalizeSupabaseProjectUrl(url: string): string {
  const t = stripEnvQuotes(url.trim())
  if (!t) return ''
  if (/^https?:\/\//i.test(t)) return t
  if (/^[a-z0-9][\w.-]*\.supabase\.co\/?$/i.test(t)) {
    return `https://${t.replace(/\/$/, '')}`
  }
  return t
}

function resolvedUrl(): string {
  const raw = (process.env.EXPO_PUBLIC_SUPABASE_URL ?? '').toString()
  return normalizeSupabaseProjectUrl(raw)
}

function resolvedAnonKey(): string {
  const raw = (process.env.EXPO_PUBLIC_SUPABASE_ANON_KEY ?? '').toString()
  return stripEnvQuotes(raw)
}

function isValidHttpUrl(url: string): boolean {
  if (!url) return false
  try {
    const u = new URL(url)
    return u.protocol === 'http:' || u.protocol === 'https:'
  } catch {
    return false
  }
}

export function isSupabaseConfigured(): boolean {
  const url = resolvedUrl()
  const key = resolvedAnonKey()
  return isValidHttpUrl(url) && key.length >= 20
}

function buildSupabaseClient(): SupabaseClient {
  const url = resolvedUrl()
  const key = resolvedAnonKey()
  if (!isValidHttpUrl(url) || !key) {
    throw new Error(
      'Configura EXPO_PUBLIC_SUPABASE_URL y EXPO_PUBLIC_SUPABASE_ANON_KEY en .env'
    )
  }
  return createSupabaseClient(url, key, {
    auth: {
      storage: AsyncStorage,
      persistSession: true,
      autoRefreshToken: true,
      detectSessionInUrl: Platform.OS === 'web',
      storageKey,
      flowType: Platform.OS === 'web' ? 'implicit' : 'pkce',
    },
  })
}

export function getSupabase(): SupabaseClient {
  if (!supabaseSingleton) {
    supabaseSingleton = buildSupabaseClient()
  }
  return supabaseSingleton
}

export function getSupabaseOrNull(): SupabaseClient | null {
  if (!isSupabaseConfigured()) return null
  return getSupabase()
}

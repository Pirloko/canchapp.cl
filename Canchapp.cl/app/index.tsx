import { Redirect } from 'expo-router'
import { ActivityIndicator, StyleSheet, Text, View } from 'react-native'

import { Logo } from '@/components/ui/Logo'
import { useAuth } from '@/lib/auth/provider'
import { isSupabaseConfigured } from '@/lib/supabase/client'
import { colors, spacing } from '@/lib/theme'

export default function IndexScreen() {
  const { loading, route } = useAuth()

  if (!isSupabaseConfigured()) {
    return (
      <View style={styles.center}>
        <Logo variant="light" size="lg" withWordmark style={styles.logo} />
        <Text style={styles.msg}>
          Configura EXPO_PUBLIC_SUPABASE_URL y EXPO_PUBLIC_SUPABASE_ANON_KEY en
          .env
        </Text>
      </View>
    )
  }

  if (loading) {
    return (
      <View style={styles.center}>
        <Logo variant="solid" size="lg" style={styles.logo} />
        <ActivityIndicator size="large" color={colors.primary} />
        <Text style={styles.loading}>Cargando…</Text>
      </View>
    )
  }

  if (route === 'login') return <Redirect href="/login" />
  if (route === 'denied') return <Redirect href="/denied" />
  if (route === 'onboarding') return <Redirect href="/onboarding" />
  return <Redirect href="/(tabs)/reservas" />
}

const styles = StyleSheet.create({
  center: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    padding: spacing.lg,
    backgroundColor: colors.background,
  },
  logo: {
    marginBottom: spacing.md,
  },
  msg: {
    textAlign: 'center',
    color: colors.textMuted,
    lineHeight: 22,
  },
  loading: {
    marginTop: spacing.md,
    color: colors.textMuted,
  },
})

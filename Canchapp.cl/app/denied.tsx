import { Ionicons } from '@expo/vector-icons'
import { StyleSheet, Text, View } from 'react-native'

import { Button } from '@/components/ui/Button'
import { Card } from '@/components/ui/Card'
import { accessDeniedDetail, accessDeniedTitle } from '@/lib/auth/venue-guard'
import { useAuth } from '@/lib/auth/provider'
import { AuthGate } from '@/lib/auth/use-auth-redirect'
import { useIsDesktopLayout } from '@/lib/layout'
import { colors, radii, spacing, typography } from '@/lib/theme'

export default function DeniedScreen() {
  const { user, signOut } = useAuth()
  const desktop = useIsDesktopLayout()

  return (
    <AuthGate expect="denied">
      <View style={styles.container}>
        {desktop ? <View style={styles.ring} pointerEvents="none" /> : null}
        <Card elevated style={styles.card}>
          <View style={styles.iconWrap}>
            <Ionicons name="lock-closed-outline" size={32} color={colors.warning} />
          </View>
          <Text style={styles.title}>{accessDeniedTitle()}</Text>
          <Text style={styles.msg}>{accessDeniedDetail(user?.accountType)}</Text>
          <Button
            label="Cerrar sesión"
            variant="secondary"
            onPress={() => void signOut()}
          />
        </Card>
      </View>
    </AuthGate>
  )
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    padding: spacing.lg,
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: colors.background,
  },
  ring: {
    position: 'absolute',
    width: 420,
    height: 420,
    borderRadius: 210,
    borderWidth: 1,
    borderColor: colors.border,
  },
  card: {
    alignItems: 'center',
    marginBottom: 0,
    width: '100%',
    maxWidth: 420,
  },
  iconWrap: {
    width: 64,
    height: 64,
    borderRadius: radii.full,
    backgroundColor: colors.warningLight,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: spacing.md,
  },
  title: {
    ...typography.h1,
    fontSize: 22,
    color: colors.text,
    marginBottom: spacing.md,
    textAlign: 'center',
  },
  msg: {
    ...typography.body,
    color: colors.textMuted,
    lineHeight: 22,
    marginBottom: spacing.xl,
    textAlign: 'center',
  },
})

import { Ionicons } from '@expo/vector-icons'
import { useRouter } from 'expo-router'
import { useState } from 'react'
import {
  KeyboardAvoidingView,
  Platform,
  StyleSheet,
  Text,
  View,
} from 'react-native'
import { useSafeAreaInsets } from 'react-native-safe-area-context'

import { Button } from '@/components/ui/Button'
import { Card } from '@/components/ui/Card'
import { Field } from '@/components/ui/Field'
import { pathForAuthRoute } from '@/lib/auth/navigation'
import { useAuth } from '@/lib/auth/provider'
import { useAuthRedirect } from '@/lib/auth/use-auth-redirect'
import { colors, layout, radii, spacing, typography } from '@/lib/theme'

export default function LoginScreen() {
  const { signIn } = useAuth()
  const router = useRouter()
  const insets = useSafeAreaInsets()
  useAuthRedirect('login')

  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [error, setError] = useState<string | null>(null)
  const [loading, setLoading] = useState(false)

  const handleLogin = async () => {
    setError(null)
    if (!email.trim() || !password) {
      setError('Ingresa email y contraseña.')
      return
    }
    setLoading(true)
    try {
      const res = await signIn(email, password)
      if (!res.ok) {
        setError(res.error ?? 'No se pudo iniciar sesión.')
        return
      }
      if (res.route) {
        router.replace(pathForAuthRoute(res.route) as never)
      }
    } finally {
      setLoading(false)
    }
  }

  return (
    <KeyboardAvoidingView
      style={styles.flex}
      behavior={Platform.OS === 'ios' ? 'padding' : undefined}
    >
      <View style={[styles.hero, { paddingTop: insets.top + spacing.lg }]}>
        <View style={styles.logoRow}>
          <View style={styles.logoMark}>
            <Ionicons name="football" size={22} color="#FFFFFF" />
          </View>
          <Text style={styles.brand}>Canchapp</Text>
        </View>
        <Text style={styles.tagline}>
          El panel operativo para centros deportivos conectados a Sportmatch.
        </Text>
      </View>

      <View style={styles.formArea}>
        <Card elevated style={styles.formCard}>
          <Text style={styles.formTitle}>Ingresar</Text>
          <Text style={styles.formSub}>
            Solo cuentas de centro deportivo autorizadas.
          </Text>

          <Field
            label="Email"
            value={email}
            onChangeText={setEmail}
            autoCapitalize="none"
            keyboardType="email-address"
            autoComplete="email"
            placeholder="dueño@tucentro.cl"
          />
          <Field
            label="Contraseña"
            value={password}
            onChangeText={setPassword}
            secureTextEntry
            autoComplete="password"
          />

          {error ? (
            <View style={styles.errorBox}>
              <Text style={styles.error}>{error}</Text>
            </View>
          ) : null}

          <Button label="Ingresar" onPress={() => void handleLogin()} loading={loading} />
        </Card>
      </View>
    </KeyboardAvoidingView>
  )
}

const styles = StyleSheet.create({
  flex: { flex: 1, backgroundColor: colors.background },
  hero: {
    backgroundColor: colors.primary,
    paddingHorizontal: spacing.lg,
    paddingBottom: spacing.xxl,
    borderBottomLeftRadius: radii.xl + 8,
    borderBottomRightRadius: radii.xl + 8,
  },
  logoRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm + 4,
    marginBottom: spacing.md,
  },
  logoMark: {
    width: 44,
    height: 44,
    borderRadius: radii.md,
    backgroundColor: 'rgba(255,255,255,0.16)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  brand: {
    ...typography.hero,
    color: '#FFFFFF',
    fontSize: 30,
  },
  tagline: {
    ...typography.body,
    color: 'rgba(255,255,255,0.88)',
    maxWidth: 320,
  },
  formArea: {
    flex: 1,
    marginTop: -spacing.xl,
    paddingHorizontal: spacing.lg,
    maxWidth: layout.maxContentWidth,
    width: '100%',
    alignSelf: 'center',
  },
  formCard: {
    marginBottom: 0,
  },
  formTitle: {
    ...typography.h1,
    fontSize: 22,
    color: colors.text,
    marginBottom: spacing.xs,
  },
  formSub: {
    ...typography.bodySm,
    color: colors.textMuted,
    marginBottom: spacing.lg,
  },
  errorBox: {
    backgroundColor: colors.dangerLight,
    borderRadius: radii.md,
    padding: spacing.md,
    marginBottom: spacing.md,
  },
  error: {
    color: colors.danger,
    fontWeight: '600',
  },
})

import { Ionicons } from '@expo/vector-icons'
import { useRouter } from 'expo-router'
import { useState } from 'react'
import { StyleSheet, Text, View } from 'react-native'

import { Button } from '@/components/ui/Button'
import { Card, CardSubtitle, CardTitle } from '@/components/ui/Card'
import { FeedbackBanner } from '@/components/ui/FeedbackBanner'
import { Field } from '@/components/ui/Field'
import { PitchDivider } from '@/components/ui/PitchDivider'
import { Screen } from '@/components/ui/Screen'
import { pathForAuthRoute } from '@/lib/auth/navigation'
import { useAuth } from '@/lib/auth/provider'
import { AuthGate } from '@/lib/auth/use-auth-redirect'
import { useIsDesktopLayout } from '@/lib/layout'
import { colors, layout, radii, spacing, typography } from '@/lib/theme'

export default function OnboardingScreen() {
  const { completeOnboarding, signOut } = useAuth()
  const desktop = useIsDesktopLayout()
  const router = useRouter()
  const [form, setForm] = useState({
    name: '',
    address: '',
    phone: '',
    city: 'Rancagua',
    mapsUrl: '',
    slotDurationMinutes: '60',
  })
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const submit = async () => {
    setError(null)
    if (!form.name.trim() || !form.address.trim() || !form.phone.trim()) {
      setError('Completa nombre, dirección y teléfono.')
      return
    }
    setLoading(true)
    try {
      const res = await completeOnboarding({
        name: form.name.trim(),
        address: form.address.trim(),
        phone: form.phone.trim(),
        city: form.city.trim() || 'Rancagua',
        mapsUrl: form.mapsUrl.trim() || null,
        slotDurationMinutes: Math.min(
          180,
          Math.max(15, Math.round(Number(form.slotDurationMinutes)) || 60)
        ),
      })
      if (!res.ok) setError(res.error ?? 'No se pudo crear el centro.')
      else router.replace(pathForAuthRoute('app') as never)
    } finally {
      setLoading(false)
    }
  }

  const intro = (
    <View style={desktop ? styles.introDesktop : styles.hero}>
      <View style={styles.iconWrap}>
        <Ionicons name="business-outline" size={28} color={colors.primary} />
      </View>
      <Text style={[styles.title, desktop && styles.titleDesktop]}>
        Alta de centro
      </Text>
      <Text style={[styles.lead, desktop && styles.leadDesktop]}>
        Completa los datos de tu recinto para empezar a recibir reservas.
      </Text>
      {desktop ? (
        <>
          <View style={styles.introDivider}>
            <PitchDivider />
          </View>
          <Text style={styles.introFootnote}>
            Estos datos aparecen en tu ficha pública de Sportmatch y pueden
            editarse después desde Perfil.
          </Text>
        </>
      ) : null}
    </View>
  )

  const formCard = (
    <Card elevated style={desktop ? styles.formCardDesktop : undefined}>
      <CardTitle>Datos del recinto</CardTitle>
      <CardSubtitle>
        Esta información aparece en tu ficha pública de Sportmatch.
      </CardSubtitle>

      {error ? (
        <FeedbackBanner message={error} type="error" />
      ) : null}

      <Field
        label="Nombre del centro"
        value={form.name}
        onChangeText={(name) => setForm((f) => ({ ...f, name }))}
      />
      <Field
        label="Dirección"
        value={form.address}
        onChangeText={(address) => setForm((f) => ({ ...f, address }))}
      />
      <Field
        label="Teléfono (+569…)"
        value={form.phone}
        onChangeText={(phone) => setForm((f) => ({ ...f, phone }))}
        keyboardType="phone-pad"
      />
      <Field
        label="Ciudad"
        value={form.city}
        onChangeText={(city) => setForm((f) => ({ ...f, city }))}
      />
      <Field
        label="Google Maps URL (opcional)"
        value={form.mapsUrl}
        onChangeText={(mapsUrl) => setForm((f) => ({ ...f, mapsUrl }))}
        autoCapitalize="none"
      />
      <Field
        label="Duración de tramo (minutos)"
        value={form.slotDurationMinutes}
        onChangeText={(slotDurationMinutes) =>
          setForm((f) => ({ ...f, slotDurationMinutes }))
        }
        keyboardType="number-pad"
      />
      <Button label="Crear centro" onPress={() => void submit()} loading={loading} />
      <Button
        label="Cerrar sesión"
        variant="secondary"
        onPress={() => void signOut()}
        style={{ marginTop: spacing.sm }}
      />
    </Card>
  )

  return (
    <AuthGate expect="onboarding">
      <Screen>
        {desktop ? (
          <View style={styles.splitDesktop}>
            {intro}
            <View style={styles.formColDesktop}>{formCard}</View>
          </View>
        ) : (
          <>
            {intro}
            {formCard}
          </>
        )}
      </Screen>
    </AuthGate>
  )
}

const styles = StyleSheet.create({
  hero: {
    alignItems: 'center',
    marginBottom: spacing.lg,
    paddingTop: spacing.md,
  },
  iconWrap: {
    width: 56,
    height: 56,
    borderRadius: radii.lg,
    backgroundColor: colors.primaryLight,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: spacing.md,
  },
  title: {
    ...typography.h1,
    color: colors.text,
    marginBottom: spacing.xs,
  },
  titleDesktop: {
    fontSize: 28,
  },
  lead: {
    ...typography.body,
    color: colors.textMuted,
    textAlign: 'center',
    lineHeight: 22,
    maxWidth: 320,
  },
  leadDesktop: {
    textAlign: 'left',
    maxWidth: 300,
  },
  splitDesktop: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    justifyContent: 'center',
    gap: spacing.xxl,
    maxWidth: 880,
    alignSelf: 'center',
    width: '100%',
    paddingTop: spacing.xl,
  },
  introDesktop: {
    alignItems: 'flex-start',
    width: 300,
    paddingTop: spacing.md,
  },
  introDivider: {
    width: '100%',
    marginTop: spacing.xl,
    marginBottom: spacing.lg,
  },
  introFootnote: {
    ...typography.bodySm,
    color: colors.textMuted,
    lineHeight: 20,
  },
  formColDesktop: {
    width: '100%',
    maxWidth: layout.maxContentWidthNarrow,
  },
  formCardDesktop: {
    marginBottom: 0,
  },
})

import { Ionicons } from '@expo/vector-icons'
import { useRouter } from 'expo-router'
import { useState } from 'react'
import { StyleSheet, Text, View } from 'react-native'

import { Button } from '@/components/ui/Button'
import { Card, CardSubtitle, CardTitle } from '@/components/ui/Card'
import { FeedbackBanner } from '@/components/ui/FeedbackBanner'
import { Field } from '@/components/ui/Field'
import { Screen } from '@/components/ui/Screen'
import { pathForAuthRoute } from '@/lib/auth/navigation'
import { useAuth } from '@/lib/auth/provider'
import { AuthGate } from '@/lib/auth/use-auth-redirect'
import { colors, radii, spacing, typography } from '@/lib/theme'

export default function OnboardingScreen() {
  const { completeOnboarding, signOut } = useAuth()
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

  return (
    <AuthGate expect="onboarding">
      <Screen>
        <View style={styles.hero}>
          <View style={styles.iconWrap}>
            <Ionicons name="business-outline" size={28} color={colors.primary} />
          </View>
          <Text style={styles.title}>Alta de centro</Text>
          <Text style={styles.lead}>
            Completa los datos de tu recinto para empezar a recibir reservas.
          </Text>
        </View>

        <Card elevated>
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
  lead: {
    ...typography.body,
    color: colors.textMuted,
    textAlign: 'center',
    lineHeight: 22,
    maxWidth: 320,
  },
})

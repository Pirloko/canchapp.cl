import * as Clipboard from 'expo-clipboard'
import { useEffect, useState } from 'react'
import { StyleSheet, Text, View } from 'react-native'

import { Button } from '@/components/ui/Button'
import { Card, CardSubtitle, CardTitle } from '@/components/ui/Card'
import { FeedbackBanner } from '@/components/ui/FeedbackBanner'
import { Field } from '@/components/ui/Field'
import { PitchDivider } from '@/components/ui/PitchDivider'
import { Screen } from '@/components/ui/Screen'
import { useAuth } from '@/lib/auth/provider'
import { useIsDesktopLayout } from '@/lib/layout'
import { updateSportsVenueNameAndPhone } from '@/lib/supabase/venue-owner-mutations'
import { getSupabase } from '@/lib/supabase/client'
import { colors, spacing, typography } from '@/lib/theme'

const SITE_URL =
  process.env.EXPO_PUBLIC_SITE_URL?.replace(/\/$/, '') || 'https://canchapp.cl'

export default function PerfilScreen() {
  const { venue, user, signOut, updatePassword, refreshVenue } = useAuth()
  const desktop = useIsDesktopLayout()
  const [name, setName] = useState('')
  const [phone, setPhone] = useState('')
  const [currentPassword, setCurrentPassword] = useState('')
  const [newPassword, setNewPassword] = useState('')
  const [saving, setSaving] = useState(false)
  const [feedback, setFeedback] = useState<{
    type: 'success' | 'error'
    message: string
  } | null>(null)

  useEffect(() => {
    if (venue) {
      setName(venue.name)
      setPhone(venue.phone)
    }
  }, [venue])

  const showFeedback = (type: 'success' | 'error', message: string) => {
    setFeedback({ type, message })
    setTimeout(() => setFeedback(null), 4000)
  }

  const saveProfile = async () => {
    if (!venue) return
    setSaving(true)
    try {
      const { error } = await updateSportsVenueNameAndPhone(
        getSupabase(),
        venue.id,
        name.trim(),
        phone.trim()
      )
      if (error) showFeedback('error', error.message)
      else {
        showFeedback('success', 'Perfil actualizado.')
        await refreshVenue()
      }
    } finally {
      setSaving(false)
    }
  }

  const changePassword = async () => {
    if (!currentPassword || !newPassword) {
      showFeedback('error', 'Completa ambas contraseñas.')
      return
    }
    if (newPassword.length < 6) {
      showFeedback('error', 'La nueva contraseña debe tener al menos 6 caracteres.')
      return
    }
    const res = await updatePassword(currentPassword, newPassword)
    if (!res.ok) showFeedback('error', res.error ?? 'No se pudo actualizar.')
    else {
      showFeedback('success', 'Contraseña actualizada.')
      setCurrentPassword('')
      setNewPassword('')
    }
  }

  const copyPublicLink = async () => {
    if (!venue) return
    const sportmatch =
      process.env.EXPO_PUBLIC_SPORTMATCH_URL?.replace(/\/$/, '') ||
      'https://www.sportmatch.cl'
    const url = `${sportmatch}/centro/${venue.id}`
    await Clipboard.setStringAsync(url)
    showFeedback('success', 'Link de ficha pública copiado.')
  }

  if (!venue || !user) return null

  const cuentaCard = (
    <Card elevated>
      <CardTitle>Cuenta</CardTitle>
      <Text style={styles.line}>{user.email}</Text>
    </Card>
  )

  const centroCard = (
    <Card elevated>
      <CardTitle>Centro deportivo</CardTitle>
      <Field label="Nombre" value={name} onChangeText={setName} />
      <Field
        label="Teléfono contacto"
        value={phone}
        onChangeText={setPhone}
        keyboardType="phone-pad"
      />
      <Button label="Guardar" onPress={() => void saveProfile()} loading={saving} />
    </Card>
  )

  const fichaCard = (
    <Card elevated>
      <CardTitle>Ficha pública</CardTitle>
      <CardSubtitle>
        Los jugadores ven tu centro en Sportmatch. Comparte el link en redes o
        cartelería.
      </CardSubtitle>
      <Button
        label="Copiar link público"
        variant="secondary"
        onPress={() => void copyPublicLink()}
        style={{ marginTop: spacing.sm }}
      />
    </Card>
  )

  const passwordCard = (
    <Card elevated>
      <CardTitle>Cambiar contraseña</CardTitle>
      <Field
        label="Contraseña actual"
        value={currentPassword}
        onChangeText={setCurrentPassword}
        secureTextEntry
      />
      <Field
        label="Nueva contraseña"
        value={newPassword}
        onChangeText={setNewPassword}
        secureTextEntry
      />
      <Button label="Actualizar contraseña" onPress={() => void changePassword()} />
    </Card>
  )

  return (
    <Screen>
      {feedback ? (
        <FeedbackBanner message={feedback.message} type={feedback.type} />
      ) : null}

      {desktop ? (
        <View style={styles.columns}>
          <View style={styles.col}>
            {cuentaCard}
            {centroCard}
          </View>
          <View style={styles.col}>
            {fichaCard}
            {passwordCard}
          </View>
        </View>
      ) : (
        <>
          {cuentaCard}
          {centroCard}
          {fichaCard}
          {passwordCard}
        </>
      )}

      <View style={styles.signOutDivider}>
        <PitchDivider />
      </View>
      <View style={[desktop && styles.signOutRowDesktop]}>
        <Button
          label="Cerrar sesión"
          variant="danger"
          onPress={() => void signOut()}
          fullWidth={!desktop}
          style={desktop ? styles.signOutBtnDesktop : undefined}
        />
      </View>
      <Text style={styles.footer}>Canchapp · {SITE_URL}</Text>
    </Screen>
  )
}

const styles = StyleSheet.create({
  line: { ...typography.body, color: colors.text },
  columns: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: spacing.lg,
  },
  col: {
    flex: 1,
    minWidth: 0,
  },
  signOutDivider: { marginTop: spacing.sm, marginBottom: spacing.lg },
  signOutRowDesktop: {
    alignItems: 'flex-end',
  },
  signOutBtnDesktop: {
    minWidth: 200,
  },
  footer: {
    ...typography.scoreSm,
    textAlign: 'center',
    color: colors.textMuted,
    marginTop: spacing.lg,
  },
})

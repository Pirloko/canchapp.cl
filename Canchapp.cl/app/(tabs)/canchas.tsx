import { useCallback, useEffect, useState } from 'react'
import { ActivityIndicator, StyleSheet, Text, View } from 'react-native'
import Animated, { FadeInDown } from 'react-native-reanimated'

import { Button } from '@/components/ui/Button'
import { Card, CardTitle } from '@/components/ui/Card'
import { ConfirmModal } from '@/components/ui/ConfirmModal'
import { EmptyState } from '@/components/ui/EmptyState'
import { FeedbackBanner } from '@/components/ui/FeedbackBanner'
import { Field } from '@/components/ui/Field'
import { Screen } from '@/components/ui/Screen'
import { useAuth } from '@/lib/auth/provider'
import { useIsDesktopLayout } from '@/lib/layout'
import {
  deleteVenueCourtById,
  insertVenueCourtRow,
  updateVenueCourtPrice,
} from '@/lib/supabase/venue-owner-mutations'
import { getSupabase } from '@/lib/supabase/client'
import { fetchVenueCourts } from '@/lib/supabase/venue-queries'
import { colors, radii, spacing, typography } from '@/lib/theme'
import type { VenueCourt } from '@/lib/types'

/** Mini marca de cancha — línea central y círculo, la misma firma del panel a escala de icono. */
function CourtGlyph() {
  return (
    <View style={styles.glyph}>
      <View style={styles.glyphLine} />
      <View style={styles.glyphRing} />
    </View>
  )
}

export default function CanchasScreen() {
  const { venue } = useAuth()
  const desktop = useIsDesktopLayout()
  const [courts, setCourts] = useState<VenueCourt[]>([])
  const [newName, setNewName] = useState('')
  const [loading, setLoading] = useState(true)
  const [priceEdits, setPriceEdits] = useState<Record<string, string>>({})
  const [feedback, setFeedback] = useState<{
    type: 'success' | 'error'
    message: string
  } | null>(null)
  const [deleteTarget, setDeleteTarget] = useState<{
    id: string
    name: string
  } | null>(null)
  const [deleting, setDeleting] = useState(false)

  const showFeedback = (type: 'success' | 'error', message: string) => {
    setFeedback({ type, message })
    setTimeout(() => setFeedback(null), 4000)
  }

  const load = useCallback(async () => {
    if (!venue) return
    const rows = await fetchVenueCourts(getSupabase(), venue.id)
    setCourts(rows)
    const edits: Record<string, string> = {}
    for (const c of rows) {
      edits[c.id] =
        c.pricePerHour != null && c.pricePerHour > 0
          ? String(c.pricePerHour)
          : ''
    }
    setPriceEdits(edits)
  }, [venue])

  useEffect(() => {
    setLoading(true)
    void load().finally(() => setLoading(false))
  }, [load])

  const addCourt = async () => {
    if (!venue || !newName.trim()) {
      showFeedback('error', 'Escribe un nombre para la cancha.')
      return
    }
    const { error } = await insertVenueCourtRow(
      getSupabase(),
      venue.id,
      newName.trim(),
      courts.length
    )
    if (error) showFeedback('error', error.message)
    else {
      setNewName('')
      showFeedback('success', 'Cancha agregada.')
      await load()
    }
  }

  const savePrice = async (courtId: string) => {
    if (!venue) return
    const raw = priceEdits[courtId]?.trim()
    const price = raw ? Math.max(0, Math.round(Number(raw))) : null
    if (raw && Number.isNaN(Number(raw))) {
      showFeedback('error', 'Precio inválido.')
      return
    }
    const { error } = await updateVenueCourtPrice(
      getSupabase(),
      courtId,
      venue.id,
      price
    )
    if (error) showFeedback('error', error.message)
    else showFeedback('success', 'Precio actualizado.')
  }

  const confirmDelete = async () => {
    if (!deleteTarget) return
    setDeleting(true)
    try {
      const { error } = await deleteVenueCourtById(
        getSupabase(),
        deleteTarget.id
      )
      if (error) showFeedback('error', error.message)
      else {
        setDeleteTarget(null)
        showFeedback('success', 'Cancha eliminada.')
        await load()
      }
    } finally {
      setDeleting(false)
    }
  }

  if (!venue) return null

  const newCourtForm = desktop ? (
    <View style={styles.newCourtBarInner}>
      <View style={styles.newCourtField}>
        <Field
          label="Nueva cancha"
          value={newName}
          onChangeText={setNewName}
          placeholder="Ej. Cancha 1"
        />
      </View>
      <Button
        label="Agregar"
        size="sm"
        fullWidth={false}
        onPress={() => void addCourt()}
        style={styles.newCourtBtn}
      />
    </View>
  ) : (
    <Card elevated>
      <CardTitle>Nueva cancha</CardTitle>
      <Field
        label="Nombre"
        value={newName}
        onChangeText={setNewName}
        placeholder="Ej. Cancha 1"
      />
      <Button label="Agregar cancha" onPress={() => void addCourt()} />
    </Card>
  )

  const courtCards = courts.map((c, idx) => (
    <Animated.View
      key={c.id}
      entering={FadeInDown.duration(300).delay(Math.min(idx, 8) * 50)}
      style={desktop && styles.courtTile}
    >
      <Card elevated compact={desktop} style={desktop ? styles.courtCard : undefined}>
        <View style={styles.cardTop}>
          <CourtGlyph />
          <Text style={styles.name}>{c.name}</Text>
        </View>
        <Field
          label="Precio por hora (CLP)"
          value={priceEdits[c.id] ?? ''}
          onChangeText={(v) =>
            setPriceEdits((prev) => ({ ...prev, [c.id]: v }))
          }
          keyboardType="number-pad"
        />
        <View style={styles.row}>
          <Button
            label="Guardar precio"
            variant="secondary"
            size={desktop ? 'sm' : 'md'}
            onPress={() => void savePrice(c.id)}
            style={styles.half}
          />
          <Button
            label="Eliminar"
            variant="danger"
            size={desktop ? 'sm' : 'md'}
            onPress={() => setDeleteTarget({ id: c.id, name: c.name })}
            style={styles.half}
          />
        </View>
      </Card>
    </Animated.View>
  ))

  return (
    <Screen>
      {desktop ? (
        <View style={styles.newCourtBar}>{newCourtForm}</View>
      ) : (
        newCourtForm
      )}

      {feedback ? (
        <FeedbackBanner message={feedback.message} type={feedback.type} />
      ) : null}

      {loading ? (
        <ActivityIndicator color={colors.primary} style={styles.loader} />
      ) : courts.length === 0 ? (
        <EmptyState
          icon="grid-outline"
          title="Aún no tienes canchas"
          subtitle="Agrega la primera cancha para empezar a recibir reservas."
        />
      ) : desktop ? (
        <View style={styles.courtGrid}>{courtCards}</View>
      ) : (
        courtCards
      )}

      <ConfirmModal
        visible={deleteTarget !== null}
        title="Eliminar cancha"
        message={
          deleteTarget
            ? `¿Eliminar "${deleteTarget.name}"? Esta acción no se puede deshacer.`
            : ''
        }
        confirmLabel="Sí, eliminar"
        cancelLabel="Volver"
        loading={deleting}
        onConfirm={() => void confirmDelete()}
        onCancel={() => setDeleteTarget(null)}
      />
    </Screen>
  )
}

const styles = StyleSheet.create({
  loader: { marginTop: spacing.xl },
  cardTop: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm + 2,
    marginBottom: spacing.md,
  },
  name: {
    ...typography.h2,
    color: colors.text,
  },
  glyph: {
    width: 44,
    height: 30,
    borderWidth: 1.5,
    borderColor: colors.border,
    borderRadius: 4,
    backgroundColor: colors.primaryLight,
    alignItems: 'center',
    justifyContent: 'center',
    overflow: 'hidden',
  },
  glyphLine: {
    position: 'absolute',
    top: 0,
    bottom: 0,
    width: 1.5,
    backgroundColor: colors.border,
  },
  glyphRing: {
    width: 10,
    height: 10,
    borderRadius: 5,
    borderWidth: 1.5,
    borderColor: colors.border,
    backgroundColor: colors.primaryLight,
  },
  row: { flexDirection: 'row', gap: spacing.sm },
  half: { flex: 1 },
  newCourtBar: {
    marginBottom: spacing.lg,
  },
  newCourtBarInner: {
    flexDirection: 'row',
    alignItems: 'flex-end',
    gap: spacing.md,
  },
  newCourtField: {
    width: 280,
  },
  newCourtBtn: {
    marginBottom: spacing.md,
  },
  courtGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: spacing.md,
  },
  courtTile: {
    width: '31.5%',
    minWidth: 260,
  },
  courtCard: {
    borderRadius: radii.lg,
  },
})

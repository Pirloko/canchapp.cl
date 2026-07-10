import * as Linking from 'expo-linking'
import { useCallback, useEffect, useMemo, useState } from 'react'
import {
  ActivityIndicator,
  Modal,
  Pressable,
  RefreshControl,
  StyleSheet,
  Text,
  View,
} from 'react-native'

import { Button } from '@/components/ui/Button'
import { Card, CardTitle } from '@/components/ui/Card'
import { ConfirmModal } from '@/components/ui/ConfirmModal'
import { DateNavigator } from '@/components/ui/DateNavigator'
import { EmptyState } from '@/components/ui/EmptyState'
import { FeedbackBanner } from '@/components/ui/FeedbackBanner'
import { Field } from '@/components/ui/Field'
import { Screen } from '@/components/ui/Screen'
import { StatusBadge } from '@/components/ui/StatusBadge'
import { useAuth } from '@/lib/auth/provider'
import { useVenueReservationsRealtime } from '@/lib/hooks/use-venue-reservations-realtime'
import { fetchMatchAndOrganizerMapsForVenueBookings } from '@/lib/supabase/venue-dashboard-queries'
import { getSupabase } from '@/lib/supabase/client'
import {
  cancelVenueReservationAsVenueOwner,
  confirmVenueReservationAsVenueOwner,
  insertVenueReservationRow,
} from '@/lib/supabase/venue-reservation-mutations'
import {
  fetchVenueCourts,
  fetchVenueReservationsRange,
} from '@/lib/supabase/venue-queries'
import { whatsappUrlForPhone } from '@/lib/venue-phone'
import {
  formatDateLine,
  formatTimeRange,
  toDateInputValue,
} from '@/lib/venue-slots'
import { colors, radii, spacing, typography } from '@/lib/theme'
import type { VenueCourt, VenueReservationRow } from '@/lib/types'

export default function ReservasScreen() {
  const { venue, user } = useAuth()
  const [dayStr, setDayStr] = useState(() => toDateInputValue(new Date()))
  const [courts, setCourts] = useState<VenueCourt[]>([])
  const [reservations, setReservations] = useState<VenueReservationRow[]>([])
  const [loading, setLoading] = useState(true)
  const [refreshing, setRefreshing] = useState(false)
  const [cancelModal, setCancelModal] = useState<string | null>(null)
  const [confirmModalId, setConfirmModalId] = useState<string | null>(null)
  const [confirming, setConfirming] = useState(false)
  const [cancelling, setCancelling] = useState(false)
  const [feedback, setFeedback] = useState<{
    type: 'success' | 'error' | 'info'
    message: string
  } | null>(null)
  const [cancelReason, setCancelReason] = useState('No se recibió el pago a tiempo')
  const [manualOpen, setManualOpen] = useState(false)
  const [manualSaving, setManualSaving] = useState(false)
  const [manualForm, setManualForm] = useState({
    courtId: '',
    time: '18:00',
    durationMinutes: '60',
    clientName: '',
    clientPhone: '',
    note: '',
    status: 'pending' as 'pending' | 'confirmed',
  })
  const [organizerById, setOrganizerById] = useState<
    Map<string, { name: string; whatsappPhone: string | null }>
  >(new Map())
  const [matchById, setMatchById] = useState<
    Map<string, { title: string; creatorId: string }>
  >(new Map())

  const load = useCallback(async () => {
    if (!venue) return
    const supabase = getSupabase()
    const courtRows = await fetchVenueCourts(supabase, venue.id)
    setCourts(courtRows)
    const from = new Date(`${dayStr}T00:00:00`)
    const to = new Date(from)
    to.setDate(to.getDate() + 1)
    const rows = await fetchVenueReservationsRange(
      supabase,
      venue.id,
      from.toISOString(),
      to.toISOString()
    )
    setReservations(rows)
    const ctx = await fetchMatchAndOrganizerMapsForVenueBookings(supabase, rows)
    setMatchById(ctx.matchById)
    setOrganizerById(ctx.organizerById)
  }, [venue, dayStr])

  useEffect(() => {
    setLoading(true)
    void load().finally(() => setLoading(false))
  }, [load])

  useVenueReservationsRealtime(venue?.id, () => {
    void load()
  })

  const courtNameById = useMemo(() => {
    const m = new Map<string, string>()
    for (const c of courts) m.set(c.id, c.name)
    return m
  }, [courts])

  const shiftDay = (delta: number) => {
    const d = new Date(`${dayStr}T12:00:00`)
    d.setDate(d.getDate() + delta)
    setDayStr(toDateInputValue(d))
  }

  const showFeedback = (
    type: 'success' | 'error' | 'info',
    message: string
  ) => {
    setFeedback({ type, message })
    setTimeout(() => setFeedback(null), 4000)
  }

  const submitConfirm = async () => {
    if (!confirmModalId) return
    setConfirming(true)
    try {
      const { error } = await confirmVenueReservationAsVenueOwner(
        getSupabase(),
        confirmModalId
      )
      if (error) {
        showFeedback('error', error.message)
        return
      }
      setConfirmModalId(null)
      showFeedback('success', 'Reserva confirmada.')
      await load()
    } finally {
      setConfirming(false)
    }
  }

  const submitCancel = async () => {
    if (!cancelModal) return
    const reason = cancelReason.trim()
    if (!reason) {
      showFeedback('error', 'Indica un motivo de cancelación.')
      return
    }
    setCancelling(true)
    try {
      const { error } = await cancelVenueReservationAsVenueOwner(
        getSupabase(),
        cancelModal,
        reason
      )
      if (error) {
        showFeedback('error', error.message)
        return
      }
      setCancelModal(null)
      showFeedback('success', 'Reserva cancelada.')
      await load()
    } finally {
      setCancelling(false)
    }
  }

  const contactWhatsApp = (r: VenueReservationRow) => {
    const match = r.matchOpportunityId
      ? matchById.get(r.matchOpportunityId)
      : null
    const contactId = match?.creatorId ?? r.bookerUserId
    const contact = contactId ? organizerById.get(contactId) : null
    const phone = contact?.whatsappPhone
    if (!phone) {
      showFeedback(
        'info',
        'El reservante no registró WhatsApp en Sportmatch.'
      )
      return
    }
    const msg = `Hola, te contacto desde ${venue?.name ?? 'el centro'} por tu reserva del ${formatDateLine(r.startsAt)} ${formatTimeRange(r.startsAt, r.endsAt)}.`
    const url = whatsappUrlForPhone(phone, msg)
    if (url) void Linking.openURL(url)
  }

  const createManual = async () => {
    if (!venue || !manualForm.courtId) {
      showFeedback('error', 'Selecciona una cancha.')
      return
    }
    const startsAt = new Date(`${dayStr}T${manualForm.time}:00`)
    const duration = Number(manualForm.durationMinutes) || 60
    const endsAt = new Date(startsAt.getTime() + duration * 60_000)
    if (Number.isNaN(startsAt.getTime())) {
      showFeedback('error', 'Hora inválida.')
      return
    }
    setManualSaving(true)
    try {
      const notes = [
        'manual_reservation',
        manualForm.clientName.trim() ? `cliente:${manualForm.clientName.trim()}` : '',
        manualForm.clientPhone.trim()
          ? `telefono:${manualForm.clientPhone.trim()}`
          : '',
        manualForm.note.trim() ? `nota:${manualForm.note.trim()}` : '',
      ]
        .filter(Boolean)
        .join(' | ')
      const { error } = await insertVenueReservationRow(getSupabase(), {
        court_id: manualForm.courtId,
        starts_at: startsAt.toISOString(),
        ends_at: endsAt.toISOString(),
        status: manualForm.status,
        payment_status: manualForm.status === 'confirmed' ? 'paid' : 'unpaid',
        notes,
        booker_user_id: null,
        match_opportunity_id: null,
        confirmation_source:
          manualForm.status === 'confirmed' ? 'venue_owner' : null,
        confirmed_by_user_id:
          manualForm.status === 'confirmed' ? user?.id ?? null : null,
        confirmation_note:
          manualForm.status === 'confirmed'
            ? 'Reserva manual confirmada'
            : 'Reserva manual pendiente',
      })
      if (error) {
        showFeedback('error', error.message)
        return
      }
      setManualOpen(false)
      showFeedback('success', 'Reserva manual creada.')
      await load()
    } finally {
      setManualSaving(false)
    }
  }

  if (!venue) return null

  const dayLabel = formatDateLine(new Date(`${dayStr}T12:00:00`))

  return (
    <View style={styles.flex}>
      <DateNavigator
        label={dayLabel}
        onPrev={() => shiftDay(-1)}
        onNext={() => shiftDay(1)}
      />

      <Screen
        padded={false}
        contentContainerStyle={styles.container}
        refreshControl={
          <RefreshControl
            refreshing={refreshing}
            onRefresh={() => {
              setRefreshing(true)
              void load().finally(() => setRefreshing(false))
            }}
            tintColor={colors.primary}
          />
        }
      >
        <Button label="Nueva reserva manual" onPress={() => setManualOpen(true)} />

        {feedback ? (
          <FeedbackBanner message={feedback.message} type={feedback.type} />
        ) : null}

        {loading ? (
          <ActivityIndicator color={colors.primary} style={styles.loader} />
        ) : reservations.length === 0 ? (
          <EmptyState
            icon="calendar-outline"
            title="Sin reservas para este día"
            subtitle="Crea una reserva manual o espera solicitudes desde Sportmatch."
          />
        ) : (
          reservations.map((r) => {
            const match = r.matchOpportunityId
              ? matchById.get(r.matchOpportunityId)
              : null
            return (
              <Card key={r.id} elevated>
                <View style={styles.cardHead}>
                  <Text style={styles.time}>
                    {formatTimeRange(r.startsAt, r.endsAt)}
                  </Text>
                  <StatusBadge
                    status={r.status}
                    paid={r.paymentStatus === 'paid'}
                  />
                </View>
                <Text style={styles.court}>
                  {courtNameById.get(r.courtId) ?? 'Cancha'}
                </Text>
                {match ? (
                  <Text style={styles.meta}>Partido: {match.title}</Text>
                ) : null}
                {r.status === 'pending' ? (
                  <View style={styles.actions}>
                    <Button
                      label="Confirmar"
                      onPress={() => setConfirmModalId(r.id)}
                      style={styles.actionBtn}
                    />
                    <View style={styles.actionRow}>
                      <Button
                        label="WhatsApp"
                        variant="secondary"
                        onPress={() => contactWhatsApp(r)}
                        style={styles.half}
                      />
                      <Button
                        label="Cancelar"
                        variant="danger"
                        onPress={() => setCancelModal(r.id)}
                        style={styles.half}
                      />
                    </View>
                  </View>
                ) : null}
              </Card>
            )
          })
        )}
      </Screen>

      <ConfirmModal
        visible={confirmModalId !== null}
        title="Confirmar reserva"
        message="¿Marcar como pagada y confirmada?"
        confirmLabel="Sí, confirmar"
        cancelLabel="Volver"
        loading={confirming}
        onConfirm={() => void submitConfirm()}
        onCancel={() => setConfirmModalId(null)}
      />

      <Modal visible={cancelModal !== null} transparent animationType="fade">
        <View style={styles.modalBg}>
          <View style={styles.modalCard}>
            <CardTitle>Motivo de cancelación</CardTitle>
            <Field
              label="Motivo"
              value={cancelReason}
              onChangeText={setCancelReason}
              multiline
            />
            <Button
              label="Cancelar reserva"
              variant="danger"
              onPress={() => void submitCancel()}
              loading={cancelling}
            />
            <Button
              label="Volver"
              variant="secondary"
              onPress={() => setCancelModal(null)}
              style={{ marginTop: spacing.sm }}
            />
          </View>
        </View>
      </Modal>

      <Modal visible={manualOpen} transparent animationType="slide">
        <View style={styles.modalBg}>
          <Screen padded={false} contentContainerStyle={styles.modalCard}>
            <CardTitle>Reserva manual</CardTitle>
            <Text style={styles.pickLabel}>Cancha</Text>
            {courts.map((c) => (
              <Pressable
                key={c.id}
                onPress={() => setManualForm((f) => ({ ...f, courtId: c.id }))}
                style={[
                  styles.courtPick,
                  manualForm.courtId === c.id && styles.courtPickOn,
                ]}
              >
                <Text
                  style={[
                    styles.courtPickText,
                    manualForm.courtId === c.id && styles.courtPickTextOn,
                  ]}
                >
                  {c.name}
                </Text>
              </Pressable>
            ))}
            <Field
              label="Hora (HH:MM)"
              value={manualForm.time}
              onChangeText={(time) => setManualForm((f) => ({ ...f, time }))}
            />
            <Field
              label="Duración (min)"
              value={manualForm.durationMinutes}
              onChangeText={(durationMinutes) =>
                setManualForm((f) => ({ ...f, durationMinutes }))
              }
              keyboardType="number-pad"
            />
            <Field
              label="Nombre cliente"
              value={manualForm.clientName}
              onChangeText={(clientName) =>
                setManualForm((f) => ({ ...f, clientName }))
              }
            />
            <Field
              label="Teléfono cliente"
              value={manualForm.clientPhone}
              onChangeText={(clientPhone) =>
                setManualForm((f) => ({ ...f, clientPhone }))
              }
            />
            <Field
              label="Nota"
              value={manualForm.note}
              onChangeText={(note) => setManualForm((f) => ({ ...f, note }))}
            />
            <View style={styles.row}>
              <Button
                label="Pendiente"
                variant={manualForm.status === 'pending' ? 'primary' : 'secondary'}
                onPress={() => setManualForm((f) => ({ ...f, status: 'pending' }))}
                style={styles.half}
              />
              <Button
                label="Confirmada"
                variant={manualForm.status === 'confirmed' ? 'primary' : 'secondary'}
                onPress={() => setManualForm((f) => ({ ...f, status: 'confirmed' }))}
                style={styles.half}
              />
            </View>
            <Button
              label="Guardar"
              onPress={() => void createManual()}
              loading={manualSaving}
            />
            <Button
              label="Cerrar"
              variant="secondary"
              onPress={() => setManualOpen(false)}
              style={{ marginTop: spacing.sm }}
            />
          </Screen>
        </View>
      </Modal>
    </View>
  )
}

const styles = StyleSheet.create({
  flex: { flex: 1, backgroundColor: colors.background },
  container: { padding: spacing.lg, paddingBottom: spacing.xl },
  loader: { marginTop: spacing.xl },
  cardHead: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-start',
    marginBottom: spacing.sm,
  },
  time: { ...typography.score, fontSize: 22, color: colors.text },
  court: {
    ...typography.label,
    color: colors.primaryDark,
    marginTop: spacing.xs,
    textTransform: 'uppercase',
  },
  meta: { ...typography.bodySm, color: colors.textMuted, marginTop: spacing.xs },
  actions: { marginTop: spacing.md, gap: spacing.sm },
  actionBtn: { marginTop: spacing.xs },
  actionRow: { flexDirection: 'row', gap: spacing.sm },
  modalBg: {
    flex: 1,
    backgroundColor: colors.overlay,
    justifyContent: 'center',
    padding: spacing.lg,
  },
  modalCard: {
    backgroundColor: colors.surface,
    borderRadius: radii.lg,
    padding: spacing.lg,
    maxHeight: '90%',
  },
  pickLabel: {
    ...typography.label,
    color: colors.textMuted,
    marginBottom: spacing.sm,
  },
  courtPick: {
    padding: spacing.md,
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: radii.md,
    marginBottom: spacing.xs,
  },
  courtPickOn: {
    borderColor: colors.primary,
    backgroundColor: colors.primaryLight,
  },
  courtPickText: { ...typography.body, color: colors.text },
  courtPickTextOn: { fontWeight: '600', color: colors.primaryDark },
  row: { flexDirection: 'row', gap: spacing.sm, marginBottom: spacing.md },
  half: { flex: 1 },
})

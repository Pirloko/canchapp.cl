import { Ionicons } from '@expo/vector-icons'
import * as Linking from 'expo-linking'
import { useCallback, useEffect, useMemo, useState } from 'react'
import {
  ActivityIndicator,
  Modal,
  Pressable,
  RefreshControl,
  ScrollView,
  StyleSheet,
  Text,
  View,
} from 'react-native'
import Animated, { FadeInDown } from 'react-native-reanimated'

import { Button } from '@/components/ui/Button'
import { Card, CardTitle } from '@/components/ui/Card'
import { ConfirmModal } from '@/components/ui/ConfirmModal'
import { DateNavigator } from '@/components/ui/DateNavigator'
import { EmptyState } from '@/components/ui/EmptyState'
import { FeedbackBanner } from '@/components/ui/FeedbackBanner'
import { Field } from '@/components/ui/Field'
import { PitchDivider } from '@/components/ui/PitchDivider'
import { Screen } from '@/components/ui/Screen'
import { StatusBadge } from '@/components/ui/StatusBadge'
import { useAuth } from '@/lib/auth/provider'
import { reservationRevenue } from '@/lib/dashboard/stats'
import { useVenueReservationsRealtime } from '@/lib/hooks/use-venue-reservations-realtime'
import { useIsDesktopLayout } from '@/lib/layout'
import { formatCLP } from '@/lib/money'
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
  formatTime,
  formatTimeRange,
  toDateInputValue,
} from '@/lib/venue-slots'
import {
  colors,
  layout,
  radii,
  spacing,
  statusColors,
  typography,
} from '@/lib/theme'
import type { VenueCourt, VenueReservationRow } from '@/lib/types'

type ManualInfo = {
  isManual: boolean
  clientName: string | null
  clientPhone: string | null
  note: string | null
}

/** Lee los datos de cliente guardados en notes: `manual_reservation | cliente:X | telefono:Y | nota:Z`. */
function parseManualNotes(notes?: string | null): ManualInfo {
  if (!notes || !notes.includes('manual_reservation')) {
    return { isManual: false, clientName: null, clientPhone: null, note: null }
  }
  const parts = notes.split('|').map((s) => s.trim())
  const value = (key: string) => {
    const seg = parts.find((s) => s.startsWith(`${key}:`))
    return seg ? seg.slice(key.length + 1).trim() || null : null
  }
  return {
    isManual: true,
    clientName: value('cliente'),
    clientPhone: value('telefono'),
    note: value('nota'),
  }
}

export default function ReservasScreen() {
  const { venue, user } = useAuth()
  const desktop = useIsDesktopLayout()
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

  const dayRows = useMemo(
    () =>
      [...reservations].sort(
        (a, b) => a.startsAt.getTime() - b.startsAt.getTime()
      ),
    [reservations]
  )

  const daySummary = useMemo(() => {
    const active = dayRows.filter((r) => r.status !== 'cancelled')
    let revenue = 0
    for (const r of active) revenue += reservationRevenue(r, courts) ?? 0
    return {
      pending: active.filter((r) => r.status === 'pending').length,
      confirmed: active.filter((r) => r.status === 'confirmed').length,
      revenue,
    }
  }, [dayRows, courts])

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

  const clientNameFor = (r: VenueReservationRow): string | null => {
    const manual = parseManualNotes(r.notes)
    if (manual.isManual) return manual.clientName
    const match = r.matchOpportunityId
      ? matchById.get(r.matchOpportunityId)
      : null
    const contactId = match?.creatorId ?? r.bookerUserId
    return contactId ? (organizerById.get(contactId)?.name ?? null) : null
  }

  const contactWhatsApp = (r: VenueReservationRow) => {
    const manual = parseManualNotes(r.notes)
    let phone: string | null = null
    if (manual.isManual) {
      phone = manual.clientPhone
    } else {
      const match = r.matchOpportunityId
        ? matchById.get(r.matchOpportunityId)
        : null
      const contactId = match?.creatorId ?? r.bookerUserId
      phone = contactId
        ? (organizerById.get(contactId)?.whatsappPhone ?? null)
        : null
    }
    if (!phone) {
      showFeedback(
        'info',
        manual.isManual
          ? 'Esta reserva manual no tiene teléfono registrado.'
          : 'El reservante no registró WhatsApp en Sportmatch.'
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
      showFeedback('success', 'Reserva creada.')
      await load()
    } finally {
      setManualSaving(false)
    }
  }

  if (!venue) return null

  const todayStr = toDateInputValue(new Date())
  const isToday = dayStr === todayStr
  const dayLabel = formatDateLine(new Date(`${dayStr}T12:00:00`))

  const summaryLine =
    dayRows.length > 0 ? (
      <Text style={styles.summaryText} numberOfLines={1}>
        <Text style={styles.summaryNum}>{daySummary.pending}</Text>
        <Text>
          {daySummary.pending === 1 ? ' pendiente · ' : ' pendientes · '}
        </Text>
        <Text style={styles.summaryNum}>{daySummary.confirmed}</Text>
        <Text>
          {daySummary.confirmed === 1 ? ' confirmada' : ' confirmadas'}
        </Text>
        {daySummary.revenue > 0 ? (
          <Text>
            {' · '}
            <Text style={styles.summaryNum}>
              {formatCLP(daySummary.revenue)}
            </Text>
            {' estimado'}
          </Text>
        ) : null}
      </Text>
    ) : null

  const renderRow = (r: VenueReservationRow, idx: number) => {
    const manual = parseManualNotes(r.notes)
    const name = clientNameFor(r)
    const match = r.matchOpportunityId
      ? matchById.get(r.matchOpportunityId)
      : null
    const revenue = reservationRevenue(r, courts)
    const cancelled = r.status === 'cancelled'
    const dotColor = statusColors(r.status).fg
    const displayName =
      name ?? (manual.isManual ? 'Reserva manual' : 'Reserva Sportmatch')

    const whatsAppBtn = (
      <Pressable
        onPress={() => contactWhatsApp(r)}
        accessibilityRole="button"
        accessibilityLabel="Contactar por WhatsApp"
        style={styles.iconBtn}
      >
        <Ionicons name="logo-whatsapp" size={18} color={colors.success} />
      </Pressable>
    )

    const cancelBtn = (
      <Pressable
        onPress={() => setCancelModal(r.id)}
        accessibilityRole="button"
        accessibilityLabel="Cancelar reserva"
        style={[styles.iconBtn, styles.iconBtnDanger]}
      >
        <Ionicons name="close" size={18} color={colors.danger} />
      </Pressable>
    )

    if (desktop) {
      return (
        <Animated.View
          key={r.id}
          entering={FadeInDown.duration(300).delay(Math.min(idx, 8) * 40)}
          style={[styles.fixtureRow, cancelled && styles.rowCancelled]}
        >
          <View style={styles.timeBlock}>
            <Text style={styles.timeStart}>{formatTime(r.startsAt)}</Text>
            <Text style={styles.timeEnd}>{formatTime(r.endsAt)}</Text>
          </View>
          <View style={styles.rail}>
            <View style={[styles.railDot, { borderColor: dotColor }]} />
          </View>
          <View style={styles.fixtureInfo}>
            <Text style={styles.court}>
              {courtNameById.get(r.courtId) ?? 'Cancha'}
            </Text>
            <Text style={styles.name} numberOfLines={1}>
              {displayName}
              {match ? ` · ${match.title}` : ''}
            </Text>
            {manual.note ? (
              <Text style={styles.note} numberOfLines={1}>
                Nota: {manual.note}
              </Text>
            ) : null}
            {cancelled && r.cancelledReason ? (
              <Text style={styles.note} numberOfLines={1}>
                Motivo: {r.cancelledReason}
              </Text>
            ) : null}
          </View>
          {revenue != null && !cancelled ? (
            <Text style={styles.revenue}>{formatCLP(revenue)}</Text>
          ) : null}
          <View style={styles.badgeCol}>
            <StatusBadge status={r.status} paid={r.paymentStatus === 'paid'} />
          </View>
          {!cancelled ? (
            <View style={styles.rowActions}>
              {whatsAppBtn}
              {r.status === 'pending' ? (
                <>
                  <Button
                    label="Confirmar"
                    size="sm"
                    fullWidth={false}
                    onPress={() => setConfirmModalId(r.id)}
                  />
                  {cancelBtn}
                </>
              ) : null}
            </View>
          ) : null}
        </Animated.View>
      )
    }

    return (
      <Animated.View
        key={r.id}
        entering={FadeInDown.duration(300).delay(Math.min(idx, 8) * 40)}
      >
        <Card style={cancelled ? styles.rowCancelled : undefined}>
          <View style={styles.cardHead}>
            <Text style={styles.time}>
              {formatTimeRange(r.startsAt, r.endsAt)}
            </Text>
            <StatusBadge status={r.status} paid={r.paymentStatus === 'paid'} />
          </View>
          <Text style={styles.court}>
            {courtNameById.get(r.courtId) ?? 'Cancha'}
          </Text>
          <Text style={styles.name} numberOfLines={1}>
            {displayName}
            {match ? ` · ${match.title}` : ''}
          </Text>
          {manual.note ? (
            <Text style={styles.note} numberOfLines={2}>
              Nota: {manual.note}
            </Text>
          ) : null}
          {cancelled && r.cancelledReason ? (
            <Text style={styles.note} numberOfLines={2}>
              Motivo: {r.cancelledReason}
            </Text>
          ) : null}
          {revenue != null && !cancelled ? (
            <Text style={styles.revenueMobile}>{formatCLP(revenue)}</Text>
          ) : null}
          {!cancelled ? (
            <View style={styles.actionRow}>
              {r.status === 'pending' ? (
                <Button
                  label="Confirmar"
                  size="sm"
                  fullWidth={false}
                  onPress={() => setConfirmModalId(r.id)}
                  style={styles.actionGrow}
                />
              ) : null}
              {whatsAppBtn}
              {r.status === 'pending' ? cancelBtn : null}
            </View>
          ) : null}
        </Card>
      </Animated.View>
    )
  }

  return (
    <View style={styles.flex}>
      {desktop ? (
        <View style={styles.toolbarWrap}>
          <View style={styles.toolbar}>
            <View style={styles.toolbarNav}>
              <DateNavigator
                label={dayLabel}
                onPrev={() => shiftDay(-1)}
                onNext={() => shiftDay(1)}
                onToday={isToday ? undefined : () => setDayStr(todayStr)}
                showDivider={false}
              />
            </View>
            <View style={styles.toolbarSummary}>
              {loading ? null : summaryLine}
            </View>
            <Button
              label="Nueva reserva"
              size="sm"
              fullWidth={false}
              onPress={() => setManualOpen(true)}
            />
          </View>
          <View style={styles.toolbarDivider}>
            <PitchDivider />
          </View>
        </View>
      ) : (
        <DateNavigator
          label={dayLabel}
          onPrev={() => shiftDay(-1)}
          onNext={() => shiftDay(1)}
          onToday={isToday ? undefined : () => setDayStr(todayStr)}
        />
      )}

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
        {feedback ? (
          <FeedbackBanner message={feedback.message} type={feedback.type} />
        ) : null}

        {!desktop ? (
          <>
            {!loading && summaryLine ? (
              <View style={styles.summaryRow}>{summaryLine}</View>
            ) : null}
            <Button
              label="Nueva reserva manual"
              onPress={() => setManualOpen(true)}
              style={styles.newBtnMobile}
            />
          </>
        ) : null}

        {loading ? (
          <ActivityIndicator color={colors.primary} style={styles.loader} />
        ) : dayRows.length === 0 ? (
          <EmptyState
            icon="calendar-outline"
            title={isToday ? 'Sin reservas para hoy' : 'Sin reservas para este día'}
            subtitle="Crea una reserva manual o espera solicitudes desde Sportmatch."
          />
        ) : (
          dayRows.map(renderRow)
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

      <Modal visible={manualOpen} transparent animationType={desktop ? 'fade' : 'slide'}>
        <View style={styles.modalBg}>
          <View style={styles.modalCard}>
            <ScrollView showsVerticalScrollIndicator={false}>
            <CardTitle>Reserva manual</CardTitle>
            <Text style={styles.modalSub}>Se creará para el {dayLabel}.</Text>
            <Text style={styles.pickLabel}>Cancha</Text>
            {courts.length === 0 ? (
              <Text style={styles.note}>
                Agrega canchas en la pestaña Canchas para poder reservar.
              </Text>
            ) : (
              <View style={styles.courtPickRow}>
                {courts.map((c) => (
                  <Pressable
                    key={c.id}
                    onPress={() =>
                      setManualForm((f) => ({ ...f, courtId: c.id }))
                    }
                    accessibilityRole="button"
                    accessibilityState={{
                      selected: manualForm.courtId === c.id,
                    }}
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
              </View>
            )}
            <View style={styles.fieldRow}>
              <View style={styles.fieldHalf}>
                <Field
                  label="Hora (HH:MM)"
                  value={manualForm.time}
                  onChangeText={(time) => setManualForm((f) => ({ ...f, time }))}
                />
              </View>
              <View style={styles.fieldHalf}>
                <Field
                  label="Duración (min)"
                  value={manualForm.durationMinutes}
                  onChangeText={(durationMinutes) =>
                    setManualForm((f) => ({ ...f, durationMinutes }))
                  }
                  keyboardType="number-pad"
                />
              </View>
            </View>
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
              hint="Con código de país para contactar por WhatsApp, ej. +56 9…"
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
              label="Guardar reserva"
              onPress={() => void createManual()}
              loading={manualSaving}
            />
            <Button
              label="Cerrar"
              variant="secondary"
              onPress={() => setManualOpen(false)}
              style={{ marginTop: spacing.sm }}
            />
            </ScrollView>
          </View>
        </View>
      </Modal>
    </View>
  )
}

const styles = StyleSheet.create({
  flex: { flex: 1, backgroundColor: colors.background },
  container: { padding: spacing.lg, paddingBottom: spacing.xl },
  loader: { marginTop: spacing.xl },
  toolbarWrap: {
    backgroundColor: colors.surface,
  },
  toolbar: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: spacing.md,
    width: '100%',
    maxWidth: layout.maxContentWidthWide,
    alignSelf: 'center',
    paddingRight: spacing.lg,
  },
  toolbarNav: {
    width: 420,
  },
  toolbarSummary: {
    flex: 1,
    alignItems: 'center',
  },
  toolbarDivider: {
    width: '100%',
    maxWidth: layout.maxContentWidthWide,
    alignSelf: 'center',
    paddingHorizontal: spacing.lg,
    paddingBottom: spacing.sm,
  },
  summaryRow: {
    marginBottom: spacing.md,
    alignItems: 'center',
  },
  summaryText: {
    ...typography.bodySm,
    color: colors.textMuted,
  },
  summaryNum: {
    ...typography.scoreSm,
    color: colors.text,
  },
  newBtnMobile: {
    marginBottom: spacing.md,
  },
  // Fila de programa de partidos (desktop)
  fixtureRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.md,
    backgroundColor: colors.surface,
    borderWidth: 1,
    borderColor: colors.borderLight,
    borderRadius: radii.lg,
    paddingVertical: spacing.md,
    paddingHorizontal: spacing.lg,
    marginBottom: spacing.sm,
  },
  rowCancelled: {
    opacity: 0.55,
  },
  timeBlock: {
    width: 64,
    alignItems: 'flex-end',
  },
  timeStart: {
    ...typography.score,
    fontSize: 20,
    color: colors.text,
  },
  timeEnd: {
    ...typography.scoreSm,
    fontSize: 13,
    color: colors.textMuted,
  },
  rail: {
    alignSelf: 'stretch',
    width: 1,
    backgroundColor: colors.border,
    justifyContent: 'center',
    alignItems: 'center',
  },
  railDot: {
    width: 11,
    height: 11,
    borderRadius: 6,
    borderWidth: 1.5,
    backgroundColor: colors.surface,
  },
  fixtureInfo: {
    flex: 1,
    minWidth: 0,
  },
  revenue: {
    ...typography.scoreSm,
    fontSize: 15,
    color: colors.text,
  },
  badgeCol: {
    width: 148,
  },
  rowActions: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
  },
  // Tarjeta (móvil / tablet)
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
    textTransform: 'uppercase',
  },
  name: {
    ...typography.body,
    color: colors.text,
    marginTop: 2,
  },
  note: {
    ...typography.caption,
    color: colors.textMuted,
    marginTop: 2,
  },
  revenueMobile: {
    ...typography.scoreSm,
    fontSize: 15,
    color: colors.text,
    marginTop: spacing.xs,
  },
  actionRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
    marginTop: spacing.md,
  },
  actionGrow: {
    flexGrow: 1,
  },
  iconBtn: {
    width: 40,
    height: 40,
    borderRadius: radii.md,
    backgroundColor: colors.successLight,
    alignItems: 'center',
    justifyContent: 'center',
  },
  iconBtnDanger: {
    backgroundColor: colors.dangerLight,
  },
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
    width: '100%',
    maxWidth: 520,
    alignSelf: 'center',
  },
  modalSub: {
    ...typography.bodySm,
    color: colors.textMuted,
    marginTop: -spacing.xs,
    marginBottom: spacing.md,
  },
  pickLabel: {
    ...typography.label,
    color: colors.textSecondary,
    marginBottom: spacing.sm,
  },
  courtPickRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: spacing.sm,
    marginBottom: spacing.md,
  },
  courtPick: {
    paddingVertical: spacing.sm,
    paddingHorizontal: spacing.md,
    borderWidth: 1.5,
    borderColor: colors.border,
    borderRadius: radii.full,
  },
  courtPickOn: {
    borderColor: colors.primary,
    backgroundColor: colors.primaryLight,
  },
  courtPickText: { ...typography.body, color: colors.text },
  courtPickTextOn: { fontWeight: '600', color: colors.primaryDark },
  fieldRow: {
    flexDirection: 'row',
    gap: spacing.sm,
  },
  fieldHalf: {
    flex: 1,
  },
  row: { flexDirection: 'row', gap: spacing.sm, marginBottom: spacing.md },
  half: { flex: 1 },
})

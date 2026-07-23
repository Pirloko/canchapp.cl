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
  TextInput,
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
import { dayWindow, reservationRevenue } from '@/lib/dashboard/stats'
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
  fetchVenueWeeklyHours,
} from '@/lib/supabase/venue-queries'
import { sportLabel } from '@/lib/venue-sports'
import {
  formatVenuePhoneChileDisplay,
  whatsappUrlForPhone,
} from '@/lib/venue-phone'
import {
  formatDateLine,
  formatMinutes,
  formatTime,
  formatTimeRange,
  minutesOfDay,
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
import type {
  VenueCourt,
  VenueReservationRow,
  VenueWeeklyHour,
} from '@/lib/types'

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
  const [weeklyHours, setWeeklyHours] = useState<VenueWeeklyHour[]>([])
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
    sportId: '',
    courtId: '',
    slotStart: null as number | null,
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
    const [courtRows, hours] = await Promise.all([
      fetchVenueCourts(supabase, venue.id),
      fetchVenueWeeklyHours(supabase, venue.id),
    ])
    setCourts(courtRows)
    setWeeklyHours(hours)
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

  const sportIds = useMemo(() => {
    const seen = new Set<string>()
    const order: string[] = []
    for (const c of courts) {
      if (!seen.has(c.sportId)) {
        seen.add(c.sportId)
        order.push(c.sportId)
      }
    }
    return order
  }, [courts])

  const courtsForSport = useMemo(
    () =>
      manualForm.sportId
        ? courts.filter((c) => c.sportId === manualForm.sportId)
        : courts,
    [courts, manualForm.sportId]
  )

  const modalDayWindow = useMemo(
    () => dayWindow(weeklyHours, new Date(`${dayStr}T12:00:00`)),
    [weeklyHours, dayStr]
  )

  const slotOptions = useMemo(() => {
    const step = venue?.slotDurationMinutes || 60
    const { open, close } = modalDayWindow
    const slots: number[] = []
    for (let m = open; m + step <= close; m += step) slots.push(m)
    return slots
  }, [modalDayWindow, venue])

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

  const bookedRanges = useMemo(() => {
    if (!manualForm.courtId) return []
    return dayRows
      .filter(
        (r) => r.courtId === manualForm.courtId && r.status !== 'cancelled'
      )
      .map((r) => ({
        start: minutesOfDay(r.startsAt),
        end: minutesOfDay(r.endsAt),
      }))
  }, [dayRows, manualForm.courtId])

  const isSlotBooked = (start: number) => {
    const step = venue?.slotDurationMinutes || 60
    const end = start + step
    return bookedRanges.some((b) => b.start < end && b.end > start)
  }

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

  const openManualModal = () => {
    setManualForm({
      sportId: '',
      courtId: '',
      slotStart: null,
      clientName: '',
      clientPhone: '',
      note: '',
      status: 'pending',
    })
    setManualOpen(true)
  }

  const selectSport = (sportId: string) => {
    setManualForm((f) => ({ ...f, sportId, courtId: '', slotStart: null }))
  }

  const selectCourt = (courtId: string) => {
    setManualForm((f) => ({ ...f, courtId, slotStart: null }))
  }

  const createManual = async () => {
    if (!venue || !manualForm.courtId) {
      showFeedback('error', 'Selecciona una cancha.')
      return
    }
    if (manualForm.slotStart == null) {
      showFeedback('error', 'Selecciona un horario.')
      return
    }
    let clientPhone = ''
    if (manualForm.clientPhone) {
      if (manualForm.clientPhone.length !== 8) {
        showFeedback('error', 'Ingresa los 8 dígitos del celular.')
        return
      }
      clientPhone = formatVenuePhoneChileDisplay(`+569${manualForm.clientPhone}`)
    }
    const startsAt = new Date(`${dayStr}T00:00:00`)
    startsAt.setMinutes(manualForm.slotStart)
    const endsAt = new Date(
      startsAt.getTime() + venue.slotDurationMinutes * 60_000
    )
    setManualSaving(true)
    try {
      const notes = [
        'manual_reservation',
        manualForm.clientName.trim() ? `cliente:${manualForm.clientName.trim()}` : '',
        clientPhone ? `telefono:${clientPhone}` : '',
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
              onPress={openManualModal}
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
              onPress={openManualModal}
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
            <Text style={styles.pickLabel}>1. Deporte</Text>
            {courts.length === 0 ? (
              <Text style={styles.note}>
                Agrega canchas en la pestaña Canchas para poder reservar.
              </Text>
            ) : (
              <View style={styles.courtPickRow}>
                {sportIds.map((sportId) => (
                  <Pressable
                    key={sportId}
                    onPress={() => selectSport(sportId)}
                    accessibilityRole="button"
                    accessibilityState={{
                      selected: manualForm.sportId === sportId,
                    }}
                    style={[
                      styles.courtPick,
                      manualForm.sportId === sportId && styles.courtPickOn,
                    ]}
                  >
                    <Text
                      style={[
                        styles.courtPickText,
                        manualForm.sportId === sportId &&
                          styles.courtPickTextOn,
                      ]}
                    >
                      {sportLabel(sportId)}
                    </Text>
                  </Pressable>
                ))}
              </View>
            )}
            {manualForm.sportId ? (
              <>
                <Text style={styles.pickLabel}>2. Cancha</Text>
                <View style={styles.courtPickRow}>
                  {courtsForSport.map((c) => (
                    <Pressable
                      key={c.id}
                      onPress={() => selectCourt(c.id)}
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
                          manualForm.courtId === c.id &&
                            styles.courtPickTextOn,
                        ]}
                      >
                        {c.name}
                      </Text>
                    </Pressable>
                  ))}
                </View>
              </>
            ) : null}
            {manualForm.courtId ? (
              <>
                <Text style={styles.pickLabel}>
                  3. Horario ({venue.slotDurationMinutes} min · una reserva
                  por tramo)
                </Text>
                {slotOptions.length === 0 ? (
                  <Text style={styles.note}>
                    El centro no tiene horario configurado para este día.
                  </Text>
                ) : (
                  <View style={styles.slotGrid}>
                    {slotOptions.map((start) => {
                      const booked = isSlotBooked(start)
                      const selected = manualForm.slotStart === start
                      return (
                        <Pressable
                          key={start}
                          disabled={booked}
                          onPress={() =>
                            setManualForm((f) => ({ ...f, slotStart: start }))
                          }
                          accessibilityRole="button"
                          accessibilityState={{ selected, disabled: booked }}
                          accessibilityLabel={`${formatMinutes(start)}${booked ? ', no disponible' : ''}`}
                          style={[
                            styles.slotPick,
                            selected && styles.slotPickOn,
                            booked && styles.slotPickDisabled,
                          ]}
                        >
                          <Text
                            style={[
                              styles.slotPickText,
                              selected && styles.slotPickTextOn,
                              booked && styles.slotPickTextDisabled,
                            ]}
                          >
                            {formatMinutes(start)}
                          </Text>
                        </Pressable>
                      )
                    })}
                  </View>
                )}
              </>
            ) : null}
            <Field
              label="Nombre cliente"
              value={manualForm.clientName}
              onChangeText={(clientName) =>
                setManualForm((f) => ({ ...f, clientName }))
              }
            />
            <Text style={styles.pickLabel}>Teléfono cliente</Text>
            <View style={styles.phoneRow}>
              <View style={styles.phonePrefix}>
                <Text style={styles.phonePrefixText}>🇨🇱 +56 9</Text>
              </View>
              <TextInput
                value={manualForm.clientPhone}
                onChangeText={(v) =>
                  setManualForm((f) => ({
                    ...f,
                    clientPhone: v.replace(/\D/g, '').slice(0, 8),
                  }))
                }
                keyboardType="number-pad"
                maxLength={8}
                placeholder="1234 5678"
                placeholderTextColor={colors.textMuted}
                style={styles.phoneInput}
              />
            </View>
            <Text style={styles.phoneHint}>
              8 dígitos del celular, sin el 9 inicial.
            </Text>
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
  slotGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: spacing.sm,
    marginBottom: spacing.md,
  },
  slotPick: {
    minWidth: 64,
    alignItems: 'center',
    paddingVertical: spacing.sm,
    paddingHorizontal: spacing.md,
    borderWidth: 1.5,
    borderColor: colors.border,
    borderRadius: radii.md,
  },
  slotPickOn: {
    borderColor: colors.primary,
    backgroundColor: colors.primaryLight,
  },
  slotPickDisabled: {
    borderColor: colors.borderLight,
    backgroundColor: colors.borderLight,
    opacity: 0.6,
  },
  slotPickText: { ...typography.body, color: colors.text },
  slotPickTextOn: { fontWeight: '600', color: colors.primaryDark },
  slotPickTextDisabled: {
    color: colors.textMuted,
    textDecorationLine: 'line-through',
  },
  phoneRow: {
    flexDirection: 'row',
    gap: spacing.sm,
    marginBottom: spacing.xs + 2,
  },
  phonePrefix: {
    justifyContent: 'center',
    paddingHorizontal: spacing.md,
    borderWidth: 1.5,
    borderColor: colors.border,
    borderRadius: radii.md,
    backgroundColor: colors.borderLight,
  },
  phonePrefixText: {
    ...typography.body,
    color: colors.text,
    fontWeight: '600',
  },
  phoneInput: {
    flex: 1,
    borderWidth: 1.5,
    borderColor: colors.border,
    borderRadius: radii.md,
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.sm + 4,
    fontSize: 16,
    color: colors.text,
    backgroundColor: colors.surface,
    minHeight: 48,
  },
  phoneHint: {
    ...typography.caption,
    color: colors.textMuted,
    marginTop: -spacing.xs,
    marginBottom: spacing.md,
  },
  row: { flexDirection: 'row', gap: spacing.sm, marginBottom: spacing.md },
  half: { flex: 1 },
})

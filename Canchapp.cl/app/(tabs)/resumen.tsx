import { Ionicons } from '@expo/vector-icons'
import * as Linking from 'expo-linking'
import { useRouter } from 'expo-router'
import { useCallback, useEffect, useMemo, useState } from 'react'
import {
  ActivityIndicator,
  Pressable,
  RefreshControl,
  StyleSheet,
  Text,
  View,
} from 'react-native'

import { Button } from '@/components/ui/Button'
import { BusinessReportView } from '@/components/ui/BusinessReportView'
import { AnimatedSection } from '@/components/ui/AnimatedSection'
import { Card, CardSubtitle, CardTitle } from '@/components/ui/Card'
import { ConfirmModal } from '@/components/ui/ConfirmModal'
import { DateNavigator } from '@/components/ui/DateNavigator'
import { FeedbackBanner } from '@/components/ui/FeedbackBanner'
import { FloatingIcon } from '@/components/ui/FloatingIcon'
import { OccupancyBoard } from '@/components/ui/OccupancyBoard'
import {
  OccupancyHeatmap,
  type OccupancyBucket,
} from '@/components/ui/OccupancyHeatmap'
import { PendingCountChip } from '@/components/ui/PendingCountChip'
import { PeriodFilter } from '@/components/ui/PeriodFilter'
import { PitchDivider } from '@/components/ui/PitchDivider'
import { Screen, ScreenHero } from '@/components/ui/Screen'
import { StatusBadge } from '@/components/ui/StatusBadge'
import { WeekPulse, type WeekDayPoint } from '@/components/ui/WeekPulse'
import {
  exportDashboardExcel,
  exportDashboardPdf,
  exportVisualReportPdf,
} from '@/lib/dashboard/export-reports'
import {
  generateBusinessReport,
  type BusinessReportBundle,
} from '@/lib/dashboard/visual-report'
import {
  type DashboardPeriod,
  addDays,
  formatPeriodNavigatorLabel,
  getPeriodRange,
  isoRangeBounds,
  monthWeekBuckets,
  shiftFocusDate,
  startOfDay,
} from '@/lib/dashboard/period'
import {
  computeDashboardStats,
  courtBucketOccupancy,
  dayWindow,
  reservationRevenue,
} from '@/lib/dashboard/stats'
import { useAuth } from '@/lib/auth/provider'
import { useVenueReservationsRealtime } from '@/lib/hooks/use-venue-reservations-realtime'
import { useIsCompactLayout, useIsDesktopLayout } from '@/lib/layout'
import { formatCLP } from '@/lib/money'
import { getSupabase } from '@/lib/supabase/client'
import {
  fetchMatchAndOrganizerMapsForVenueBookings,
  type MatchSnippet,
  type OrganizerSnippet,
} from '@/lib/supabase/venue-dashboard-queries'
import {
  fetchVenueCourts,
  fetchVenueReservationsRange,
  fetchVenueWeeklyHours,
} from '@/lib/supabase/venue-queries'
import { confirmVenueReservationAsVenueOwner } from '@/lib/supabase/venue-reservation-mutations'
import { whatsappUrlForPhone } from '@/lib/venue-phone'
import {
  WEEKDAY_SHORT_ES,
  formatDateLine,
  formatTime,
  formatTimeRange,
  minutesOfDay,
  toDateInputValue,
} from '@/lib/venue-slots'
import { colors, layout, radii, spacing, typography } from '@/lib/theme'
import type {
  VenueCourt,
  VenueReservationRow,
  VenueWeeklyHour,
} from '@/lib/types'
import Animated, { FadeInDown, FadeInRight, ZoomIn } from 'react-native-reanimated'

export default function ResumenScreen() {
  const { venue } = useAuth()
  const router = useRouter()
  const compact = useIsCompactLayout()
  const desktop = useIsDesktopLayout()
  const [loading, setLoading] = useState(true)
  const [refreshing, setRefreshing] = useState(false)
  const [courts, setCourts] = useState<VenueCourt[]>([])
  const [weeklyHours, setWeeklyHours] = useState<VenueWeeklyHour[]>([])
  const [reservations, setReservations] = useState<VenueReservationRow[]>([])
  const [matchById, setMatchById] = useState<Map<string, MatchSnippet>>(
    new Map()
  )
  const [organizerById, setOrganizerById] = useState<
    Map<string, OrganizerSnippet>
  >(new Map())
  const [selectedBlockId, setSelectedBlockId] = useState<string | null>(null)
  const [confirmModalId, setConfirmModalId] = useState<string | null>(null)
  const [confirming, setConfirming] = useState(false)
  const [exporting, setExporting] = useState<'excel' | 'pdf' | null>(null)
  const [reportLoading, setReportLoading] = useState(false)
  const [businessReport, setBusinessReport] =
    useState<BusinessReportBundle | null>(null)
  const [feedback, setFeedback] = useState<{
    type: 'success' | 'error' | 'info'
    message: string
  } | null>(null)
  const [nowMin, setNowMin] = useState(() => minutesOfDay(new Date()))

  const todayKey = toDateInputValue(new Date())
  const [period, setPeriod] = useState<DashboardPeriod>('day')
  const [focusDate, setFocusDate] = useState(() => startOfDay(new Date()))
  const [focusDayKey, setFocusDayKey] = useState(todayKey)

  const periodRange = useMemo(
    () => getPeriodRange(period, focusDate),
    [period, focusDate]
  )

  const load = useCallback(async () => {
    if (!venue) return
    const supabase = getSupabase()
    const range = getPeriodRange(period, focusDate)

    let fetchFrom = range.from
    let fetchTo = range.to
    if (period === 'day') {
      fetchFrom = addDays(startOfDay(focusDate), -6)
      fetchTo = addDays(startOfDay(focusDate), 1)
    }

    const { fromIso, toIso } = isoRangeBounds({
      from: fetchFrom,
      to: fetchTo,
      dayKeys: [],
    })

    const [courtRows, hours, rows] = await Promise.all([
      fetchVenueCourts(supabase, venue.id),
      fetchVenueWeeklyHours(supabase, venue.id),
      fetchVenueReservationsRange(supabase, venue.id, fromIso, toIso),
    ])
    setCourts(courtRows)
    setWeeklyHours(hours)
    setReservations(rows)

    const periodRows = rows.filter((r) => {
      const key = toDateInputValue(r.startsAt)
      return range.dayKeys.includes(key)
    })
    const ctx = await fetchMatchAndOrganizerMapsForVenueBookings(
      supabase,
      periodRows
    )
    setMatchById(ctx.matchById)
    setOrganizerById(ctx.organizerById)
  }, [venue, period, focusDate])

  useEffect(() => {
    setLoading(true)
    void load().finally(() => setLoading(false))
  }, [load])

  useEffect(() => {
    setFocusDayKey(toDateInputValue(focusDate))
    setSelectedBlockId(null)
    setBusinessReport(null)
  }, [period, focusDate])

  useVenueReservationsRealtime(venue?.id, () => {
    void load()
  })

  useEffect(() => {
    const timer = setInterval(() => setNowMin(minutesOfDay(new Date())), 60_000)
    return () => clearInterval(timer)
  }, [])

  const courtNameById = useMemo(() => {
    const m = new Map<string, string>()
    for (const c of courts) m.set(c.id, c.name)
    return m
  }, [courts])

  const periodRows = useMemo(
    () =>
      reservations.filter((r) =>
        periodRange.dayKeys.includes(toDateInputValue(r.startsAt))
      ),
    [reservations, periodRange.dayKeys]
  )

  const focusDayRows = useMemo(
    () =>
      periodRows.filter(
        (r) =>
          toDateInputValue(r.startsAt) === focusDayKey &&
          r.status !== 'cancelled'
      ),
    [periodRows, focusDayKey]
  )

  const pendingRows = useMemo(() => {
    const source =
      period === 'day'
        ? focusDayRows
        : periodRows.filter((r) => r.status !== 'cancelled')
    return source.filter((r) => r.status === 'pending')
  }, [period, focusDayRows, periodRows])

  const boardWindow = useMemo(() => {
    const day = new Date(`${focusDayKey}T12:00:00`)
    return dayWindow(weeklyHours, day)
  }, [weeklyHours, focusDayKey])

  const pizarraBuckets = useMemo<OccupancyBucket[]>(() => {
    if (period === 'week') {
      return periodRange.dayKeys.map((key) => {
        const d = new Date(`${key}T12:00:00`)
        return { key, label: WEEKDAY_SHORT_ES[d.getDay()] }
      })
    }
    if (period === 'month') {
      return monthWeekBuckets(periodRange.dayKeys).map((keys, index) => ({
        key: keys[0],
        label: `S${index + 1}`,
      }))
    }
    return []
  }, [period, periodRange.dayKeys])

  const pizarraBucketDayKeys = useMemo(() => {
    if (period === 'month') return monthWeekBuckets(periodRange.dayKeys)
    return periodRange.dayKeys.map((key) => [key])
  }, [period, periodRange.dayKeys])

  const pizarraOccupancyFor = useMemo(() => {
    return (courtId: string, bucketKey: string) => {
      const idx = pizarraBuckets.findIndex((b) => b.key === bucketKey)
      const dayKeys = idx >= 0 ? pizarraBucketDayKeys[idx] : []
      return courtBucketOccupancy(periodRows, courtId, weeklyHours, dayKeys)
    }
  }, [pizarraBuckets, pizarraBucketDayKeys, periodRows, weeklyHours])

  const stats = useMemo(
    () =>
      computeDashboardStats(
        periodRows,
        courts,
        weeklyHours,
        periodRange.dayKeys
      ),
    [periodRows, courts, weeklyHours, periodRange.dayKeys]
  )

  const nextReservation = useMemo(() => {
    if (focusDayKey !== todayKey) {
      return (
        focusDayRows.find((r) => r.startsAt.getTime() > Date.now()) ?? null
      )
    }
    const now = Date.now()
    return focusDayRows.find((r) => r.startsAt.getTime() > now) ?? null
  }, [focusDayRows, focusDayKey, todayKey])

  const pulseDays = useMemo<WeekDayPoint[]>(() => {
    if (period === 'month') {
      const buckets = monthWeekBuckets(periodRange.dayKeys)
      return buckets.map((keys, index) => {
        const rows = periodRows.filter(
          (r) =>
            keys.includes(toDateInputValue(r.startsAt)) &&
            r.status !== 'cancelled'
        )
        let revenue = 0
        for (const r of rows) revenue += reservationRevenue(r, courts) ?? 0
        return {
          key: keys[0],
          label: `S${index + 1}`,
          count: rows.length,
          revenue,
          isToday: keys.includes(todayKey),
        }
      })
    }

    const keys =
      period === 'day'
        ? Array.from({ length: 7 }, (_, i) =>
            toDateInputValue(addDays(focusDate, i - 6))
          )
        : periodRange.dayKeys

    return keys.map((key) => {
      const d = new Date(`${key}T12:00:00`)
      const rows = reservations.filter(
        (r) =>
          toDateInputValue(r.startsAt) === key && r.status !== 'cancelled'
      )
      let revenue = 0
      for (const r of rows) revenue += reservationRevenue(r, courts) ?? 0
      return {
        key,
        label: WEEKDAY_SHORT_ES[d.getDay()],
        count: rows.length,
        revenue,
        isToday: key === todayKey,
      }
    })
  }, [
    period,
    periodRange.dayKeys,
    periodRows,
    reservations,
    courts,
    focusDate,
    todayKey,
  ])

  const selectedDay = pulseDays.find((d) => d.key === focusDayKey) ?? null

  const selectedBlock = useMemo(
    () => focusDayRows.find((r) => r.id === selectedBlockId) ?? null,
    [focusDayRows, selectedBlockId]
  )

  const exportContext = useMemo(
    () =>
      venue
        ? {
            venue,
            courts,
            reservations: periodRows,
            period,
            focusDate,
            focusDayKey,
            weeklyHours,
            stats,
            courtNameById,
          }
        : null,
    [
      venue,
      courts,
      periodRows,
      period,
      focusDate,
      focusDayKey,
      weeklyHours,
      stats,
      courtNameById,
    ]
  )

  const periodScopeLabel =
    period === 'day' ? 'del día' : period === 'week' ? 'de la semana' : 'del mes'

  const showFeedback = (
    type: 'success' | 'error' | 'info',
    message: string
  ) => {
    setFeedback({ type, message })
    setTimeout(() => setFeedback(null), 4000)
  }

  const contactName = (r: VenueReservationRow): string | null => {
    const match = r.matchOpportunityId
      ? matchById.get(r.matchOpportunityId)
      : null
    const contactId = match?.creatorId ?? r.bookerUserId
    return contactId ? (organizerById.get(contactId)?.name ?? null) : null
  }

  const contactWhatsApp = (r: VenueReservationRow) => {
    const match = r.matchOpportunityId
      ? matchById.get(r.matchOpportunityId)
      : null
    const contactId = match?.creatorId ?? r.bookerUserId
    const contact = contactId ? organizerById.get(contactId) : null
    const phone = contact?.whatsappPhone
    if (!phone) {
      showFeedback('info', 'El reservante no registró WhatsApp en Sportmatch.')
      return
    }
    const msg = `Hola, te contacto desde ${venue?.name ?? 'el centro'} por tu reserva del ${formatDateLine(r.startsAt)} ${formatTimeRange(r.startsAt, r.endsAt)}.`
    const url = whatsappUrlForPhone(phone, msg)
    if (url) void Linking.openURL(url)
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

  const handleExportExcel = async () => {
    if (!exportContext) return
    setExporting('excel')
    try {
      showFeedback('info', 'Generando Excel con gráficos e IA…')
      await exportDashboardExcel(exportContext)
      showFeedback('success', 'Excel generado con análisis visual.')
    } catch {
      showFeedback('error', 'No se pudo exportar el Excel.')
    } finally {
      setExporting(null)
    }
  }

  const handleExportPdf = async () => {
    if (!exportContext) return
    setExporting('pdf')
    try {
      await exportDashboardPdf(exportContext)
      showFeedback('success', 'PDF generado.')
    } catch {
      showFeedback('error', 'No se pudo exportar el PDF.')
    } finally {
      setExporting(null)
    }
  }

  const handleBusinessReport = async () => {
    if (!venue || !exportContext) return
    setReportLoading(true)
    setBusinessReport(null)
    try {
      const result = await generateBusinessReport({
        venue,
        courts,
        reservations: periodRows,
        period,
        focusDate,
        stats,
        weeklyHours,
        focusDayKey,
      })
      if (!result.ok) {
        showFeedback('error', result.error)
        return
      }
      setBusinessReport(result.report)
    } finally {
      setReportLoading(false)
    }
  }

  const handleExportVisualPdf = async () => {
    if (!businessReport) return
    setExporting('pdf')
    try {
      await exportVisualReportPdf(businessReport.html)
      showFeedback('success', 'PDF del informe generado.')
    } catch {
      showFeedback('error', 'No se pudo exportar el PDF del informe.')
    } finally {
      setExporting(null)
    }
  }

  if (!venue) return null

  const focusDayLabel = formatDateLine(new Date(`${focusDayKey}T12:00:00`))
  const isFocusToday = focusDayKey === todayKey

  const periodFilter = (
    <PeriodFilter
      value={period}
      onChange={(next) => {
        setPeriod(next)
        setFocusDate(startOfDay(new Date()))
      }}
    />
  )

  const dateNavigator = (
    <DateNavigator
      label={formatPeriodNavigatorLabel(period, focusDate, compact)}
      onPrev={() => setFocusDate((d) => shiftFocusDate(period, d, -1))}
      onNext={() => setFocusDate((d) => shiftFocusDate(period, d, 1))}
      showDivider={!desktop}
    />
  )

  const informesCard = (
            <Card>
              <CardTitle>Informes</CardTitle>
              <CardSubtitle>
                Exporta el periodo con gráficos y análisis IA (Excel/PDF) o
                genera el informe visual interactivo.
              </CardSubtitle>
              <View style={styles.exportRow}>
                <Button
                  label="Excel"
                  variant="secondary"
                  size="sm"
                  fullWidth={false}
                  loading={exporting === 'excel'}
                  onPress={() => void handleExportExcel()}
                  style={styles.exportBtn}
                />
                <Button
                  label="PDF"
                  variant="secondary"
                  size="sm"
                  fullWidth={false}
                  loading={exporting === 'pdf'}
                  onPress={() => void handleExportPdf()}
                  style={styles.exportBtn}
                />
                <Button
                  label="Informe IA"
                  size="sm"
                  fullWidth={false}
                  loading={reportLoading}
                  onPress={() => void handleBusinessReport()}
                  style={styles.exportBtn}
                />
              </View>
              {businessReport ? (
                <Animated.View
                  entering={FadeInDown.duration(320)}
                  style={styles.reportBox}
                >
                  <BusinessReportView
                    venueName={venue.name}
                    stats={stats}
                    visual={businessReport.visual}
                    analysis={businessReport.analysis}
                    html={businessReport.html}
                  />
                  <Button
                    label="Descargar PDF del informe"
                    variant="secondary"
                    size="sm"
                    fullWidth={false}
                    loading={exporting === 'pdf'}
                    onPress={() => void handleExportVisualPdf()}
                    style={styles.reportPdfBtn}
                  />
                </Animated.View>
              ) : null}
            </Card>
  )

  const pendientesCard = (
            <Card>
              <View style={styles.cardHead}>
                <CardTitle>Por confirmar</CardTitle>
                {pendingRows.length > 0 ? (
                  <PendingCountChip count={pendingRows.length} />
                ) : null}
              </View>
              <CardSubtitle>
                {period === 'day'
                  ? `Solicitudes pendientes ${isFocusToday ? 'de hoy' : `del ${focusDayLabel}`}.`
                  : `Pendientes ${periodScopeLabel}.`}
              </CardSubtitle>
              {pendingRows.length === 0 ? (
                <Animated.View entering={ZoomIn.duration(400)} style={styles.allClear}>
                  <Ionicons
                    name="checkmark-circle"
                    size={18}
                    color={colors.success}
                  />
                  <Text style={styles.allClearText}>
                    Sin solicitudes por confirmar en este periodo.
                  </Text>
                </Animated.View>
              ) : (
                pendingRows.map((r, idx) => {
                  const name = contactName(r)
                  return (
                    <Animated.View
                      key={r.id}
                      entering={FadeInRight.duration(320).delay(idx * 80)}
                      style={[
                        styles.pendingRow,
                        idx === pendingRows.length - 1 && styles.pendingRowLast,
                      ]}
                    >
                      <View style={styles.pendingInfo}>
                        <Text style={styles.pendingTime}>
                          {period !== 'day'
                            ? `${formatDateLine(r.startsAt)} · `
                            : ''}
                          {formatTimeRange(r.startsAt, r.endsAt)}
                        </Text>
                        <Text style={styles.pendingMeta} numberOfLines={1}>
                          {courtNameById.get(r.courtId) ?? 'Cancha'}
                          {name ? ` · ${name}` : ''}
                        </Text>
                      </View>
                      <Pressable
                        onPress={() => contactWhatsApp(r)}
                        accessibilityRole="button"
                        accessibilityLabel="Contactar por WhatsApp"
                        style={styles.waButton}
                      >
                        <Ionicons
                          name="logo-whatsapp"
                          size={18}
                          color={colors.success}
                        />
                      </Pressable>
                      <Button
                        label="Confirmar"
                        size="sm"
                        fullWidth={false}
                        onPress={() => setConfirmModalId(r.id)}
                      />
                    </Animated.View>
                  )
                })
              )}
            </Card>
  )

  const pizarraTitle =
    period === 'week'
      ? 'Pizarra semanal'
      : period === 'month'
        ? 'Pizarra mensual'
        : isFocusToday
          ? 'Pizarra de hoy'
          : `Pizarra · ${focusDayLabel}`

  const pizarraSubtitle =
    courts.length === 0
      ? 'Agrega canchas para ver la ocupación.'
      : period === 'week'
        ? 'Ocupación por cancha en cada día de la semana.'
        : period === 'month'
          ? 'Ocupación por cancha en cada semana del mes.'
          : focusDayRows.length === 0
            ? 'Sin reservas este día — la pizarra está libre.'
            : 'Toca un bloque para ver el detalle.'

  const pizarraCard = (
            <Card>
              <CardTitle>{pizarraTitle}</CardTitle>
              <CardSubtitle>{pizarraSubtitle}</CardSubtitle>
              {courts.length > 0 && period === 'day' ? (
                <OccupancyBoard
                  courts={courts}
                  reservations={focusDayRows}
                  openMinutes={boardWindow.open}
                  closeMinutes={boardWindow.close}
                  nowMinutes={isFocusToday ? nowMin : -1}
                  selectedId={selectedBlockId}
                  onSelectBlock={(id) =>
                    setSelectedBlockId((cur) => (cur === id ? null : id))
                  }
                />
              ) : null}
              {courts.length > 0 && period !== 'day' ? (
                <OccupancyHeatmap
                  courts={courts}
                  buckets={pizarraBuckets}
                  valueFor={pizarraOccupancyFor}
                />
              ) : null}
              {period === 'day' && selectedBlock ? (
                <Animated.View
                  entering={FadeInDown.duration(280)}
                  style={styles.blockDetail}
                >
                  <View style={styles.blockDetailHead}>
                    <Text style={styles.blockDetailTime}>
                      {formatTimeRange(
                        selectedBlock.startsAt,
                        selectedBlock.endsAt
                      )}
                    </Text>
                    <StatusBadge
                      status={selectedBlock.status}
                      paid={selectedBlock.paymentStatus === 'paid'}
                    />
                  </View>
                  <Text style={styles.blockDetailCourt}>
                    {courtNameById.get(selectedBlock.courtId) ?? 'Cancha'}
                    {contactName(selectedBlock)
                      ? ` · ${contactName(selectedBlock)}`
                      : ''}
                  </Text>
                  <View style={styles.blockDetailActions}>
                    {selectedBlock.status === 'pending' ? (
                      <Button
                        label="Confirmar"
                        size="sm"
                        fullWidth={false}
                        onPress={() => setConfirmModalId(selectedBlock.id)}
                        style={styles.blockDetailButton}
                      />
                    ) : null}
                    <Button
                      label="Gestionar en Reservas"
                      variant="ghost"
                      size="sm"
                      fullWidth={false}
                      onPress={() => router.navigate('/(tabs)/reservas')}
                      style={styles.blockDetailButton}
                    />
                  </View>
                </Animated.View>
              ) : null}
            </Card>
  )

  const tilesRow = (
            <View style={styles.tileRow}>
              <Card style={styles.tile} compact>
                <FloatingIcon>
                  <Ionicons name="cash-outline" size={18} color={colors.primary} />
                </FloatingIcon>
                <Text style={styles.tileLabel}>
                  Recaudación {periodScopeLabel}
                </Text>
                <Text style={styles.tileValue}>
                  {stats.hasAnyPrice || periodRows.length === 0
                    ? formatCLP(stats.confirmedRevenue)
                    : '—'}
                </Text>
                <Text style={styles.tileCaption} numberOfLines={2}>
                  {!stats.hasAnyPrice && periodRows.length > 0
                    ? 'Define precios por hora en Canchas.'
                    : stats.pendingRevenue > 0
                      ? `+ ${formatCLP(stats.pendingRevenue)} por confirmar`
                      : 'Solo reservas confirmadas.'}
                </Text>
              </Card>
              <Card style={styles.tile} compact>
                <FloatingIcon>
                  <Ionicons name="football-outline" size={18} color={colors.primary} />
                </FloatingIcon>
                <Text style={styles.tileLabel}>Próximo partido</Text>
                <Text style={styles.tileValue}>
                  {nextReservation ? formatTime(nextReservation.startsAt) : '—'}
                </Text>
                <Text style={styles.tileCaption} numberOfLines={2}>
                  {nextReservation
                    ? (courtNameById.get(nextReservation.courtId) ?? 'Cancha')
                    : isFocusToday
                      ? 'Sin próximas reservas hoy.'
                      : 'Sin próximas reservas este día.'}
                </Text>
              </Card>
            </View>
  )

  const ritmoCard = (
            <Card>
              <CardTitle>
                {period === 'month'
                  ? 'Ritmo del mes'
                  : period === 'week'
                    ? 'Ritmo de la semana'
                    : 'Ritmo de la semana'}
              </CardTitle>
              <WeekPulse
                days={pulseDays}
                selectedKey={focusDayKey}
                onSelect={(key) => {
                  setFocusDayKey(key)
                  setSelectedBlockId(null)
                }}
              />
              {selectedDay ? (
                <Text style={styles.weekDetail}>
                  {period === 'month'
                    ? `Semana desde ${formatDateLine(new Date(`${selectedDay.key}T12:00:00`))}`
                    : formatDateLine(
                        new Date(`${selectedDay.key}T12:00:00`)
                      )}{' '}
                  · {selectedDay.count}{' '}
                  {selectedDay.count === 1 ? 'reserva' : 'reservas'}
                  {selectedDay.revenue > 0
                    ? ` · ${formatCLP(selectedDay.revenue)} estimado`
                    : ''}
                </Text>
              ) : null}
            </Card>
  )

  const operacionCard = (
            <Card>
              <CardTitle>Operación</CardTitle>
              {[
                {
                  label: 'Canchas activas',
                  value: String(courts.length),
                  mono: true,
                },
                {
                  label: 'Tramo de reserva',
                  value: `${venue.slotDurationMinutes} min`,
                  mono: true,
                },
                {
                  label: 'Ciudad',
                  value: venue.city,
                  mono: false,
                },
              ].map((row, idx, arr) => (
                <Animated.View
                  key={row.label}
                  entering={FadeInDown.duration(300).delay(idx * 60)}
                  style={[
                    styles.infoRow,
                    idx === arr.length - 1 && styles.infoRowLast,
                  ]}
                >
                  <Text style={styles.infoLabel}>{row.label}</Text>
                  <Text style={row.mono ? styles.infoValue : styles.infoValueText}>
                    {row.value}
                  </Text>
                </Animated.View>
              ))}
              {venue.isPaused ? (
                <View style={styles.warnBox}>
                  <Text style={styles.warn}>
                    Centro pausado en búsquedas públicas. El panel sigue
                    activo.
                  </Text>
                </View>
              ) : null}
            </Card>
  )

  return (
    <View style={styles.flex}>
      <ScreenHero
        venueName={venue.name}
        subtitle={formatPeriodNavigatorLabel(period, focusDate)}
        stats={[
          { numericValue: stats.pending, label: 'Pendientes' },
          { numericValue: stats.confirmed, label: 'Confirmadas' },
          {
            numericValue: stats.occupancy,
            suffix: '%',
            label: 'Ocupación',
            glow: true,
          },
        ]}
      />

      {desktop ? (
        <View style={styles.toolbarWrap}>
          <View style={styles.toolbar}>
            <View style={styles.toolbarFilter}>{periodFilter}</View>
            <View style={styles.toolbarNav}>{dateNavigator}</View>
          </View>
          <View style={styles.toolbarDivider}>
            <PitchDivider />
          </View>
        </View>
      ) : (
        <>
          {periodFilter}
          {dateNavigator}
        </>
      )}

      <Screen
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

        {loading ? (
          <ActivityIndicator color={colors.primary} style={styles.loader} />
        ) : desktop ? (
          <View style={styles.columnsDesktop}>
            <View style={styles.colMain}>
              <AnimatedSection index={0}>{pizarraCard}</AnimatedSection>
              <AnimatedSection index={1}>{pendientesCard}</AnimatedSection>
              <AnimatedSection index={2}>{ritmoCard}</AnimatedSection>
            </View>
            <View style={styles.colSide}>
              <AnimatedSection index={0}>{tilesRow}</AnimatedSection>
              <AnimatedSection index={1}>{informesCard}</AnimatedSection>
              <AnimatedSection index={2}>{operacionCard}</AnimatedSection>
            </View>
          </View>
        ) : (
          <>
            <AnimatedSection index={0}>{informesCard}</AnimatedSection>
            <AnimatedSection index={1}>{pendientesCard}</AnimatedSection>
            <AnimatedSection index={2}>{pizarraCard}</AnimatedSection>
            <AnimatedSection index={3}>{tilesRow}</AnimatedSection>
            <AnimatedSection index={4}>{ritmoCard}</AnimatedSection>
            <AnimatedSection index={5}>{operacionCard}</AnimatedSection>
          </>
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
    </View>
  )
}

const styles = StyleSheet.create({
  flex: { flex: 1, backgroundColor: colors.background },
  loader: { marginTop: spacing.xl },
  toolbarWrap: {
    backgroundColor: colors.surface,
  },
  toolbar: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    width: '100%',
    maxWidth: layout.maxContentWidthWide,
    alignSelf: 'center',
  },
  toolbarFilter: {
    width: 380,
  },
  toolbarNav: {
    flex: 1,
    maxWidth: 480,
  },
  toolbarDivider: {
    width: '100%',
    maxWidth: layout.maxContentWidthWide,
    alignSelf: 'center',
    paddingHorizontal: spacing.lg,
    paddingBottom: spacing.sm,
  },
  columnsDesktop: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: spacing.lg,
  },
  colMain: {
    flex: 1.55,
    minWidth: 0,
  },
  colSide: {
    flex: 1,
    minWidth: 0,
  },
  cardHead: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
  },
  allClear: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
  },
  allClearText: {
    ...typography.body,
    color: colors.textSecondary,
  },
  pendingRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
    paddingVertical: spacing.sm + 2,
    borderBottomWidth: 1,
    borderBottomColor: colors.borderLight,
  },
  pendingRowLast: {
    borderBottomWidth: 0,
    paddingBottom: 0,
  },
  pendingInfo: {
    flex: 1,
  },
  pendingTime: {
    ...typography.scoreSm,
    fontSize: 16,
    color: colors.text,
  },
  pendingMeta: {
    ...typography.bodySm,
    color: colors.textMuted,
    marginTop: 1,
  },
  waButton: {
    width: 40,
    height: 40,
    borderRadius: radii.md,
    backgroundColor: colors.successLight,
    alignItems: 'center',
    justifyContent: 'center',
  },
  blockDetail: {
    marginTop: spacing.md,
    paddingTop: spacing.md,
    borderTopWidth: 1,
    borderTopColor: colors.borderLight,
  },
  blockDetailHead: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  blockDetailTime: {
    ...typography.scoreSm,
    fontSize: 18,
    color: colors.text,
  },
  blockDetailCourt: {
    ...typography.bodySm,
    color: colors.textMuted,
    marginTop: spacing.xs,
  },
  blockDetailActions: {
    flexDirection: 'row',
    gap: spacing.sm,
    marginTop: spacing.sm + 2,
  },
  blockDetailButton: {
    flexGrow: 0,
  },
  tileRow: {
    flexDirection: 'row',
    gap: spacing.md,
  },
  tile: {
    flex: 1,
  },
  tileLabel: {
    ...typography.eyebrow,
    color: colors.textMuted,
  },
  tileValue: {
    ...typography.score,
    fontSize: 24,
    color: colors.text,
    marginTop: spacing.xs + 2,
  },
  tileCaption: {
    ...typography.caption,
    color: colors.textMuted,
    marginTop: spacing.xs,
  },
  weekDetail: {
    ...typography.bodySm,
    color: colors.textSecondary,
    marginTop: spacing.md,
  },
  exportRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: spacing.sm,
    marginTop: spacing.sm,
  },
  exportBtn: {
    flexGrow: 1,
    minWidth: 96,
  },
  reportBox: {
    marginTop: spacing.md,
  },
  reportPdfBtn: {
    marginTop: spacing.md,
    alignSelf: 'flex-start',
  },
  reportText: {
    ...typography.bodySm,
    color: colors.text,
    lineHeight: 22,
  },
  infoRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingVertical: spacing.sm + 2,
    borderBottomWidth: 1,
    borderBottomColor: colors.borderLight,
  },
  infoRowLast: {
    borderBottomWidth: 0,
  },
  infoLabel: {
    ...typography.body,
    color: colors.textMuted,
  },
  infoValue: {
    ...typography.score,
    fontSize: 17,
    color: colors.text,
  },
  infoValueText: {
    ...typography.h3,
    color: colors.text,
  },
  warnBox: {
    marginTop: spacing.md,
    backgroundColor: colors.warningLight,
    borderRadius: radii.md,
    padding: spacing.md,
  },
  warn: {
    ...typography.bodySm,
    color: colors.warning,
    fontWeight: '600',
  },
})

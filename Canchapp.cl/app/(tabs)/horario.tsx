import { useCallback, useEffect, useState } from 'react'
import { Pressable, StyleSheet, Text, View } from 'react-native'
import Animated, { FadeInDown } from 'react-native-reanimated'

import { Button } from '@/components/ui/Button'
import { Card } from '@/components/ui/Card'
import { FeedbackBanner } from '@/components/ui/FeedbackBanner'
import { Field } from '@/components/ui/Field'
import { PitchDivider } from '@/components/ui/PitchDivider'
import { Screen } from '@/components/ui/Screen'
import { useAuth } from '@/lib/auth/provider'
import { useIsDesktopLayout } from '@/lib/layout'
import { syncVenueWeeklyHoursFromOwnerUi } from '@/lib/supabase/venue-owner-mutations'
import { getSupabase } from '@/lib/supabase/client'
import { fetchVenueWeeklyHours } from '@/lib/supabase/venue-queries'
import { WEEKDAY_SHORT_ES } from '@/lib/venue-slots'
import { colors, layout, radii, shadows, spacing, typography } from '@/lib/theme'
import type { VenueWeeklyHour } from '@/lib/types'

type DayHours = { open: string; close: string } | null

/** Orden de lectura de semana laboral: lunes primero, domingo al final. */
const WEEK_READING_ORDER = [1, 2, 3, 4, 5, 6, 0]

export default function HorarioScreen() {
  const { venue } = useAuth()
  const desktop = useIsDesktopLayout()
  const [weeklyLoaded, setWeeklyLoaded] = useState<VenueWeeklyHour[]>([])
  const [hoursByDay, setHoursByDay] = useState<Record<number, DayHours>>(() => {
    const o: Record<number, DayHours> = {}
    for (let d = 0; d <= 6; d++) o[d] = null
    return o
  })
  const [saving, setSaving] = useState(false)
  const [feedback, setFeedback] = useState<{
    type: 'success' | 'error'
    message: string
  } | null>(null)

  const showFeedback = (type: 'success' | 'error', message: string) => {
    setFeedback({ type, message })
    setTimeout(() => setFeedback(null), 4000)
  }

  const load = useCallback(async () => {
    if (!venue) return
    const rows = await fetchVenueWeeklyHours(getSupabase(), venue.id)
    setWeeklyLoaded(rows)
    const next: Record<number, DayHours> = {}
    for (let d = 0; d <= 6; d++) next[d] = null
    for (const h of rows) {
      next[h.dayOfWeek] = { open: h.openTime, close: h.closeTime }
    }
    setHoursByDay(next)
  }, [venue])

  useEffect(() => {
    void load()
  }, [load])

  const toggleDay = (day: number) => {
    setHoursByDay((prev) => {
      const cur = prev[day]
      if (cur) return { ...prev, [day]: null }
      return { ...prev, [day]: { open: '09:00', close: '22:00' } }
    })
  }

  const setWeekdays = () => {
    setHoursByDay((prev) => {
      const next = { ...prev }
      for (let d = 1; d <= 5; d++) next[d] = { open: '09:00', close: '22:00' }
      return next
    })
  }

  const save = async () => {
    if (!venue) return
    setSaving(true)
    try {
      const { error } = await syncVenueWeeklyHoursFromOwnerUi(
        getSupabase(),
        venue.id,
        hoursByDay,
        weeklyLoaded
      )
      if (error) showFeedback('error', error.message)
      else {
        showFeedback('success', 'Horario guardado.')
        await load()
      }
    } finally {
      setSaving(false)
    }
  }

  if (!venue) return null

  const openDaysCount = Object.values(hoursByDay).filter(Boolean).length

  const dayOrder = desktop ? WEEK_READING_ORDER : [0, 1, 2, 3, 4, 5, 6]

  const dayCards = dayOrder.map((day, idx) => {
    const cfg = hoursByDay[day]
    const open = cfg !== null && cfg !== undefined
    return (
      <Animated.View
        key={day}
        entering={FadeInDown.duration(280).delay(idx * 40)}
        style={desktop && styles.dayTile}
      >
        <Card elevated compact={desktop} style={desktop ? styles.dayCard : undefined}>
          <Pressable onPress={() => toggleDay(day)} style={styles.dayHead}>
            <Text style={styles.dayName}>{WEEKDAY_SHORT_ES[day]}</Text>
            <View style={styles.pill}>
              <View style={[styles.bulb, open ? styles.bulbOn : styles.bulbOff]} />
              <Text
                style={[
                  styles.pillText,
                  open ? styles.pillTextOpen : styles.pillTextClosed,
                ]}
              >
                {open ? 'Abierto' : 'Cerrado'}
              </Text>
            </View>
          </Pressable>
          {open && cfg ? (
            <View style={desktop ? styles.colFields : styles.row}>
              <Field
                label="Apertura"
                value={cfg.open}
                onChangeText={(openTime) =>
                  setHoursByDay((prev) => ({
                    ...prev,
                    [day]: { open: openTime, close: cfg.close },
                  }))
                }
                style={desktop ? undefined : styles.halfField}
              />
              <Field
                label="Cierre"
                value={cfg.close}
                onChangeText={(closeTime) =>
                  setHoursByDay((prev) => ({
                    ...prev,
                    [day]: { open: cfg.open, close: closeTime },
                  }))
                }
                style={desktop ? undefined : styles.halfField}
              />
            </View>
          ) : null}
        </Card>
      </Animated.View>
    )
  })

  return (
    <View style={styles.flex}>
      {desktop ? (
        <View style={styles.toolbarWrap}>
          <View style={styles.toolbar}>
            <Text style={styles.toolbarSummary}>
              <Text style={styles.toolbarSummaryNum}>{openDaysCount}</Text>
              {openDaysCount === 1 ? ' día abierto' : ' días abiertos'} de 7
            </Text>
            <View style={styles.toolbarActions}>
              <Button
                label="Lun–Vie 9:00–22:00"
                variant="secondary"
                size="sm"
                fullWidth={false}
                onPress={setWeekdays}
              />
              <Button
                label="Guardar horario"
                size="sm"
                fullWidth={false}
                onPress={() => void save()}
                loading={saving}
              />
            </View>
          </View>
          <View style={styles.toolbarDivider}>
            <PitchDivider />
          </View>
        </View>
      ) : null}

      <Screen>
        {!desktop ? (
          <Button
            label="Lun–Vie 9:00–22:00"
            variant="secondary"
            onPress={setWeekdays}
            style={styles.quick}
          />
        ) : null}

        {feedback ? (
          <FeedbackBanner message={feedback.message} type={feedback.type} />
        ) : null}

        {desktop ? (
          <View style={styles.dayGrid}>{dayCards}</View>
        ) : (
          dayCards
        )}

        {!desktop ? (
          <>
            <View style={styles.saveDivider}>
              <PitchDivider />
            </View>
            <Button
              label="Guardar horario"
              onPress={() => void save()}
              loading={saving}
            />
          </>
        ) : null}
      </Screen>
    </View>
  )
}

const styles = StyleSheet.create({
  flex: { flex: 1, backgroundColor: colors.background },
  quick: { marginBottom: spacing.md },
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
    paddingHorizontal: spacing.lg,
    paddingTop: spacing.md,
    paddingBottom: spacing.sm,
  },
  toolbarSummary: {
    ...typography.bodySm,
    color: colors.textMuted,
  },
  toolbarSummaryNum: {
    ...typography.scoreSm,
    color: colors.text,
  },
  toolbarActions: {
    flexDirection: 'row',
    gap: spacing.sm,
  },
  toolbarDivider: {
    width: '100%',
    maxWidth: layout.maxContentWidthWide,
    alignSelf: 'center',
    paddingHorizontal: spacing.lg,
    paddingBottom: spacing.sm,
  },
  dayGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: spacing.md,
  },
  dayTile: {
    width: '22.5%',
    minWidth: 200,
  },
  dayCard: {
    borderRadius: radii.lg,
  },
  colFields: {
    gap: spacing.xs,
  },
  dayHead: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: spacing.sm,
  },
  dayName: { ...typography.h3, color: colors.text },
  pill: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 7,
  },
  bulb: {
    width: 9,
    height: 9,
    borderRadius: 5,
  },
  bulbOn: {
    backgroundColor: colors.floodlight,
    ...shadows.floodlight,
  },
  bulbOff: { backgroundColor: colors.border },
  pillText: { ...typography.eyebrow },
  pillTextOpen: { color: colors.primaryDark },
  pillTextClosed: { color: colors.textMuted },
  row: { flexDirection: 'row', gap: spacing.sm },
  halfField: { flex: 1 },
  saveDivider: { marginTop: spacing.sm, marginBottom: spacing.lg },
})

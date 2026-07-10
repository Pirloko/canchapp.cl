import { useCallback, useEffect, useState } from 'react'
import { Pressable, StyleSheet, Text, View } from 'react-native'

import { Button } from '@/components/ui/Button'
import { Card } from '@/components/ui/Card'
import { FeedbackBanner } from '@/components/ui/FeedbackBanner'
import { Field } from '@/components/ui/Field'
import { PitchDivider } from '@/components/ui/PitchDivider'
import { Screen } from '@/components/ui/Screen'
import { useAuth } from '@/lib/auth/provider'
import { syncVenueWeeklyHoursFromOwnerUi } from '@/lib/supabase/venue-owner-mutations'
import { getSupabase } from '@/lib/supabase/client'
import { fetchVenueWeeklyHours } from '@/lib/supabase/venue-queries'
import { WEEKDAY_SHORT_ES } from '@/lib/venue-slots'
import { colors, shadows, spacing, typography } from '@/lib/theme'
import type { VenueWeeklyHour } from '@/lib/types'

type DayHours = { open: string; close: string } | null

export default function HorarioScreen() {
  const { venue } = useAuth()
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

  return (
    <Screen>
      <Button
        label="Lun–Vie 9:00–22:00"
        variant="secondary"
        onPress={setWeekdays}
        style={styles.quick}
      />

      {feedback ? (
        <FeedbackBanner message={feedback.message} type={feedback.type} />
      ) : null}

      {[0, 1, 2, 3, 4, 5, 6].map((day) => {
        const cfg = hoursByDay[day]
        const open = cfg !== null && cfg !== undefined
        return (
          <Card key={day} elevated>
            <Pressable onPress={() => toggleDay(day)} style={styles.dayHead}>
              <Text style={styles.dayName}>{WEEKDAY_SHORT_ES[day]}</Text>
              <View style={styles.pill}>
                <View
                  style={[
                    styles.bulb,
                    open ? styles.bulbOn : styles.bulbOff,
                  ]}
                />
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
              <View style={styles.row}>
                <Field
                  label="Apertura"
                  value={cfg.open}
                  onChangeText={(openTime) =>
                    setHoursByDay((prev) => ({
                      ...prev,
                      [day]: { open: openTime, close: cfg.close },
                    }))
                  }
                  style={styles.halfField}
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
                  style={styles.halfField}
                />
              </View>
            ) : null}
          </Card>
        )
      })}

      <View style={styles.saveDivider}>
        <PitchDivider />
      </View>
      <Button label="Guardar horario" onPress={() => void save()} loading={saving} />
    </Screen>
  )
}

const styles = StyleSheet.create({
  quick: { marginBottom: spacing.md },
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

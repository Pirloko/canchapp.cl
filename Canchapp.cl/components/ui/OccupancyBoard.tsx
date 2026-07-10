import { useEffect } from 'react'
import { Pressable, StyleSheet, Text, View } from 'react-native'
import Animated, {
  Easing,
  FadeInLeft,
  useAnimatedStyle,
  useSharedValue,
  withRepeat,
  withSequence,
  withSpring,
  withTiming,
} from 'react-native-reanimated'

import { colors, spacing, typography } from '@/lib/theme'
import { formatMinutes, formatTimeRange, minutesOfDay } from '@/lib/venue-slots'
import type { VenueCourt, VenueReservationRow } from '@/lib/types'

type OccupancyBoardProps = {
  courts: VenueCourt[]
  reservations: VenueReservationRow[]
  openMinutes: number
  closeMinutes: number
  nowMinutes: number
  selectedId: string | null
  onSelectBlock: (id: string) => void
}

type ReservationBlockProps = {
  reservation: VenueReservationRow
  courtName: string
  openMinutes: number
  span: number
  pct: (min: number) => number
  selected: boolean
  index: number
  onSelect: () => void
}

function ReservationBlock({
  reservation: r,
  courtName,
  openMinutes,
  span,
  pct,
  selected,
  index,
  onSelect,
}: ReservationBlockProps) {
  const startRaw = minutesOfDay(r.startsAt)
  const endRaw = minutesOfDay(r.endsAt)
  const start = Math.max(startRaw, openMinutes)
  const end = Math.min(
    endRaw <= startRaw ? openMinutes + span : endRaw,
    openMinutes + span
  )
  if (end <= start) return null

  const widthPct = ((end - start) / span) * 100
  const scale = useSharedValue(selected ? 1.02 : 1)

  useEffect(() => {
    scale.value = withSpring(selected ? 1.02 : 1, {
      damping: 14,
      stiffness: 220,
    })
  }, [selected, scale])

  const animStyle = useAnimatedStyle(() => ({
    transform: [{ scaleY: scale.value }],
  }))

  return (
    <Animated.View
      entering={FadeInLeft.duration(400)
        .delay(index * 60)
        .easing(Easing.out(Easing.cubic))}
      style={[
        styles.blockWrap,
        {
          left: `${pct(start)}%`,
          width: `${widthPct}%`,
        },
        animStyle,
      ]}
    >
      <Pressable
        onPress={onSelect}
        accessibilityRole="button"
        accessibilityLabel={`${courtName}, ${formatTimeRange(r.startsAt, r.endsAt)}, ${r.status === 'confirmed' ? 'confirmada' : 'pendiente'}`}
        hitSlop={4}
        style={[
          styles.block,
          {
            backgroundColor:
              r.status === 'confirmed' ? colors.primary : colors.pending,
          },
          selected && styles.blockSelected,
        ]}
      />
    </Animated.View>
  )
}

function NowLine({ leftPct }: { leftPct: number }) {
  const pulse = useSharedValue(1)

  useEffect(() => {
    pulse.value = withRepeat(
      withSequence(
        withTiming(0.45, { duration: 900, easing: Easing.inOut(Easing.ease) }),
        withTiming(1, { duration: 900, easing: Easing.inOut(Easing.ease) })
      ),
      -1,
      false
    )
  }, [pulse])

  const animStyle = useAnimatedStyle(() => ({
    opacity: pulse.value,
    shadowOpacity: pulse.value * 0.8,
  }))

  return (
    <Animated.View
      pointerEvents="none"
      style={[
        styles.nowLine,
        { left: `${leftPct}%` },
        animStyle,
      ]}
    />
  )
}

export function OccupancyBoard({
  courts,
  reservations,
  openMinutes,
  closeMinutes,
  nowMinutes,
  selectedId,
  onSelectBlock,
}: OccupancyBoardProps) {
  const span = Math.max(closeMinutes - openMinutes, 1)
  const pct = (min: number) => ((min - openMinutes) / span) * 100
  const showNow = nowMinutes >= openMinutes && nowMinutes <= closeMinutes

  let blockIndex = 0

  return (
    <View>
      {courts.map((court) => {
        const blocks = reservations.filter((r) => r.courtId === court.id)
        return (
          <View key={court.id} style={styles.row}>
            <Text style={styles.courtName}>{court.name}</Text>
            <View style={styles.track}>
              {Array.from({ length: 5 }, (_, i) => (
                <View
                  key={i}
                  pointerEvents="none"
                  style={[
                    styles.gridLine,
                    { left: `${(i / 4) * 100}%` },
                  ]}
                />
              ))}
              {blocks.map((r) => {
                const idx = blockIndex++
                return (
                  <ReservationBlock
                    key={r.id}
                    reservation={r}
                    courtName={court.name}
                    openMinutes={openMinutes}
                    span={span}
                    pct={pct}
                    selected={r.id === selectedId}
                    index={idx}
                    onSelect={() => onSelectBlock(r.id)}
                  />
                )
              })}
              {showNow ? <NowLine leftPct={pct(nowMinutes)} /> : null}
            </View>
          </View>
        )
      })}

      <View style={styles.scale}>
        <Text style={styles.scaleText}>{formatMinutes(openMinutes)}</Text>
        <Text style={styles.scaleText}>
          {formatMinutes(Math.round((openMinutes + closeMinutes) / 2))}
        </Text>
        <Text style={styles.scaleText}>{formatMinutes(closeMinutes)}</Text>
      </View>

      <View style={styles.legend}>
        <View style={styles.legendItem}>
          <View style={[styles.legendDot, { backgroundColor: colors.primary }]} />
          <Text style={styles.legendText}>Confirmada</Text>
        </View>
        <View style={styles.legendItem}>
          <View style={[styles.legendDot, { backgroundColor: colors.pending }]} />
          <Text style={styles.legendText}>Pendiente</Text>
        </View>
        {showNow ? (
          <View style={styles.legendItem}>
            <View style={styles.legendNow} />
            <Text style={styles.legendText}>Ahora</Text>
          </View>
        ) : null}
      </View>
    </View>
  )
}

const styles = StyleSheet.create({
  row: {
    marginBottom: spacing.sm + 2,
  },
  courtName: {
    ...typography.label,
    color: colors.textSecondary,
    marginBottom: 4,
  },
  track: {
    height: 24,
    borderRadius: 7,
    backgroundColor: colors.borderLight,
    overflow: 'hidden',
  },
  gridLine: {
    position: 'absolute',
    top: 0,
    bottom: 0,
    width: 1,
    backgroundColor: colors.border,
    opacity: 0.35,
  },
  blockWrap: {
    position: 'absolute',
    top: 3,
    bottom: 3,
  },
  block: {
    flex: 1,
    minWidth: 8,
    borderRadius: 5,
    borderWidth: 1,
    borderColor: colors.surface,
  },
  blockSelected: {
    borderWidth: 2,
    borderColor: colors.pitchDeep,
    shadowColor: colors.pitchDeep,
    shadowOffset: { width: 0, height: 0 },
    shadowOpacity: 0.35,
    shadowRadius: 6,
    elevation: 2,
  },
  nowLine: {
    position: 'absolute',
    top: -3,
    bottom: -3,
    width: 2,
    borderRadius: 1,
    backgroundColor: colors.danger,
    shadowColor: colors.danger,
    shadowOffset: { width: 0, height: 0 },
    shadowRadius: 6,
    elevation: 3,
  },
  scale: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginTop: 2,
  },
  scaleText: {
    ...typography.scoreSm,
    fontSize: 11,
    color: colors.textMuted,
  },
  legend: {
    flexDirection: 'row',
    gap: spacing.md,
    marginTop: spacing.sm + 2,
  },
  legendItem: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
  },
  legendDot: {
    width: 8,
    height: 8,
    borderRadius: 4,
  },
  legendNow: {
    width: 2,
    height: 10,
    borderRadius: 1,
    backgroundColor: colors.danger,
  },
  legendText: {
    ...typography.caption,
    color: colors.textMuted,
  },
})

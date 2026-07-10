import { useEffect } from 'react'
import { Pressable, StyleSheet, Text, View } from 'react-native'
import Animated, {
  Easing,
  useAnimatedStyle,
  useSharedValue,
  withRepeat,
  withSequence,
  withSpring,
  withTiming,
} from 'react-native-reanimated'

import { colors, spacing, typography } from '@/lib/theme'

export type WeekDayPoint = {
  key: string
  label: string
  count: number
  revenue: number
  isToday: boolean
}

type WeekPulseProps = {
  days: WeekDayPoint[]
  selectedKey: string
  onSelect: (key: string) => void
}

const BAR_AREA = 64

function PulseDot() {
  const scale = useSharedValue(1)

  useEffect(() => {
    scale.value = withRepeat(
      withSequence(
        withTiming(1.35, { duration: 1000, easing: Easing.inOut(Easing.ease) }),
        withTiming(1, { duration: 1000, easing: Easing.inOut(Easing.ease) })
      ),
      -1,
      false
    )
  }, [scale])

  const style = useAnimatedStyle(() => ({
    transform: [{ scale: scale.value }],
  }))

  return <Animated.View style={[styles.todayDot, styles.todayDotOn, style]} />
}

function PulseBar({
  height,
  selected,
  dimmed,
  zero,
  onPress,
  label,
  count,
}: {
  height: number
  selected: boolean
  dimmed: boolean
  zero: boolean
  onPress: () => void
  label: string
  count: number
}) {
  const animatedHeight = useSharedValue(0)
  const valueScale = useSharedValue(selected ? 1 : 0)

  useEffect(() => {
    animatedHeight.value = withSpring(height, {
      damping: 12,
      stiffness: 140,
    })
  }, [height, animatedHeight])

  useEffect(() => {
    valueScale.value = withSpring(selected ? 1 : 0, {
      damping: 14,
      stiffness: 200,
    })
  }, [selected, valueScale])

  const barStyle = useAnimatedStyle(() => ({
    height: animatedHeight.value,
  }))

  const valueStyle = useAnimatedStyle(() => ({
    opacity: valueScale.value,
    transform: [{ scale: 0.6 + valueScale.value * 0.4 }],
  }))

  return (
    <Pressable
      onPress={onPress}
      accessibilityRole="button"
      accessibilityLabel={`${label}: ${count} ${count === 1 ? 'reserva' : 'reservas'}`}
      style={styles.col}
    >
      <View style={styles.barArea}>
        <Animated.Text style={[styles.value, valueStyle]}>{count}</Animated.Text>
        <Animated.View
          style={[
            styles.bar,
            zero && styles.barZero,
            dimmed && styles.barDim,
            selected && styles.barSelected,
            barStyle,
          ]}
        />
        {selected ? <View style={styles.barGlow} pointerEvents="none" /> : null}
      </View>
    </Pressable>
  )
}

export function WeekPulse({ days, selectedKey, onSelect }: WeekPulseProps) {
  const max = Math.max(...days.map((d) => d.count), 1)

  return (
    <View style={styles.chart}>
      <View style={styles.baseline} pointerEvents="none" />
      {days.map((d) => {
        const selected = d.key === selectedKey
        const height =
          d.count === 0 ? 3 : Math.max(8, (d.count / max) * BAR_AREA)
        return (
          <View key={d.key} style={styles.colWrap}>
            <PulseBar
              height={height}
              selected={selected}
              dimmed={!selected && d.count > 0}
              zero={d.count === 0}
              onPress={() => onSelect(d.key)}
              label={d.label}
              count={d.count}
            />
            <Text style={[styles.day, selected && styles.daySelected]}>
              {d.label}
            </Text>
            {d.isToday ? <PulseDot /> : <View style={styles.todayDot} />}
          </View>
        )
      })}
    </View>
  )
}

const styles = StyleSheet.create({
  chart: {
    flexDirection: 'row',
    gap: spacing.sm,
  },
  baseline: {
    position: 'absolute',
    left: 0,
    right: 0,
    top: 16 + BAR_AREA,
    height: 1,
    backgroundColor: colors.borderLight,
  },
  colWrap: {
    flex: 1,
    alignItems: 'center',
  },
  col: {
    width: '100%',
    alignItems: 'center',
  },
  barArea: {
    height: 16 + BAR_AREA,
    width: '100%',
    alignItems: 'center',
    justifyContent: 'flex-end',
    position: 'relative',
  },
  barGlow: {
    position: 'absolute',
    bottom: 0,
    width: '80%',
    maxWidth: 30,
    height: 12,
    borderRadius: 6,
    backgroundColor: colors.primary,
    opacity: 0.2,
    transform: [{ translateY: 4 }],
  },
  value: {
    ...typography.scoreSm,
    fontSize: 12,
    color: colors.text,
    marginBottom: 2,
  },
  bar: {
    width: '100%',
    maxWidth: 34,
    borderTopLeftRadius: 4,
    borderTopRightRadius: 4,
    backgroundColor: colors.primary,
  },
  barSelected: {
    backgroundColor: colors.primaryDark,
  },
  barDim: {
    opacity: 0.35,
  },
  barZero: {
    backgroundColor: colors.border,
  },
  day: {
    ...typography.caption,
    color: colors.textMuted,
    marginTop: spacing.xs + 2,
  },
  daySelected: {
    color: colors.text,
    fontWeight: '700',
  },
  todayDot: {
    width: 4,
    height: 4,
    borderRadius: 2,
    marginTop: 3,
    backgroundColor: 'transparent',
  },
  todayDotOn: {
    backgroundColor: colors.floodlight,
  },
})

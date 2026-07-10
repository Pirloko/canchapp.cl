import { useEffect, useState } from 'react'
import { LayoutChangeEvent, Pressable, StyleSheet, Text, View } from 'react-native'
import Animated, {
  useAnimatedStyle,
  useSharedValue,
  withSpring,
} from 'react-native-reanimated'

import {
  type DashboardPeriod,
  periodChipLabel,
} from '@/lib/dashboard/period'
import { useIsCompactLayout } from '@/lib/layout'
import { colors, radii, spacing, typography } from '@/lib/theme'

const PERIODS: DashboardPeriod[] = ['day', 'week', 'month']

type PeriodFilterProps = {
  value: DashboardPeriod
  onChange: (period: DashboardPeriod) => void
}

type ChipLayout = { x: number; width: number }

export function PeriodFilter({ value, onChange }: PeriodFilterProps) {
  const compact = useIsCompactLayout()
  const [layouts, setLayouts] = useState<Partial<Record<DashboardPeriod, ChipLayout>>>(
    {}
  )
  const indicatorX = useSharedValue(0)
  const indicatorW = useSharedValue(0)

  useEffect(() => {
    const layout = layouts[value]
    if (!layout) return
    indicatorX.value = withSpring(layout.x, { damping: 18, stiffness: 220 })
    indicatorW.value = withSpring(layout.width, { damping: 18, stiffness: 220 })
  }, [value, layouts, indicatorX, indicatorW])

  const indicatorStyle = useAnimatedStyle(() => ({
    transform: [{ translateX: indicatorX.value }],
    width: indicatorW.value,
  }))

  const onChipLayout = (period: DashboardPeriod) => (e: LayoutChangeEvent) => {
    const { x, width } = e.nativeEvent.layout
    setLayouts((prev) => ({ ...prev, [period]: { x, width } }))
  }

  return (
    <View style={[styles.row, compact && styles.rowCompact]}>
      <Animated.View style={[styles.indicator, indicatorStyle]} />
      {PERIODS.map((period) => {
        const active = period === value
        return (
          <Pressable
            key={period}
            onLayout={onChipLayout(period)}
            onPress={() => onChange(period)}
            accessibilityRole="button"
            accessibilityState={{ selected: active }}
            style={({ pressed }) => [
              styles.chip,
              active && styles.chipActive,
              pressed && styles.chipPressed,
            ]}
          >
            <Text style={[styles.chipText, active && styles.chipTextActive]}>
              {periodChipLabel(period)}
            </Text>
          </Pressable>
        )
      })}
    </View>
  )
}

const styles = StyleSheet.create({
  row: {
    flexDirection: 'row',
    gap: spacing.sm,
    paddingHorizontal: spacing.lg,
    paddingTop: spacing.md,
    paddingBottom: spacing.sm,
    backgroundColor: colors.surface,
    position: 'relative',
  },
  rowCompact: {
    paddingHorizontal: spacing.md,
    paddingTop: spacing.sm,
  },
  indicator: {
    position: 'absolute',
    top: spacing.md,
    left: 0,
    height: 40,
    borderRadius: radii.full,
    backgroundColor: colors.primaryLight,
    borderWidth: 1,
    borderColor: colors.primary,
  },
  chip: {
    flex: 1,
    paddingVertical: spacing.sm,
    borderRadius: radii.full,
    alignItems: 'center',
    zIndex: 1,
  },
  chipActive: {},
  chipPressed: {
    transform: [{ scale: 0.97 }],
  },
  chipText: {
    ...typography.bodySm,
    fontWeight: '600',
    color: colors.textMuted,
  },
  chipTextActive: {
    color: colors.primary,
  },
})

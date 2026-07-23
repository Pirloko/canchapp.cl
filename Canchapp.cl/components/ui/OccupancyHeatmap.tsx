import { StyleSheet, Text, View } from 'react-native'

import { colors, radii, spacing, typography } from '@/lib/theme'
import type { VenueCourt } from '@/lib/types'

export type OccupancyBucket = {
  key: string
  label: string
}

type OccupancyHeatmapProps = {
  courts: VenueCourt[]
  buckets: OccupancyBucket[]
  valueFor: (courtId: string, bucketKey: string) => number
}

function hexToRgba(hex: string, alpha: number): string {
  const h = hex.replace('#', '')
  const r = parseInt(h.slice(0, 2), 16)
  const g = parseInt(h.slice(2, 4), 16)
  const b = parseInt(h.slice(4, 6), 16)
  return `rgba(${r}, ${g}, ${b}, ${alpha})`
}

function cellStyle(pct: number) {
  if (pct <= 0) {
    return { backgroundColor: colors.borderLight, color: colors.textMuted }
  }
  const alpha = 0.18 + (Math.min(pct, 100) / 100) * 0.62
  return {
    backgroundColor: hexToRgba(colors.primary, alpha),
    color: pct > 55 ? colors.surface : colors.primaryDark,
  }
}

export function OccupancyHeatmap({
  courts,
  buckets,
  valueFor,
}: OccupancyHeatmapProps) {
  return (
    <View>
      <View style={styles.row}>
        <View style={styles.courtCol} />
        {buckets.map((b) => (
          <View key={b.key} style={styles.headerCell}>
            <Text style={styles.headerText} numberOfLines={1}>
              {b.label}
            </Text>
          </View>
        ))}
      </View>
      {courts.map((court) => (
        <View key={court.id} style={styles.row}>
          <View style={styles.courtCol}>
            <Text style={styles.courtName} numberOfLines={1}>
              {court.name}
            </Text>
          </View>
          {buckets.map((b) => {
            const pct = valueFor(court.id, b.key)
            const { backgroundColor, color } = cellStyle(pct)
            return (
              <View
                key={b.key}
                style={[styles.cell, { backgroundColor }]}
              >
                <Text style={[styles.cellText, { color }]}>{pct}%</Text>
              </View>
            )
          })}
        </View>
      ))}
    </View>
  )
}

const styles = StyleSheet.create({
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.xs,
    marginBottom: spacing.xs,
  },
  courtCol: {
    width: 84,
  },
  courtName: {
    ...typography.label,
    color: colors.textSecondary,
  },
  headerCell: {
    flex: 1,
    alignItems: 'center',
  },
  headerText: {
    ...typography.caption,
    color: colors.textMuted,
  },
  cell: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    borderRadius: radii.sm,
    paddingVertical: spacing.xs + 2,
  },
  cellText: {
    ...typography.scoreSm,
    fontSize: 12,
  },
})

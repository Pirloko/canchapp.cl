import { ScrollView, StyleSheet, Text, View } from 'react-native'

import type { DashboardStats } from '@/lib/dashboard/stats'
import { formatCLP } from '@/lib/money'
import {
  HEAT_HOURS,
  WEEKDAY_SHORT_ES,
  type VisualReportData,
} from '@/lib/dashboard/visual-report-data'
import { colors, radii, spacing, typography } from '@/lib/theme'

type BusinessReportViewProps = {
  venueName: string
  stats: DashboardStats
  visual: VisualReportData
  analysis: string
  html?: string
}

function heatBg(count: number, max: number): string {
  if (count === 0) return colors.borderLight
  const t = count / max
  if (t < 0.25) return colors.primaryLight
  if (t < 0.5) return '#7bc9a0'
  if (t < 0.75) return colors.primary
  return '#064a35'
}

export function BusinessReportView({
  venueName,
  stats,
  visual,
  analysis,
}: BusinessReportViewProps) {
  const barMax = Math.max(...visual.dailyBars.map((b) => b.count), 1)

  return (
    <ScrollView style={styles.scroll} nestedScrollEnabled>
      <Text style={styles.title}>{venueName}</Text>
      <Text style={styles.meta}>{visual.periodLabel}</Text>

      <View style={styles.kpiRow}>
        <View style={styles.kpi}>
          <Text style={styles.kpiVal}>{stats.pending}</Text>
          <Text style={styles.kpiLbl}>Pendientes</Text>
        </View>
        <View style={styles.kpi}>
          <Text style={styles.kpiVal}>{stats.confirmed}</Text>
          <Text style={styles.kpiLbl}>Confirmadas</Text>
        </View>
        <View style={styles.kpi}>
          <Text style={styles.kpiVal}>{stats.occupancy}%</Text>
          <Text style={styles.kpiLbl}>Ocupación</Text>
        </View>
      </View>

      <Text style={styles.sectionTitle}>Mapa de calor</Text>
      <ScrollView horizontal showsHorizontalScrollIndicator={false}>
        <View>
          <View style={styles.heatHourRow}>
            <View style={styles.heatCorner} />
            {HEAT_HOURS.map((h) => (
              <Text key={h} style={styles.heatHour}>
                {h}
              </Text>
            ))}
          </View>
          {WEEKDAY_SHORT_ES.map((day, wd) => (
            <View key={day} style={styles.heatRow}>
              <Text style={styles.heatDay}>{day}</Text>
              {HEAT_HOURS.map((hour) => {
                const cell = visual.heatmap.find(
                  (c) => c.weekday === wd && c.hour === hour
                )
                const count = cell?.count ?? 0
                return (
                  <View
                    key={hour}
                    style={[
                      styles.heatCell,
                      { backgroundColor: heatBg(count, visual.heatmapMax) },
                    ]}
                  >
                    {count > 0 ? (
                      <Text
                        style={[
                          styles.heatCount,
                          count > visual.heatmapMax * 0.5 &&
                            styles.heatCountLight,
                        ]}
                      >
                        {count}
                      </Text>
                    ) : null}
                  </View>
                )
              })}
            </View>
          ))}
        </View>
      </ScrollView>

      <Text style={styles.sectionTitle}>Ritmo del periodo</Text>
      <View style={styles.barChart}>
        {visual.dailyBars.map((b) => {
          const h =
            b.count === 0 ? 3 : Math.max(8, (b.count / barMax) * 64)
          return (
            <View key={b.key} style={styles.barCol}>
              <Text style={styles.barVal}>{b.count || ''}</Text>
              <View style={[styles.bar, { height: h }]} />
              <Text style={styles.barLbl}>{b.label}</Text>
            </View>
          )
        })}
      </View>

      <Text style={styles.sectionTitle}>
        Pizarra · {visual.boardDayLabel}
      </Text>
      {visual.boardCourts.map((court) => {
        const span = Math.max(visual.boardClose - visual.boardOpen, 1)
        return (
          <View key={court.name} style={styles.boardRow}>
            <Text style={styles.boardName} numberOfLines={1}>
              {court.name}
            </Text>
            <View style={styles.boardTrack}>
              {court.blocks.map((b, i) => {
                const left =
                  ((b.startMin - visual.boardOpen) / span) * 100
                const width =
                  ((b.endMin - b.startMin) / span) * 100
                return (
                  <View
                    key={i}
                    style={[
                      styles.boardBlock,
                      {
                        left: `${left}%`,
                        width: `${Math.max(width, 4)}%`,
                        backgroundColor:
                          b.status === 'confirmed'
                            ? colors.success
                            : colors.pending,
                      },
                    ]}
                  />
                )
              })}
            </View>
          </View>
        )
      })}

      <Text style={styles.sectionTitle}>Análisis con IA</Text>
      <Text style={styles.analysis}>{analysis}</Text>
      {stats.hasAnyPrice ? (
        <Text style={styles.revenue}>
          Recaudación: {formatCLP(stats.confirmedRevenue)}
        </Text>
      ) : null}
    </ScrollView>
  )
}

const styles = StyleSheet.create({
  scroll: { maxHeight: 520 },
  title: { ...typography.h3, color: colors.primary },
  meta: { ...typography.caption, color: colors.textMuted, marginBottom: spacing.sm },
  kpiRow: { flexDirection: 'row', gap: spacing.sm, marginBottom: spacing.md },
  kpi: {
    flex: 1,
    backgroundColor: colors.background,
    borderRadius: radii.md,
    padding: spacing.sm,
    alignItems: 'center',
  },
  kpiVal: { ...typography.score, fontSize: 18, color: colors.text },
  kpiLbl: { ...typography.caption, color: colors.textMuted },
  sectionTitle: {
    ...typography.eyebrow,
    color: colors.primary,
    marginTop: spacing.md,
    marginBottom: spacing.sm,
  },
  heatHourRow: { flexDirection: 'row', alignItems: 'center' },
  heatCorner: { width: 28 },
  heatHour: {
    width: 22,
    textAlign: 'center',
    fontSize: 9,
    color: colors.textMuted,
  },
  heatRow: { flexDirection: 'row', alignItems: 'center', marginBottom: 2 },
  heatDay: { width: 28, fontSize: 10, color: colors.textMuted },
  heatCell: {
    width: 20,
    height: 18,
    marginHorizontal: 1,
    borderRadius: 3,
    alignItems: 'center',
    justifyContent: 'center',
  },
  heatCount: { fontSize: 8, color: colors.text, fontWeight: '700' },
  heatCountLight: { color: '#fff' },
  barChart: {
    flexDirection: 'row',
    alignItems: 'flex-end',
    gap: 4,
    height: 88,
    borderBottomWidth: 1,
    borderBottomColor: colors.borderLight,
  },
  barCol: { flex: 1, alignItems: 'center', justifyContent: 'flex-end' },
  barVal: { fontSize: 9, color: colors.textMuted, marginBottom: 2 },
  bar: {
    width: '80%',
    maxWidth: 28,
    backgroundColor: colors.primary,
    borderTopLeftRadius: 3,
    borderTopRightRadius: 3,
  },
  barLbl: { fontSize: 9, color: colors.textMuted, marginTop: 4 },
  boardRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
    marginBottom: spacing.sm,
  },
  boardName: { width: 56, ...typography.caption, color: colors.textSecondary },
  boardTrack: {
    flex: 1,
    height: 28,
    backgroundColor: colors.background,
    borderRadius: radii.sm,
    position: 'relative',
    overflow: 'hidden',
  },
  boardBlock: {
    position: 'absolute',
    top: 4,
    bottom: 4,
    borderRadius: 3,
  },
  analysis: {
    ...typography.bodySm,
    color: colors.text,
    lineHeight: 22,
  },
  revenue: {
    ...typography.caption,
    color: colors.textMuted,
    marginTop: spacing.md,
  },
})

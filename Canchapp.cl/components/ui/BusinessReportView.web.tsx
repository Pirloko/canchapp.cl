import { StyleSheet, View } from 'react-native'

import type { DashboardStats } from '@/lib/dashboard/stats'
import type { VisualReportData } from '@/lib/dashboard/visual-report-data'

type BusinessReportViewProps = {
  venueName: string
  stats: DashboardStats
  visual: VisualReportData
  analysis: string
  html: string
}

export function BusinessReportView({ html }: BusinessReportViewProps) {
  return (
    <View style={styles.wrap}>
      <iframe
        srcDoc={html}
        title="Informe de negocio"
        style={{
          border: 'none',
          width: '100%',
          height: 520,
          display: 'block',
          borderRadius: 8,
        }}
      />
    </View>
  )
}

const styles = StyleSheet.create({
  wrap: {
    marginTop: 8,
    borderRadius: 8,
    overflow: 'hidden',
    borderWidth: 1,
    borderColor: '#e2e8e4',
  },
})

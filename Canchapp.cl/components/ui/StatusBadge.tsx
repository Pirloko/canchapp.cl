import { StyleSheet, Text, View } from 'react-native'

import { typography, statusColors } from '@/lib/theme'

type StatusBadgeProps = {
  status: 'pending' | 'confirmed' | 'cancelled'
  paid?: boolean
}

export function StatusBadge({ status, paid }: StatusBadgeProps) {
  const s = statusColors(status)
  return (
    <View style={styles.badge}>
      <View style={[styles.dot, { backgroundColor: s.fg }]} />
      <Text style={[styles.text, { color: s.fg }]}>
        {s.label.toUpperCase()}
        {paid ? ' · PAGADA' : ''}
      </Text>
    </View>
  )
}

const styles = StyleSheet.create({
  badge: {
    flexDirection: 'row',
    alignItems: 'center',
    alignSelf: 'flex-start',
    gap: 6,
  },
  dot: {
    width: 7,
    height: 7,
    borderRadius: 4,
  },
  text: {
    ...typography.eyebrow,
  },
})

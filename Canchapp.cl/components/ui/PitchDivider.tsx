import { StyleSheet, View } from 'react-native'

import { colors } from '@/lib/theme'

type PitchDividerProps = {
  /** 'light' para fondos claros, 'dark' sobre el marcador (héroe verde noche). */
  tone?: 'light' | 'dark'
}

/** Línea de mitad de cancha con círculo central — la firma visual de Canchapp. */
export function PitchDivider({ tone = 'light' }: PitchDividerProps) {
  const line = tone === 'dark' ? colors.pitchLine : colors.borderLight
  const ring = tone === 'dark' ? colors.pitchRing : colors.border
  return (
    <View style={styles.wrap} accessible={false}>
      <View style={[styles.line, { backgroundColor: line }]} />
      <View style={[styles.ring, { borderColor: ring }]} />
      <View style={[styles.line, { backgroundColor: line }]} />
    </View>
  )
}

const styles = StyleSheet.create({
  wrap: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  line: {
    flex: 1,
    height: 1,
  },
  ring: {
    width: 11,
    height: 11,
    borderRadius: 6,
    borderWidth: 1.5,
    marginHorizontal: 8,
  },
})

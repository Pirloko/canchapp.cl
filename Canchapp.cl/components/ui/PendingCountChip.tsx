import { useEffect } from 'react'
import { StyleSheet, Text } from 'react-native'
import Animated, {
  useAnimatedStyle,
  useSharedValue,
  withSequence,
  withSpring,
} from 'react-native-reanimated'

import { colors, radii, typography } from '@/lib/theme'

type PendingCountChipProps = {
  count: number
}

export function PendingCountChip({ count }: PendingCountChipProps) {
  const scale = useSharedValue(1)

  useEffect(() => {
    scale.value = withSequence(
      withSpring(1.2, { damping: 8, stiffness: 280 }),
      withSpring(1, { damping: 10, stiffness: 200 })
    )
  }, [count, scale])

  const style = useAnimatedStyle(() => ({
    transform: [{ scale: scale.value }],
  }))

  return (
    <Animated.View style={[styles.chip, style]}>
      <Text style={styles.text}>{count}</Text>
    </Animated.View>
  )
}

const styles = StyleSheet.create({
  chip: {
    minWidth: 24,
    height: 24,
    paddingHorizontal: 7,
    borderRadius: radii.full,
    backgroundColor: colors.pendingLight,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 8,
  },
  text: {
    ...typography.scoreSm,
    fontSize: 13,
    color: colors.pending,
  },
})

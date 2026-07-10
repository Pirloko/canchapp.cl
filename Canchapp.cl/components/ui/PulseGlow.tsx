import type { ReactNode } from 'react'
import { StyleSheet, View, type ViewStyle } from 'react-native'
import Animated, {
  Easing,
  useAnimatedStyle,
  useSharedValue,
  withRepeat,
  withSequence,
  withTiming,
} from 'react-native-reanimated'
import { useEffect } from 'react'

import { colors } from '@/lib/theme'

type PulseGlowProps = {
  children: ReactNode
  color?: string
  style?: ViewStyle
}

export function PulseGlow({
  children,
  color = colors.floodlight,
  style,
}: PulseGlowProps) {
  const pulse = useSharedValue(0.35)

  useEffect(() => {
    pulse.value = withRepeat(
      withSequence(
        withTiming(0.85, { duration: 1400, easing: Easing.inOut(Easing.ease) }),
        withTiming(0.35, { duration: 1400, easing: Easing.inOut(Easing.ease) })
      ),
      -1,
      false
    )
  }, [pulse])

  const glowStyle = useAnimatedStyle(() => ({
    opacity: pulse.value,
  }))

  return (
    <View style={[styles.wrap, style]}>
      <Animated.View
        style={[
          styles.glow,
          { backgroundColor: color, shadowColor: color },
          glowStyle,
        ]}
      />
      {children}
    </View>
  )
}

const styles = StyleSheet.create({
  wrap: {
    position: 'relative',
    alignItems: 'flex-start',
  },
  glow: {
    position: 'absolute',
    top: -6,
    left: -10,
    right: -10,
    bottom: -6,
    borderRadius: 16,
    shadowOffset: { width: 0, height: 0 },
    shadowOpacity: 0.9,
    shadowRadius: 14,
    elevation: 4,
  },
})

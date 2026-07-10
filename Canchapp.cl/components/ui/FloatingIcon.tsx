import type { ReactNode } from 'react'
import { useEffect } from 'react'
import { StyleSheet } from 'react-native'
import Animated, {
  Easing,
  useAnimatedStyle,
  useSharedValue,
  withRepeat,
  withSequence,
  withTiming,
} from 'react-native-reanimated'

type FloatingIconProps = {
  children: ReactNode
}

export function FloatingIcon({ children }: FloatingIconProps) {
  const offset = useSharedValue(0)

  useEffect(() => {
    offset.value = withRepeat(
      withSequence(
        withTiming(-3, { duration: 1600, easing: Easing.inOut(Easing.ease) }),
        withTiming(0, { duration: 1600, easing: Easing.inOut(Easing.ease) })
      ),
      -1,
      false
    )
  }, [offset])

  const style = useAnimatedStyle(() => ({
    transform: [{ translateY: offset.value }],
  }))

  return <Animated.View style={[styles.wrap, style]}>{children}</Animated.View>
}

const styles = StyleSheet.create({
  wrap: {
    alignSelf: 'flex-start',
    marginBottom: 4,
  },
})

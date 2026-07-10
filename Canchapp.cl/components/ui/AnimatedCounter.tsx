import { useEffect, useState } from 'react'
import { Text, type StyleProp, type TextStyle } from 'react-native'
import {
  Easing,
  runOnJS,
  useAnimatedReaction,
  useSharedValue,
  withTiming,
} from 'react-native-reanimated'

type AnimatedCounterProps = {
  value: number
  suffix?: string
  style?: StyleProp<TextStyle>
  duration?: number
}

export function AnimatedCounter({
  value,
  suffix = '',
  style,
  duration = 800,
}: AnimatedCounterProps) {
  const animated = useSharedValue(0)
  const [display, setDisplay] = useState(0)

  useEffect(() => {
    animated.value = withTiming(value, {
      duration,
      easing: Easing.out(Easing.cubic),
    })
  }, [value, duration, animated])

  useAnimatedReaction(
    () => animated.value,
    (current) => {
      runOnJS(setDisplay)(Math.round(current))
    },
    [animated]
  )

  return (
    <Text style={style}>
      {display}
      {suffix}
    </Text>
  )
}

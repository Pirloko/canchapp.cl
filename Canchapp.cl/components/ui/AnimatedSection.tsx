import type { ReactNode } from 'react'
import { type StyleProp, type ViewStyle } from 'react-native'
import Animated, { FadeInDown } from 'react-native-reanimated'

type AnimatedSectionProps = {
  children: ReactNode
  index?: number
  style?: StyleProp<ViewStyle>
}

const STAGGER_MS = 50
const DURATION_MS = 420

export function AnimatedSection({
  children,
  index = 0,
  style,
}: AnimatedSectionProps) {
  return (
    <Animated.View
      entering={FadeInDown.delay(index * STAGGER_MS)
        .duration(DURATION_MS)
        .springify()
        .damping(18)}
      style={style}
    >
      {children}
    </Animated.View>
  )
}

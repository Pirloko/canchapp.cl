import { Ionicons } from '@expo/vector-icons'
import { Pressable, StyleSheet, View } from 'react-native'
import Animated, {
  FadeIn,
  FadeOut,
  useAnimatedStyle,
  useSharedValue,
  withSpring,
} from 'react-native-reanimated'

import { PitchDivider } from '@/components/ui/PitchDivider'
import { useIsCompactLayout } from '@/lib/layout'
import { colors, radii, spacing, typography } from '@/lib/theme'

type DateNavigatorProps = {
  label: string
  onPrev: () => void
  onNext: () => void
}

function NavButton({
  icon,
  onPress,
}: {
  icon: 'chevron-back' | 'chevron-forward'
  onPress: () => void
}) {
  const scale = useSharedValue(1)
  const rotation = useSharedValue(0)

  const animStyle = useAnimatedStyle(() => ({
    transform: [{ scale: scale.value }, { rotate: `${rotation.value}deg` }],
  }))

  return (
    <Pressable
      onPress={onPress}
      onPressIn={() => {
        scale.value = withSpring(0.9, { damping: 14, stiffness: 300 })
        rotation.value = withSpring(icon === 'chevron-back' ? -8 : 8, {
          damping: 14,
          stiffness: 300,
        })
      }}
      onPressOut={() => {
        scale.value = withSpring(1, { damping: 14, stiffness: 300 })
        rotation.value = withSpring(0, { damping: 14, stiffness: 300 })
      }}
      hitSlop={8}
    >
      <Animated.View style={[styles.navBtn, animStyle]}>
        <Ionicons name={icon} size={22} color={colors.primary} />
      </Animated.View>
    </Pressable>
  )
}

export function DateNavigator({ label, onPrev, onNext }: DateNavigatorProps) {
  const compact = useIsCompactLayout()

  return (
    <View style={styles.wrap}>
      <View style={[styles.bar, compact && styles.barCompact]}>
        <NavButton icon="chevron-back" onPress={onPrev} />
        <Animated.Text
          key={label}
          entering={FadeIn.duration(280)}
          exiting={FadeOut.duration(180)}
          style={[styles.label, compact && styles.labelCompact]}
          numberOfLines={compact ? 2 : 1}
        >
          {label}
        </Animated.Text>
        <NavButton icon="chevron-forward" onPress={onNext} />
      </View>
      <View style={styles.dividerWrap}>
        <PitchDivider />
      </View>
    </View>
  )
}

const styles = StyleSheet.create({
  wrap: {
    backgroundColor: colors.surface,
  },
  bar: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: spacing.lg,
    paddingTop: spacing.md,
    paddingBottom: spacing.sm,
  },
  barCompact: {
    paddingHorizontal: spacing.md,
    paddingTop: spacing.sm,
  },
  dividerWrap: {
    paddingHorizontal: spacing.lg,
    paddingBottom: spacing.sm,
  },
  navBtn: {
    width: 40,
    height: 40,
    borderRadius: radii.full,
    backgroundColor: colors.primaryLight,
    alignItems: 'center',
    justifyContent: 'center',
  },
  label: {
    ...typography.h3,
    color: colors.text,
    textTransform: 'capitalize',
    flex: 1,
    textAlign: 'center',
    marginHorizontal: spacing.sm,
  },
  labelCompact: {
    fontSize: 14,
    lineHeight: 18,
  },
})

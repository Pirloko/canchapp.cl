import { Ionicons } from '@expo/vector-icons'
import { Pressable, StyleSheet, Text, View } from 'react-native'
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
  /** Oculta la línea de mitad de cancha cuando el navegador vive dentro de una toolbar. */
  showDivider?: boolean
  /** Muestra un atajo "Hoy" para volver al día actual. Pasar solo cuando no se está en hoy. */
  onToday?: () => void
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

export function DateNavigator({
  label,
  onPrev,
  onNext,
  showDivider = true,
  onToday,
}: DateNavigatorProps) {
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
        {onToday ? (
          <Animated.View entering={FadeIn.duration(280)} exiting={FadeOut.duration(180)}>
            <Pressable
              onPress={onToday}
              accessibilityRole="button"
              accessibilityLabel="Volver a hoy"
              hitSlop={8}
              style={({ pressed }) => [
                styles.todayPill,
                pressed && styles.todayPillPressed,
              ]}
            >
              <Text style={styles.todayPillText}>Hoy</Text>
            </Pressable>
          </Animated.View>
        ) : null}
        <NavButton icon="chevron-forward" onPress={onNext} />
      </View>
      {showDivider ? (
        <View style={styles.dividerWrap}>
          <PitchDivider />
        </View>
      ) : null}
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
  todayPill: {
    paddingHorizontal: spacing.sm + 4,
    paddingVertical: spacing.xs + 1,
    borderRadius: radii.full,
    borderWidth: 1,
    borderColor: colors.primary,
    marginRight: spacing.sm,
  },
  todayPillPressed: {
    backgroundColor: colors.primaryLight,
  },
  todayPillText: {
    ...typography.caption,
    fontWeight: '700',
    color: colors.primary,
  },
})

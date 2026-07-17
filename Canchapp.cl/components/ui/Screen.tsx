import { Ionicons } from '@expo/vector-icons'
import type { ReactNode } from 'react'
import { useEffect } from 'react'
import {
  ScrollView,
  StyleSheet,
  Text,
  View,
  type ScrollViewProps,
} from 'react-native'
import Animated, {
  Easing,
  useAnimatedStyle,
  useSharedValue,
  withRepeat,
  withSequence,
  withTiming,
} from 'react-native-reanimated'
import { useSafeAreaInsets } from 'react-native-safe-area-context'

import { AnimatedCounter } from '@/components/ui/AnimatedCounter'
import { PitchDivider } from '@/components/ui/PitchDivider'
import { PulseGlow } from '@/components/ui/PulseGlow'
import { useIsCompactLayout, useIsDesktopLayout } from '@/lib/layout'
import { colors, layout, spacing, typography } from '@/lib/theme'

type ScreenProps = ScrollViewProps & {
  children: ReactNode
  padded?: boolean
}

export function Screen({
  children,
  padded = true,
  contentContainerStyle,
  ...rest
}: ScreenProps) {
  const compact = useIsCompactLayout()
  const desktop = useIsDesktopLayout()

  return (
    <ScrollView
      style={styles.scroll}
      contentContainerStyle={[
        padded && (compact ? styles.contentCompact : styles.content),
        contentContainerStyle,
      ]}
      showsVerticalScrollIndicator={false}
      {...rest}
    >
      <View style={[styles.inner, desktop && styles.innerWide]}>
        {children}
      </View>
    </ScrollView>
  )
}

export type ScreenHeroStat = {
  label: string
  numericValue: number
  suffix?: string
  glow?: boolean
}

type ScreenHeroProps = {
  venueName?: string
  subtitle?: string
  stats?: ScreenHeroStat[]
}

function HeroParticle({ style }: { style: object }) {
  const drift = useSharedValue(0)

  useEffect(() => {
    drift.value = withRepeat(
      withSequence(
        withTiming(1, { duration: 3200, easing: Easing.inOut(Easing.ease) }),
        withTiming(0, { duration: 3200, easing: Easing.inOut(Easing.ease) })
      ),
      -1,
      false
    )
  }, [drift])

  const anim = useAnimatedStyle(() => ({
    opacity: 0.15 + drift.value * 0.25,
    transform: [{ translateY: -drift.value * 6 }],
  }))

  return <Animated.View style={[styles.particle, style, anim]} />
}

/**
 * Panel de marcador: banda de noche de partido, firma visual del panel.
 * En escritorio es un ticker de una sola fila: nombre a la izquierda,
 * marcador a la derecha.
 */
export function ScreenHero({ venueName, subtitle, stats }: ScreenHeroProps) {
  const insets = useSafeAreaInsets()
  const compact = useIsCompactLayout()
  const desktop = useIsDesktopLayout()

  return (
    <View
      style={[
        styles.hero,
        compact && styles.heroCompact,
        desktop && styles.heroDesktop,
        { paddingTop: insets.top + spacing.sm },
      ]}
    >
      <View style={styles.heroAtmosphere} pointerEvents="none">
        <View style={styles.heroGradientTop} />
        <View style={styles.heroGradientBottom} />
        <View style={styles.floodlightLeft} />
        <View style={styles.floodlightRight} />
        <HeroParticle style={styles.particleA} />
        <HeroParticle style={styles.particleB} />
        <HeroParticle style={styles.particleC} />
      </View>

      <View style={[styles.heroInner, desktop && styles.heroInnerDesktop]}>
        <View style={desktop ? styles.heroLeftDesktop : undefined}>
          <View
            style={[
              styles.heroTop,
              compact && styles.heroTopCompact,
              desktop && styles.heroTopDesktop,
            ]}
          >
            <View style={styles.heroBadge}>
              <Ionicons name="football" size={12} color={colors.onPitch} />
              <Text style={styles.heroBadgeText}>Canchapp</Text>
            </View>
            {subtitle && !compact ? (
              <Text style={styles.heroClock} numberOfLines={1}>
                {subtitle}
              </Text>
            ) : null}
          </View>

          {venueName ? (
            <Text
              style={[
                styles.heroTitle,
                compact && styles.heroTitleCompact,
                desktop && styles.heroTitleDesktop,
              ]}
              numberOfLines={desktop ? 1 : 2}
            >
              {venueName}
            </Text>
          ) : null}
        </View>

        {stats && stats.length > 0 ? (
          <View
            style={[
              styles.heroStats,
              compact && styles.heroStatsCompact,
              desktop && styles.heroStatsDesktop,
            ]}
          >
            {stats.map((s) => {
              const statContent = (
                <View style={styles.heroStat}>
                  <AnimatedCounter
                    value={s.numericValue}
                    suffix={s.suffix}
                    style={[
                      styles.heroStatValue,
                      compact && styles.heroStatValueCompact,
                      desktop && styles.heroStatValueDesktop,
                    ]}
                  />
                  <Text style={styles.heroStatLabel}>{s.label}</Text>
                </View>
              )

              return s.glow ? (
                <PulseGlow key={s.label}>{statContent}</PulseGlow>
              ) : (
                <View key={s.label}>{statContent}</View>
              )
            })}
          </View>
        ) : null}
      </View>

      <View
        style={[styles.heroDividerWrap, desktop && styles.heroDividerWrapDesktop]}
      >
        <PitchDivider tone="dark" />
      </View>
    </View>
  )
}

const styles = StyleSheet.create({
  scroll: {
    flex: 1,
    backgroundColor: colors.background,
  },
  content: {
    padding: layout.screenPadding,
    paddingBottom: spacing.xxl,
  },
  contentCompact: {
    padding: spacing.md,
    paddingBottom: spacing.xl,
  },
  inner: {
    width: '100%',
    maxWidth: layout.maxContentWidth,
    alignSelf: 'center',
  },
  innerWide: {
    maxWidth: layout.maxContentWidthWide,
  },
  hero: {
    backgroundColor: colors.pitchDeep,
    paddingHorizontal: spacing.lg,
    paddingBottom: spacing.md,
    borderBottomLeftRadius: 24,
    borderBottomRightRadius: 24,
    overflow: 'hidden',
  },
  heroCompact: {
    paddingHorizontal: spacing.md,
    paddingBottom: spacing.sm + 4,
    borderBottomLeftRadius: 18,
    borderBottomRightRadius: 18,
  },
  heroDesktop: {
    paddingHorizontal: spacing.xl,
    paddingBottom: spacing.sm + 2,
    borderBottomLeftRadius: 0,
    borderBottomRightRadius: 0,
  },
  heroInner: {
    width: '100%',
  },
  heroInnerDesktop: {
    maxWidth: layout.maxContentWidthWide,
    alignSelf: 'center',
    flexDirection: 'row',
    alignItems: 'flex-end',
    justifyContent: 'space-between',
    gap: spacing.xl,
  },
  heroLeftDesktop: {
    flexShrink: 1,
    minWidth: 0,
  },
  heroAtmosphere: {
    ...StyleSheet.absoluteFill,
  },
  heroGradientTop: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    height: '55%',
    backgroundColor: colors.pitch,
    opacity: 0.92,
  },
  heroGradientBottom: {
    position: 'absolute',
    bottom: 0,
    left: 0,
    right: 0,
    height: '50%',
    backgroundColor: colors.pitchDeep,
    opacity: 0.95,
  },
  floodlightLeft: {
    position: 'absolute',
    top: -40,
    left: -30,
    width: 160,
    height: 160,
    borderRadius: 80,
    backgroundColor: colors.floodlight,
    opacity: 0.07,
  },
  floodlightRight: {
    position: 'absolute',
    top: 20,
    right: -50,
    width: 200,
    height: 200,
    borderRadius: 100,
    backgroundColor: colors.floodlight,
    opacity: 0.05,
  },
  particle: {
    position: 'absolute',
    width: 3,
    height: 3,
    borderRadius: 2,
    backgroundColor: colors.floodlight,
  },
  particleA: { top: '28%', left: '18%' },
  particleB: { top: '42%', right: '22%' },
  particleC: { top: '18%', right: '38%' },
  heroTop: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: spacing.sm,
    gap: spacing.sm,
  },
  heroTopCompact: {
    marginBottom: spacing.xs + 2,
  },
  heroTopDesktop: {
    justifyContent: 'flex-start',
    gap: spacing.md,
    marginBottom: spacing.xs,
  },
  heroBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
  },
  heroBadgeText: {
    ...typography.eyebrow,
    color: colors.onPitchMuted,
  },
  heroClock: {
    ...typography.scoreSm,
    color: colors.onPitchMuted,
    textTransform: 'capitalize',
  },
  heroTitle: {
    ...typography.hero,
    color: colors.onPitch,
    fontSize: 22,
  },
  heroTitleCompact: {
    fontSize: 20,
    lineHeight: 26,
  },
  heroTitleDesktop: {
    fontSize: 24,
  },
  heroStats: {
    flexDirection: 'row',
    gap: spacing.xl,
    marginTop: spacing.md,
  },
  heroStatsCompact: {
    flexWrap: 'wrap',
    gap: spacing.md,
    marginTop: spacing.sm + 4,
  },
  heroStatsDesktop: {
    marginTop: 0,
    gap: spacing.xl + spacing.sm,
    flexShrink: 0,
  },
  heroStat: {
    alignItems: 'flex-start',
  },
  heroStatValue: {
    ...typography.score,
    fontSize: 28,
    color: colors.onPitch,
  },
  heroStatValueCompact: {
    fontSize: 24,
  },
  heroStatValueDesktop: {
    fontSize: 26,
  },
  heroStatLabel: {
    ...typography.eyebrow,
    color: colors.onPitchMuted,
    marginTop: 2,
  },
  heroDividerWrap: {
    marginTop: spacing.md,
  },
  heroDividerWrapDesktop: {
    marginTop: spacing.sm + 2,
    width: '100%',
    maxWidth: layout.maxContentWidthWide,
    alignSelf: 'center',
  },
})

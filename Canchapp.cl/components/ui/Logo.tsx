import { Image, StyleSheet, Text, View, type StyleProp, type ViewStyle } from 'react-native'

import { colors, typography } from '@/lib/theme'

export type LogoVariant = 'light' | 'dark' | 'solid'
export type LogoSize = 'sm' | 'md' | 'lg'

type LogoProps = {
  /** light = trazo verde sobre fondo claro; dark = blanco; solid = círculo relleno verde */
  variant?: LogoVariant
  size?: LogoSize
  /** Muestra el wordmark "canchapp" junto al ícono */
  withWordmark?: boolean
  style?: StyleProp<ViewStyle>
}

const SIZE_MAP = {
  sm: 28,
  md: 36,
  lg: 48,
} as const

const WORD_SIZE = {
  sm: 18,
  md: 22,
  lg: 28,
} as const

/**
 * Marca Canchapp: cancha (rectángulo + línea + círculo) dentro de un anillo.
 * Geometría alineada con `assets/brand/canchapp-logo-icon.svg`.
 */
export function Logo({
  variant = 'light',
  size = 'md',
  withWordmark = false,
  style,
}: LogoProps) {
  const dim = SIZE_MAP[size]
  const isSolid = variant === 'solid'
  const isDark = variant === 'dark'
  const stroke = isDark || isSolid ? '#FFFFFF' : colors.primaryDark
  const fill = isSolid ? colors.primaryDark : 'transparent'
  const ring = isSolid ? 'transparent' : stroke
  const wordColor = isDark ? '#FFFFFF' : colors.primary

  // Proporciones del SVG 64×64 (anillo inset ~2, cancha 15–49 × 19–45)
  const ringW = Math.max(2, dim * 0.0625)
  const courtW = dim * (34 / 64)
  const courtH = dim * (26 / 64)
  const courtRx = dim * (3.5 / 64)
  const courtStroke = Math.max(1.8, dim * (3.2 / 64))
  const midStroke = courtStroke
  const centerR = dim * (5 / 64)
  const centerStroke = Math.max(1.5, dim * (2.6 / 64))

  return (
    <View
      style={[styles.row, style]}
      accessible
      accessibilityRole="image"
      accessibilityLabel="Canchapp"
    >
      <View style={{ width: dim, height: dim }}>
        {/* Disco / anillo */}
        <View
          style={{
            position: 'absolute',
            top: 0,
            left: 0,
            width: dim,
            height: dim,
            borderRadius: dim / 2,
            backgroundColor: fill,
            borderWidth: isSolid ? 0 : ringW,
            borderColor: ring,
          }}
        />

        {/* Cancha */}
        <View
          style={{
            position: 'absolute',
            left: (dim - courtW) / 2,
            top: (dim - courtH) / 2,
            width: courtW,
            height: courtH,
            borderRadius: courtRx,
            borderWidth: courtStroke,
            borderColor: stroke,
          }}
        />

        {/* Línea central */}
        <View
          style={{
            position: 'absolute',
            left: dim / 2 - midStroke / 2,
            top: (dim - courtH) / 2,
            width: midStroke,
            height: courtH,
            backgroundColor: stroke,
            borderRadius: midStroke / 2,
          }}
        />

        {/* Círculo central */}
        <View
          style={{
            position: 'absolute',
            left: dim / 2 - centerR,
            top: dim / 2 - centerR,
            width: centerR * 2,
            height: centerR * 2,
            borderRadius: centerR,
            borderWidth: centerStroke,
            borderColor: stroke,
            backgroundColor: isSolid ? colors.primaryDark : 'transparent',
          }}
        />
      </View>

      {withWordmark ? (
        <Text
          style={[
            styles.wordmark,
            { color: wordColor, fontSize: WORD_SIZE[size] },
          ]}
        >
          canchapp
        </Text>
      ) : null}
    </View>
  )
}

/** Ícono raster listo para splash / favicon vía Image (opcional). */
export function LogoImage({
  size = 48,
  style,
}: {
  size?: number
  style?: StyleProp<ViewStyle>
}) {
  return (
    <View style={[{ width: size, height: size }, style]}>
      <Image
        source={require('../../assets/brand/canchapp-logo-icon.png')}
        style={{ width: size, height: size }}
        resizeMode="contain"
        accessibilityLabel="Canchapp"
      />
    </View>
  )
}

const styles = StyleSheet.create({
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
  },
  wordmark: {
    ...typography.h2,
    fontWeight: '800',
    letterSpacing: -0.8,
    textTransform: 'lowercase',
  },
})

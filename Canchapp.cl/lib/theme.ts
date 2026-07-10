import { Platform, type TextStyle, type ViewStyle } from 'react-native'

/** Tokens de diseño Canchapp — B2B centros deportivos */
export const colors = {
  primary: '#0B6E4F',
  primaryLight: '#E6F4EE',
  primaryDark: '#064A35',
  accent: '#22C55E',
  background: '#F4F8F6',
  surface: '#FFFFFF',
  surfaceElevated: '#FFFFFF',
  text: '#0F1A14',
  textSecondary: '#3D5248',
  textMuted: '#6B7F74',
  border: '#DDE8E2',
  borderLight: '#EEF4F0',
  danger: '#DC2626',
  dangerLight: '#FEF2F2',
  warning: '#D97706',
  warningLight: '#FFFBEB',
  success: '#15803D',
  successLight: '#ECFDF3',
  pending: '#EA580C',
  pendingLight: '#FFF7ED',
  overlay: 'rgba(6, 32, 23, 0.6)',
  tabBar: '#FFFFFF',
  // Cancha / marcador — tono de noche de partido para headers y acentos de firma
  pitch: '#0A3A2A',
  pitchDeep: '#062A1E',
  pitchLine: 'rgba(244, 248, 246, 0.16)',
  pitchRing: 'rgba(244, 248, 246, 0.4)',
  onPitch: '#F4F8F6',
  onPitchMuted: 'rgba(244, 248, 246, 0.66)',
  floodlight: '#F5B942',
  floodlightLight: 'rgba(245, 185, 66, 0.16)',
}

export const spacing = {
  xs: 4,
  sm: 8,
  md: 16,
  lg: 24,
  xl: 32,
  xxl: 48,
}

export const radii = {
  sm: 8,
  md: 12,
  lg: 16,
  xl: 20,
  full: 999,
}

/** Fuente tabular para todo dato numérico: hora, precio, conteo — el "reloj de marcador". */
export const fonts = {
  mono: 'SpaceMono',
}

export const typography = {
  hero: { fontSize: 32, fontWeight: '800' as const, letterSpacing: -0.5 },
  h1: { fontSize: 24, fontWeight: '700' as const, letterSpacing: -0.3 },
  h2: { fontSize: 18, fontWeight: '700' as const },
  h3: { fontSize: 16, fontWeight: '600' as const },
  body: { fontSize: 15, fontWeight: '400' as const, lineHeight: 22 },
  bodySm: { fontSize: 13, fontWeight: '400' as const, lineHeight: 18 },
  label: { fontSize: 13, fontWeight: '600' as const, letterSpacing: 0.2 },
  caption: { fontSize: 12, fontWeight: '500' as const },
  stat: { fontSize: 36, fontWeight: '800' as const, letterSpacing: -1 },
  /** Eyebrow de marcador: "HOY", "PENDIENTES", etc. */
  eyebrow: {
    fontSize: 11,
    fontWeight: '800' as const,
    letterSpacing: 1.4,
    textTransform: 'uppercase' as const,
  },
  /** Dígitos de marcador — horas, precios, conteos. */
  score: { fontFamily: fonts.mono, fontSize: 34, letterSpacing: -1 },
  scoreSm: { fontFamily: fonts.mono, fontSize: 15 },
  mono: { fontFamily: fonts.mono },
}

export const shadows = {
  card: Platform.select<ViewStyle>({
    ios: {
      shadowColor: '#0B6E4F',
      shadowOffset: { width: 0, height: 4 },
      shadowOpacity: 0.08,
      shadowRadius: 12,
    },
    android: { elevation: 3 },
    default: {
      boxShadow: '0 4px 16px rgba(11, 110, 79, 0.08)',
    } as ViewStyle,
  }),
  button: Platform.select<ViewStyle>({
    ios: {
      shadowColor: '#0B6E4F',
      shadowOffset: { width: 0, height: 2 },
      shadowOpacity: 0.18,
      shadowRadius: 6,
    },
    android: { elevation: 2 },
    default: {} as ViewStyle,
  }),
  /** Halo del reflector encendido — usado en el toggle de horario. */
  floodlight: Platform.select<ViewStyle>({
    ios: {
      shadowColor: '#F5B942',
      shadowOffset: { width: 0, height: 0 },
      shadowOpacity: 0.9,
      shadowRadius: 5,
    },
    android: { elevation: 3 },
    default: {
      boxShadow: '0 0 6px rgba(245, 185, 66, 0.85)',
    } as ViewStyle,
  }),
}

export const layout = {
  maxContentWidth: 720,
  screenPadding: spacing.lg,
}

export function statusColors(status: 'pending' | 'confirmed' | 'cancelled') {
  switch (status) {
    case 'confirmed':
      return { bg: colors.successLight, fg: colors.success, label: 'Confirmada' }
    case 'cancelled':
      return { bg: colors.borderLight, fg: colors.textMuted, label: 'Cancelada' }
    default:
      return { bg: colors.pendingLight, fg: colors.pending, label: 'Pendiente' }
  }
}

export const headerStyle: ViewStyle = {
  backgroundColor: colors.surface,
  borderBottomWidth: 1,
  borderBottomColor: colors.borderLight,
}

export const headerTitleStyle: TextStyle = {
  fontWeight: '700',
  fontSize: 17,
  color: colors.text,
}

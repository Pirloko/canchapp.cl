import { StyleSheet, Text, View, type ViewProps, type ViewStyle } from 'react-native'

import { colors, radii, shadows, spacing, typography } from '@/lib/theme'

type CardProps = ViewProps & {
  elevated?: boolean
  compact?: boolean
}

export function Card({
  children,
  style,
  elevated = true,
  compact,
  ...rest
}: CardProps) {
  return (
    <View
      style={[
        styles.card,
        elevated && shadows.card,
        compact && styles.compact,
        style,
      ]}
      {...rest}
    >
      {children}
    </View>
  )
}

export function CardTitle({ children }: { children: string }) {
  return <Text style={styles.title}>{children}</Text>
}

export function CardSubtitle({ children }: { children: string }) {
  return <Text style={styles.subtitle}>{children}</Text>
}

export function cardRowStyle(): ViewStyle {
  return styles.rowBetween
}

const styles = StyleSheet.create({
  card: {
    backgroundColor: colors.surface,
    borderRadius: radii.lg,
    borderWidth: 1,
    borderColor: colors.borderLight,
    padding: spacing.lg,
    marginBottom: spacing.md,
  },
  compact: {
    padding: spacing.md,
  },
  title: {
    ...typography.h2,
    color: colors.text,
    marginBottom: spacing.sm,
  },
  subtitle: {
    ...typography.bodySm,
    color: colors.textMuted,
    marginBottom: spacing.md,
  },
  rowBetween: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
})

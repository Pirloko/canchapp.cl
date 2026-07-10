import {
  ActivityIndicator,
  Pressable,
  StyleSheet,
  Text,
  type ViewStyle,
} from 'react-native'

import { colors, radii, shadows, spacing, typography } from '@/lib/theme'

type ButtonProps = {
  label: string
  onPress: () => void
  variant?: 'primary' | 'secondary' | 'danger' | 'ghost'
  size?: 'md' | 'sm'
  disabled?: boolean
  loading?: boolean
  style?: ViewStyle
  fullWidth?: boolean
}

export function Button({
  label,
  onPress,
  variant = 'primary',
  size = 'md',
  disabled,
  loading,
  style,
  fullWidth = true,
}: ButtonProps) {
  const isPrimary = variant === 'primary'
  const isDanger = variant === 'danger'
  const isSecondary = variant === 'secondary'
  const isGhost = variant === 'ghost'

  const bg = isPrimary
    ? colors.primary
    : isDanger
      ? colors.danger
      : isGhost
        ? 'transparent'
        : colors.surface
  const fg = isSecondary || isGhost ? colors.primary : '#FFFFFF'
  const border = isSecondary
    ? colors.primary
    : isGhost
      ? 'transparent'
      : bg

  return (
    <Pressable
      onPress={onPress}
      disabled={disabled || loading}
      style={({ pressed }) => [
        styles.base,
        size === 'sm' && styles.sm,
        fullWidth && styles.fullWidth,
        {
          backgroundColor: bg,
          borderColor: border,
          opacity: pressed ? 0.9 : 1,
        },
        isPrimary && shadows.button,
        (disabled || loading) && styles.disabled,
        style,
      ]}
    >
      {loading ? (
        <ActivityIndicator color={fg} size="small" />
      ) : (
        <Text
          style={[
            styles.label,
            size === 'sm' && styles.labelSm,
            { color: isDanger ? '#FFFFFF' : fg },
          ]}
        >
          {label}
        </Text>
      )}
    </Pressable>
  )
}

const styles = StyleSheet.create({
  base: {
    paddingVertical: spacing.md - 2,
    paddingHorizontal: spacing.lg,
    borderRadius: radii.md,
    borderWidth: 1.5,
    alignItems: 'center',
    justifyContent: 'center',
    minHeight: 48,
  },
  sm: {
    minHeight: 40,
    paddingVertical: spacing.sm,
    paddingHorizontal: spacing.md,
  },
  fullWidth: {
    width: '100%',
  },
  label: {
    ...typography.h3,
    fontSize: 15,
  },
  labelSm: {
    fontSize: 14,
  },
  disabled: {
    opacity: 0.45,
  },
})

import { StyleSheet, Text, TextInput, View, type TextInputProps } from 'react-native'

import { colors, radii, spacing, typography } from '@/lib/theme'

type FieldProps = TextInputProps & {
  label: string
  hint?: string
}

export function Field({ label, hint, style, ...rest }: FieldProps) {
  return (
    <View style={styles.wrap}>
      <Text style={styles.label}>{label}</Text>
      <TextInput
        placeholderTextColor={colors.textMuted}
        style={[styles.input, style]}
        {...rest}
      />
      {hint ? <Text style={styles.hint}>{hint}</Text> : null}
    </View>
  )
}

const styles = StyleSheet.create({
  wrap: {
    gap: spacing.xs + 2,
    marginBottom: spacing.md,
  },
  label: {
    ...typography.label,
    color: colors.textSecondary,
  },
  input: {
    borderWidth: 1.5,
    borderColor: colors.border,
    borderRadius: radii.md,
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.sm + 4,
    fontSize: 16,
    color: colors.text,
    backgroundColor: colors.surface,
    minHeight: 48,
  },
  hint: {
    ...typography.caption,
    color: colors.textMuted,
  },
})

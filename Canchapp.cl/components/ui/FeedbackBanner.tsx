import { StyleSheet, Text, View } from 'react-native'

import { colors, radii, spacing, typography } from '@/lib/theme'

type FeedbackBannerProps = {
  message: string
  type: 'success' | 'error' | 'info'
}

export function FeedbackBanner({ message, type }: FeedbackBannerProps) {
  const bg =
    type === 'success'
      ? colors.successLight
      : type === 'error'
        ? colors.dangerLight
        : colors.primaryLight
  const fg =
    type === 'success'
      ? colors.success
      : type === 'error'
        ? colors.danger
        : colors.primary

  return (
    <View style={[styles.wrap, { backgroundColor: bg, borderColor: fg }]}>
      <Text style={[styles.text, { color: fg }]}>{message}</Text>
    </View>
  )
}

const styles = StyleSheet.create({
  wrap: {
    borderWidth: 1,
    borderRadius: radii.md,
    padding: spacing.md,
    marginBottom: spacing.md,
  },
  text: {
    ...typography.bodySm,
    fontWeight: '600',
  },
})

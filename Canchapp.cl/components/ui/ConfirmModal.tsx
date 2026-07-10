import { Modal, StyleSheet, Text, View } from 'react-native'

import { Button } from '@/components/ui/Button'
import { CardTitle } from '@/components/ui/Card'
import { colors, radii, spacing, typography } from '@/lib/theme'

type ConfirmModalProps = {
  visible: boolean
  title: string
  message: string
  confirmLabel?: string
  cancelLabel?: string
  variant?: 'primary' | 'danger'
  loading?: boolean
  onConfirm: () => void
  onCancel: () => void
}

export function ConfirmModal({
  visible,
  title,
  message,
  confirmLabel = 'Sí',
  cancelLabel = 'No',
  variant = 'primary',
  loading,
  onConfirm,
  onCancel,
}: ConfirmModalProps) {
  return (
    <Modal visible={visible} transparent animationType="fade">
      <View style={styles.bg}>
        <View style={styles.card}>
          <CardTitle>{title}</CardTitle>
          <Text style={styles.message}>{message}</Text>
          <Button
            label={confirmLabel}
            variant={variant}
            onPress={onConfirm}
            loading={loading}
          />
          <Button
            label={cancelLabel}
            variant="secondary"
            onPress={onCancel}
            style={{ marginTop: spacing.sm }}
            disabled={loading}
          />
        </View>
      </View>
    </Modal>
  )
}

const styles = StyleSheet.create({
  bg: {
    flex: 1,
    backgroundColor: colors.overlay,
    justifyContent: 'center',
    padding: spacing.lg,
  },
  card: {
    backgroundColor: colors.surface,
    borderRadius: radii.xl,
    padding: spacing.lg,
    maxWidth: 400,
    width: '100%',
    alignSelf: 'center',
  },
  message: {
    ...typography.body,
    color: colors.textMuted,
    marginBottom: spacing.lg,
  },
})

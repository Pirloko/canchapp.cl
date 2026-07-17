import { useWindowDimensions } from 'react-native'
import { useSafeAreaInsets } from 'react-native-safe-area-context'

const COMPACT_MAX_WIDTH = 480
const DESKTOP_MIN_WIDTH = 1024

export function useIsCompactLayout(): boolean {
  const { width } = useWindowDimensions()
  return width < COMPACT_MAX_WIDTH
}

export function useIsDesktopLayout(): boolean {
  const { width } = useWindowDimensions()
  return width >= DESKTOP_MIN_WIDTH
}

export function useTabBarInsets(): { height: number; paddingBottom: number } {
  const insets = useSafeAreaInsets()
  const { width } = useWindowDimensions()
  const compact = width < COMPACT_MAX_WIDTH
  const baseHeight = compact ? 52 : 56
  const paddingBottom = Math.max(insets.bottom, compact ? 10 : 8)

  return {
    height: baseHeight + paddingBottom,
    paddingBottom,
  }
}

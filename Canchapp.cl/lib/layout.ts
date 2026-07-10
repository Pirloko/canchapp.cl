import { Platform, useWindowDimensions } from 'react-native'

const COMPACT_MAX_WIDTH = 480

export function useIsCompactLayout(): boolean {
  const { width } = useWindowDimensions()
  return width < COMPACT_MAX_WIDTH
}

export function useTabBarInsets(): { height: number; paddingBottom: number } {
  const { width } = useWindowDimensions()
  const compact = width < COMPACT_MAX_WIDTH

  if (Platform.OS === 'ios') {
    return { height: 88, paddingBottom: 24 }
  }

  if (Platform.OS === 'web' && compact) {
    return { height: 72, paddingBottom: 20 }
  }

  return { height: 64, paddingBottom: 8 }
}

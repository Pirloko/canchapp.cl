import { Ionicons } from '@expo/vector-icons'
import { Tabs } from 'expo-router'
import { useEffect } from 'react'
import { StyleSheet, View, type ColorValue } from 'react-native'
import Animated, {
  Easing,
  useAnimatedStyle,
  useSharedValue,
  withRepeat,
  withSequence,
  withSpring,
  withTiming,
} from 'react-native-reanimated'

import { AuthGate } from '@/lib/auth/use-auth-redirect'
import { useAuth } from '@/lib/auth/provider'
import { useTabBarInsets } from '@/lib/layout'
import { colors, headerStyle, headerTitleStyle } from '@/lib/theme'

type TabIconProps = {
  name: keyof typeof Ionicons.glyphMap
  color: ColorValue
  focused: boolean
}

function TabIcon({ name, color, focused }: TabIconProps) {
  const scale = useSharedValue(focused ? 1.1 : 1)
  const dotScale = useSharedValue(focused ? 1 : 0)
  const dotGlow = useSharedValue(0.5)

  useEffect(() => {
    scale.value = withSpring(focused ? 1.1 : 1, {
      damping: 14,
      stiffness: 220,
    })
    dotScale.value = withSpring(focused ? 1 : 0, {
      damping: 14,
      stiffness: 220,
    })
  }, [focused, scale, dotScale])

  useEffect(() => {
    if (!focused) return
    dotGlow.value = withRepeat(
      withSequence(
        withTiming(1, { duration: 1100, easing: Easing.inOut(Easing.ease) }),
        withTiming(0.45, { duration: 1100, easing: Easing.inOut(Easing.ease) })
      ),
      -1,
      false
    )
  }, [focused, dotGlow])

  const iconStyle = useAnimatedStyle(() => ({
    transform: [{ scale: scale.value }],
  }))

  const dotStyle = useAnimatedStyle(() => ({
    opacity: dotScale.value,
    transform: [{ scale: 0.6 + dotScale.value * 0.4 }],
    shadowOpacity: dotGlow.value,
  }))

  return (
    <View style={styles.tabIconWrap}>
      <Animated.View style={iconStyle}>
        <Ionicons
          name={focused ? name : (`${name}-outline` as keyof typeof Ionicons.glyphMap)}
          size={22}
          color={color}
        />
      </Animated.View>
      <Animated.View
        style={[
          styles.tabDot,
          styles.tabDotOn,
          dotStyle,
        ]}
      />
    </View>
  )
}

export default function TabsLayout() {
  const { venue } = useAuth()
  const tabInsets = useTabBarInsets()

  return (
    <AuthGate expect="app">
      <Tabs
        screenOptions={{
          tabBarActiveTintColor: colors.primary,
          tabBarInactiveTintColor: colors.textMuted,
          tabBarLabelStyle: styles.tabLabel,
          tabBarStyle: [
            styles.tabBar,
            {
              height: tabInsets.height,
              paddingBottom: tabInsets.paddingBottom,
            },
          ],
          headerStyle,
          headerTitleStyle,
          headerShadowVisible: false,
          headerTintColor: colors.text,
        }}
      >
        <Tabs.Screen
          name="resumen"
          options={{
            title: venue?.name ?? 'Resumen',
            headerShown: false,
            tabBarLabel: 'Resumen',
            tabBarIcon: ({ color, focused }) => (
              <TabIcon name="stats-chart" color={color} focused={focused} />
            ),
          }}
        />
        <Tabs.Screen
          name="reservas"
          options={{
            title: 'Reservas',
            tabBarIcon: ({ color, focused }) => (
              <TabIcon name="calendar" color={color} focused={focused} />
            ),
          }}
        />
        <Tabs.Screen
          name="canchas"
          options={{
            title: 'Canchas',
            tabBarIcon: ({ color, focused }) => (
              <TabIcon name="grid" color={color} focused={focused} />
            ),
          }}
        />
        <Tabs.Screen
          name="horario"
          options={{
            title: 'Horario',
            tabBarIcon: ({ color, focused }) => (
              <TabIcon name="time" color={color} focused={focused} />
            ),
          }}
        />
        <Tabs.Screen
          name="perfil"
          options={{
            title: 'Perfil',
            tabBarIcon: ({ color, focused }) => (
              <TabIcon name="settings" color={color} focused={focused} />
            ),
          }}
        />
      </Tabs>
    </AuthGate>
  )
}

const styles = StyleSheet.create({
  tabBar: {
    backgroundColor: colors.tabBar,
    borderTopColor: colors.borderLight,
    borderTopWidth: 1,
    paddingTop: 6,
  },
  tabLabel: {
    fontSize: 10,
    fontWeight: '600',
    marginTop: 2,
    marginBottom: 2,
  },
  tabIconWrap: {
    alignItems: 'center',
  },
  tabDot: {
    width: 4,
    height: 4,
    borderRadius: 2,
    marginTop: 4,
    backgroundColor: 'transparent',
  },
  tabDotOn: {
    backgroundColor: colors.floodlight,
    shadowColor: colors.floodlight,
    shadowOffset: { width: 0, height: 0 },
    shadowRadius: 5,
    elevation: 3,
  },
})

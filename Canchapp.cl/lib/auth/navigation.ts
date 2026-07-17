import type { AuthRoute } from '@/lib/types'

export function pathForAuthRoute(route: AuthRoute): string {
  switch (route) {
    case 'login':
      return '/login'
    case 'denied':
      return '/denied'
    case 'onboarding':
      return '/onboarding'
    case 'app':
      return '/(tabs)/resumen'
    default:
      return '/'
  }
}

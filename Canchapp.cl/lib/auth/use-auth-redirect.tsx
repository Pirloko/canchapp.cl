import { Redirect, useRouter } from 'expo-router'
import { useEffect, type ReactNode } from 'react'

import { pathForAuthRoute } from '@/lib/auth/navigation'
import { useAuth } from '@/lib/auth/provider'
import type { AuthRoute } from '@/lib/types'

/** Redirige cuando la sesión cambia (login, logout, onboarding). */
export function useAuthRedirect(activeRoute: AuthRoute) {
  const { loading, route } = useAuth()
  const router = useRouter()

  useEffect(() => {
    if (loading || route === activeRoute) return
    router.replace(pathForAuthRoute(route) as never)
  }, [loading, route, activeRoute, router])

  return { loading, route }
}

type AuthGateProps = {
  expect: AuthRoute
  children: ReactNode
}

/** Bloquea pantallas hasta que `route` coincida con `expect`. */
export function AuthGate({ expect, children }: AuthGateProps) {
  const { loading, route } = useAuth()

  if (loading) return null
  if (route !== expect) {
    return <Redirect href={pathForAuthRoute(route) as never} />
  }
  return children
}

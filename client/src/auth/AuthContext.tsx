import { createContext, useContext, useEffect, useRef, type ReactNode } from 'react'
import { useQuery, useQueryClient } from '@tanstack/react-query'
import { api } from '@/api/client'
import { authApi, type AuthUser } from '@/api/auth'
import type { Me } from '@/api/types'
import { useToast } from '@/components/ui'

type Ctx = {
  /** Student from the real API (server/). null when signed out. */
  user: AuthUser | null
  /** Profile with XP, rank and courses, from GET /api/me. null when signed out. */
  me: Me | null
  /** True until we know whether a session exists, so the Login page never flashes. */
  loading: boolean
  login: (email: string, password: string) => Promise<void>
  /** Takes over a session the server just started (after sign-up verification or a password reset). */
  adopt: (user: AuthUser) => void
  logout: () => Promise<void>
}
const AuthCtx = createContext<Ctx>(null!)
export const useAuth = () => useContext(AuthCtx)

export function AuthProvider({ children }: { children: ReactNode }) {
  const qc = useQueryClient()
  const toast = useToast()

  // Source of truth: GET /api/auth/me. Re-checked when the tab regains focus, so an expired cookie signs you out.
  const auth = useQuery({ queryKey: ['auth'], queryFn: authApi.me, staleTime: 5 * 60_000, refetchOnWindowFocus: true })
  const user = auth.data ?? null

  // Profile with XP from the server (GET /api/me), polled so XP earned from peers shows up.
  // Every 20 s and when the tab comes back: each call ranks all students on the server, so not more often.
  const profile = useQuery({
    queryKey: ['me'],
    queryFn: api.me.get,
    enabled: !!user,
    refetchInterval: 20_000,
    refetchOnWindowFocus: true,
  })
  const me = user ? profile.data ?? null : null
  const last = useRef<number | null>(null)

  // Celebrate XP the server awarded (earned from peers, never claimed by the client).
  useEffect(() => {
    if (!me) { last.current = null; return }
    if (last.current !== null && me.xp > last.current) {
      toast(`+${me.xp - last.current} XP. A classmate found your post useful.`, 'xp')
      qc.invalidateQueries({ queryKey: ['leaderboard'] })
    }
    last.current = me.xp
  }, [me, toast, qc])

  // A new student on this browser (a shared lab PC) must never see what the previous one had loaded.
  const adopt = (u: AuthUser) => {
    qc.clear()
    qc.setQueryData(['auth'], u)
  }

  // Any 401 from the API means the session is gone: forget everything and show the sign-in page.
  useEffect(() => {
    const onSignedOut = () => { qc.clear(); qc.setQueryData(['auth'], null) }
    window.addEventListener('smuhub:signed-out', onSignedOut)
    return () => window.removeEventListener('smuhub:signed-out', onSignedOut)
  }, [qc])

  const value: Ctx = {
    user,
    me,
    loading: auth.isPending || (!!user && profile.isPending),
    login: async (email, password) => { adopt(await authApi.login(email, password)) },
    adopt,
    logout: async () => {
      try {
        await authApi.logout()
      } catch {
        toast('Signed out on this device only: the server is not responding.', 'err')
      } finally {
        qc.clear()
        qc.setQueryData(['auth'], null)
      }
    },
  }
  return <AuthCtx.Provider value={value}>{children}</AuthCtx.Provider>
}

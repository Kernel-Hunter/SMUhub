import { createContext, useContext, useEffect, useRef, type ReactNode } from 'react'
import { useQuery, useQueryClient } from '@tanstack/react-query'
import { api } from '@/api/mock'
import { authApi, type AuthUser } from '@/api/auth'
import type { Me } from '@/api/types'
import { useToast } from '@/components/ui'

type Ctx = {
  /** Student from the real API (server/). null when signed out. */
  user: AuthUser | null
  /** Profile with XP, rank and uploads, still served by the mock. null when signed out. */
  me: Me | null
  /** True until we know whether a session exists, so the Login page never flashes. */
  loading: boolean
  login: (email: string, password: string) => Promise<void>
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

  // Gamified profile from the mock, for the student the server says is signed in.
  const profile = useQuery({
    queryKey: ['me'],
    queryFn: () => { api.bridge.attach(user!); return api.auth.session() },
    enabled: !!user,
    refetchInterval: 4000,
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

  const value: Ctx = {
    user,
    me,
    loading: auth.isPending || (!!user && profile.isPending),
    login: async (email, password) => {
      const u = await authApi.login(email, password)
      api.bridge.attach(u)
      qc.removeQueries({ queryKey: ['me'] })
      qc.setQueryData(['auth'], u)
    },
    logout: async () => {
      try {
        await authApi.logout()
      } catch {
        toast('Déconnexion locale : le serveur ne répond pas.', 'err')
      } finally {
        api.bridge.detach()
        qc.clear()
        qc.setQueryData(['auth'], null)
      }
    },
  }
  return <AuthCtx.Provider value={value}>{children}</AuthCtx.Provider>
}

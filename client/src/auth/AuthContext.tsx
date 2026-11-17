import { createContext, useContext, useEffect, useRef, type ReactNode } from 'react'
import { useQuery, useQueryClient } from '@tanstack/react-query'
import { api } from '@/api/mock'
import type { Me } from '@/api/types'
import { useToast } from '@/components/ui'

type Ctx = { me: Me | null; loading: boolean; login: (u: string, p: string) => Promise<void>; logout: () => Promise<void> }
const AuthCtx = createContext<Ctx>(null!)
export const useAuth = () => useContext(AuthCtx)

export function AuthProvider({ children }: { children: ReactNode }) {
  const qc = useQueryClient()
  const toast = useToast()
  const { data: me = null, isLoading } = useQuery({ queryKey: ['me'], queryFn: api.auth.session, refetchInterval: 4000 })
  const last = useRef<number | null>(null)

  // Celebrate XP the server awarded (earned from peers, never claimed by the client).
  useEffect(() => {
    if (!me) { last.current = null; return }
    if (last.current !== null && me.xp > last.current) {
      toast(`+${me.xp - last.current} XP · your contribution helped a classmate`, 'xp')
      qc.invalidateQueries({ queryKey: ['leaderboard'] })
    }
    last.current = me.xp
  }, [me, toast, qc])

  const value: Ctx = {
    me, loading: isLoading,
    login: async (u, p) => { const m = await api.auth.login(u, p); qc.setQueryData(['me'], m) },
    logout: async () => { await api.auth.logout(); qc.clear(); qc.setQueryData(['me'], null) },
  }
  return <AuthCtx.Provider value={value}>{children}</AuthCtx.Provider>
}

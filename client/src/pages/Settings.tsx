import { useState, type FormEvent } from 'react'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { Monitor, Moon, Sun } from 'lucide-react'
import { api } from '@/api/mock'
import { useAuth } from '@/auth/AuthContext'
import { Field, PageHeader, Spinner, useToast } from '@/components/ui'
import { cn, errMsg, timeAgo } from '@/lib/utils'

function applyTheme(t: 'light' | 'dark' | 'system') {
  try { localStorage.setItem('smuhub.theme', t) } catch { /* ignore */ }
  document.documentElement.classList.toggle('dark', t === 'dark' || (t === 'system' && matchMedia('(prefers-color-scheme: dark)').matches))
}

export default function Settings() {
  const { me } = useAuth(); const qc = useQueryClient(); const toast = useToast()
  const [f, setF] = useState({ name: me?.name ?? '', major: me?.major ?? '', year: me?.year ?? 1, bio: me?.bio ?? '' })
  const [theme, setTheme] = useState<string>(() => { try { return localStorage.getItem('smuhub.theme') ?? 'system' } catch { return 'system' } })
  const xp = useQuery({ queryKey: ['xp'], queryFn: api.me.xp, refetchInterval: 5000 })
  const save = useMutation({ mutationFn: () => api.me.update(f), onSuccess: (m) => { qc.setQueryData(['me'], m); toast('Profile saved.') }, onError: (e) => toast(errMsg(e), 'err') })
  const submit = (e: FormEvent) => { e.preventDefault(); save.mutate() }
  return (
    <div className="mx-auto max-w-2xl">
      <PageHeader title="Settings" />
      <section className="card mb-6 p-5"><h2 className="display mb-3 text-xl">Appearance</h2>
        <div className="grid grid-cols-3 gap-3">{([['light', Sun], ['dark', Moon], ['system', Monitor]] as const).map(([k, Icon]) => (
          <button key={k} onClick={() => { setTheme(k); applyTheme(k) }} className={cn('flex flex-col items-center gap-2 rounded-xl border p-4 text-sm font-medium capitalize transition', theme === k ? 'border-ink bg-paper' : 'border-line text-muted hover:text-ink')}><Icon size={18} />{k}</button>))}</div></section>
      <form onSubmit={submit} className="card mb-6 grid gap-4 p-5"><h2 className="display text-xl">Profile</h2>
        <Field label="Display name" hint="Synced from Moodle on sign-in in production."><input className="field" maxLength={50} value={f.name} onChange={(e) => setF({ ...f, name: e.target.value })} /></Field>
        <div className="grid gap-4 sm:grid-cols-2"><Field label="Major"><input className="field" maxLength={40} value={f.major} onChange={(e) => setF({ ...f, major: e.target.value })} /></Field><Field label="Year"><select className="field" value={f.year} onChange={(e) => setF({ ...f, year: +e.target.value })}>{[1, 2, 3, 4, 5, 6].map((y) => <option key={y} value={y}>Year {y}</option>)}</select></Field></div>
        <Field label="Bio"><textarea className="field min-h-20" maxLength={240} value={f.bio} onChange={(e) => setF({ ...f, bio: e.target.value })} /></Field>
        <button className="btn btn-primary justify-self-end" disabled={save.isPending}>{save.isPending ? <Spinner /> : 'Save changes'}</button></form>
      <section className="card p-5"><h2 className="display mb-3 text-xl">XP activity</h2>
        {xp.data?.length ? <ul className="grid gap-2">{xp.data.map((x) => <li key={x.id} className="flex items-center gap-3 text-sm"><span className={cn('num w-12 font-semibold', x.points < 0 ? 'text-rose' : 'text-moss')}>{x.points > 0 ? '+' : ''}{x.points}</span><span className="min-w-0 flex-1 truncate text-muted">{x.label}</span><span className="text-xs text-faint">{timeAgo(x.at)}</span></li>)}</ul> : <p className="text-sm text-muted">No XP yet. Upload a resource or answer a question.</p>}</section>
      <button className="btn btn-ghost mt-6 text-xs" onClick={() => confirm('Reset all demo data?') && api.dev.reset()}>Reset demo data</button>
    </div>
  )
}

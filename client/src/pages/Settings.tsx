import { useState, type FormEvent } from 'react'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { Check, RotateCcw, Settings as Cog } from 'lucide-react'
import { api } from '@/api/mock'
import { useAuth } from '@/auth/AuthContext'
import Banner from '@/components/Banner'
import { Avatar, Field, Spinner, useToast } from '@/components/ui'
import { cn, errMsg, timeAgo } from '@/lib/utils'

type Theme = 'light' | 'dark' | 'system'
function applyTheme(t: Theme) {
  try { localStorage.setItem('smuhub.theme', t) } catch { /* ignore */ }
  document.documentElement.classList.toggle('dark', t === 'dark' || (t === 'system' && matchMedia('(prefers-color-scheme: dark)').matches))
}

function Preview({ dark }: { dark: boolean }) {
  const bg = dark ? '#10161d' : '#f6f8fa', side = dark ? '#161e26' : '#ffffff', line = dark ? '#2a3541' : '#dfe4ea'
  return (
    <span className="flex h-full w-full" style={{ background: bg }}>
      <span className="w-[30%] p-2" style={{ background: side, borderRight: `1px solid ${line}` }}><span className="block h-1.5 w-3/4 rounded-full bg-[#007fa4]" /><span className="mt-2 block h-1 w-1/2 rounded-full" style={{ background: line }} /><span className="mt-1 block h-1 w-2/3 rounded-full" style={{ background: line }} /></span>
      <span className="flex-1 p-2"><span className="block h-5 rounded-sm" style={{ background: side, border: `1px solid ${line}` }} /><span className="mt-2 grid grid-cols-2 gap-1"><span className="h-4 rounded-sm" style={{ background: side, border: `1px solid ${line}` }} /><span className="h-4 rounded-sm" style={{ background: side, border: `1px solid ${line}` }} /></span></span>
    </span>
  )
}

export default function Settings() {
  const { me } = useAuth(); const qc = useQueryClient(); const toast = useToast()
  const [f, setF] = useState({ name: me?.name ?? '', major: me?.major ?? '', year: me?.year ?? 1, bio: me?.bio ?? '' })
  const [theme, setTheme] = useState<Theme>(() => { try { return (localStorage.getItem('smuhub.theme') as Theme) ?? 'light' } catch { return 'light' } })
  const xp = useQuery({ queryKey: ['xp'], queryFn: api.me.xp, refetchInterval: 5000 })
  const save = useMutation({ mutationFn: () => api.me.update(f), onSuccess: (m) => { qc.setQueryData(['me'], m); toast('Profile saved.') }, onError: (e) => toast(errMsg(e), 'err') })
  const submit = (e: FormEvent) => { e.preventDefault(); save.mutate() }
  const total = (xp.data ?? []).reduce((s, x) => s + x.points, 0)
  return (
    <div>
      <Banner tone="blue" icon={<Cog size={13} />} label="Settings" title="Your account" sub="Your name and photo come from Moodle. Everything else here is yours to change." />
      <div className="grid gap-6 lg:grid-cols-[minmax(0,1fr)_340px]">
        <div className="grid content-start gap-6">
          <form onSubmit={submit} className="card grid gap-5 p-6">
            <div className="flex items-center gap-4"><Avatar user={me ?? null} size={52} /><div><p className="text-base font-semibold">Profile</p><p className="text-xs text-muted">Shown on your uploads, answers and public posts.</p></div></div>
            <Field label="Display name" hint="Synced from Moodle on sign-in in production."><input className="field" maxLength={50} value={f.name} onChange={(e) => setF({ ...f, name: e.target.value })} /></Field>
            <div className="grid gap-4 sm:grid-cols-2"><Field label="Major"><input className="field" maxLength={40} value={f.major} onChange={(e) => setF({ ...f, major: e.target.value })} /></Field><Field label="Year"><select className="field" value={f.year} onChange={(e) => setF({ ...f, year: +e.target.value })}>{[1, 2, 3, 4, 5, 6].map((y) => <option key={y} value={y}>Year {y}</option>)}</select></Field></div>
            <Field label="Bio"><textarea className="field min-h-24" maxLength={240} value={f.bio} onChange={(e) => setF({ ...f, bio: e.target.value })} placeholder="What you study, what you can help with" /></Field>
            <div className="flex justify-end border-t border-line pt-5"><button className="btn btn-primary h-10 px-6" disabled={save.isPending}>{save.isPending ? <Spinner /> : 'Save changes'}</button></div>
          </form>

          <section className="card p-6">
            <p className="text-base font-semibold">Appearance</p><p className="text-xs text-muted">Light is the default. System follows your device.</p>
            <div className="mt-4 grid grid-cols-3 gap-3">{(['light', 'dark', 'system'] as const).map((k) => (
              <button key={k} onClick={() => { setTheme(k); applyTheme(k) }} className="group text-left">
                <span className={cn('relative block h-24 overflow-hidden rounded-lg ring-2 transition', theme === k ? 'ring-accent' : 'ring-line group-hover:ring-line-strong')}>
                  {k === 'system' ? <span className="flex h-full"><span className="w-1/2 overflow-hidden"><span className="block h-full w-[200%]"><Preview dark={false} /></span></span><span className="w-1/2 overflow-hidden"><span className="block h-full w-[200%] -translate-x-1/2"><Preview dark /></span></span></span> : <Preview dark={k === 'dark'} />}
                  {theme === k && <span className="absolute right-2 top-2 grid size-5 place-items-center rounded-full bg-accent-fill text-on-accent"><Check size={12} /></span>}
                </span>
                <span className={cn('mt-2 block text-sm font-medium capitalize', theme === k ? 'text-ink' : 'text-muted')}>{k}</span>
              </button>))}</div>
          </section>
        </div>

        <aside className="grid h-fit gap-4 lg:sticky lg:top-16">
          <section className="card overflow-hidden">
            <div className="border-b border-line px-5 py-4"><p className="text-xs text-muted">Points earned so far</p><p className="num text-2xl font-semibold text-heading">{total}</p></div>
            <div className="p-5">
              <p className="mb-3 text-sm font-semibold">Recent activity</p>
              {xp.data?.length ? <ul className="grid gap-3">{xp.data.slice(0, 12).map((x) => <li key={x.id} className="flex items-center gap-3 text-sm"><span className={cn('num grid h-6 w-11 shrink-0 place-items-center rounded-sm text-xs font-semibold', x.points < 0 ? 'bg-danger-soft text-danger' : 'bg-success-soft text-success')}>{x.points > 0 ? '+' : ''}{x.points}</span><span className="min-w-0 flex-1 truncate text-muted">{x.label}</span><span className="shrink-0 text-xs text-faint">{timeAgo(x.at)}</span></li>)}</ul> : <p className="text-sm text-muted">No points yet. Upload a file or answer a question.</p>}
            </div>
          </section>
          <section className="card p-5">
            <p className="text-sm font-semibold">Demo data</p><p className="mt-1 text-xs text-muted">This preview keeps everything in your browser. Reset puts the sample content back.</p>
            <button className="btn btn-secondary btn-sm mt-3 text-danger" onClick={() => confirm('Reset all demo data?') && api.dev.reset()}><RotateCcw size={13} />Reset demo data</button>
          </section>
        </aside>
      </div>
    </div>
  )
}

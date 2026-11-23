import { useState, type FormEvent } from 'react'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { BookOpen, Calculator, FlaskConical, Handshake, KeyRound, Laptop, Package, Plus, ShieldAlert, X } from 'lucide-react'
import { api } from '@/api/client'
import Banner, { bannerBtn } from '@/components/Banner'
import { Avatar, Empty, ErrorBox, Field, Skeleton, Spinner, useToast } from '@/components/ui'
import { RENTAL_LABEL, cn, errMsg, formatDay } from '@/lib/utils'
import type { RentalCategory, RentalItem } from '@/api/types'

const day = 86400000
const iso = (t: number) => new Date(t).toISOString().slice(0, 10)
const CAT: Record<RentalCategory, { icon: typeof Calculator; soft: string }> = {
  calculator: { icon: Calculator, soft: 'bg-subtle text-muted' },
  lab: { icon: FlaskConical, soft: 'bg-subtle text-muted' },
  books: { icon: BookOpen, soft: 'bg-subtle text-muted' },
  tech: { icon: Laptop, soft: 'bg-subtle text-muted' },
  other: { icon: Package, soft: 'bg-subtle text-muted' },
}

function ItemCard({ it }: { it: RentalItem }) {
  const qc = useQueryClient(); const toast = useToast(); const c = CAT[it.category]; const Icon = c.icon
  const [ask, setAsk] = useState(false); const [from, setFrom] = useState(iso(Date.now())); const [to, setTo] = useState(iso(Date.now() + 2 * day)); const [note, setNote] = useState('')
  const done = () => { qc.invalidateQueries({ queryKey: ['rentals'] }); qc.invalidateQueries({ queryKey: ['incoming'] }) }
  const req = useMutation({ mutationFn: () => api.rentals.request(it.id, new Date(from).getTime(), new Date(to).getTime(), note), onSuccess: () => { setAsk(false); toast('Request sent to the owner.'); done() }, onError: (e) => toast(errMsg(e), 'err') })
  const back = useMutation({ mutationFn: () => api.rentals.markReturned(it.id), onSuccess: () => { toast('Marked as returned.'); done() }, onError: (e) => toast(errMsg(e), 'err') })
  const r = it.myRequest
  return (
    <div className="card card-hover flex flex-col overflow-hidden">
      <div className="flex items-center justify-between border-b border-line px-5 py-4">
        <span className={cn('grid size-10 place-items-center rounded-md', c.soft)}><Icon size={20} /></span>
        <span className={cn('chip', it.available ? 'bg-success-soft text-success' : 'bg-subtle text-muted')}>{it.available ? 'Available' : 'Rented out'}</span>
      </div>
      <div className="flex flex-1 flex-col p-5">
        <p className="text-xs font-medium text-muted">{RENTAL_LABEL[it.category]} · {it.condition}</p>
        <h3 className="mt-1 text-base font-semibold leading-snug">{it.title}</h3>
        <p className="mt-1 line-clamp-2 flex-1 text-sm text-muted">{it.description}</p>
        <div className="mt-4 flex items-end justify-between gap-3">
          <p><span className="num text-2xl font-semibold leading-none tracking-tight">{it.pricePerDay}</span><span className="ml-1 text-xs text-muted">TND / day</span></p>
          <span className="chip num">{it.deposit} TND deposit</span>
        </div>
        <p className="mt-4 flex items-center gap-2 border-t border-line pt-3 text-xs text-muted"><Avatar user={it.owner} size={22} /><span className="font-medium text-ink">{it.owner.name}</span>{it.mine && <span className="chip ml-auto">You</span>}</p>
        {r?.status === 'accepted' && <p className="mt-3 flex items-center gap-2 rounded-md bg-success-soft p-3 text-sm text-success"><KeyRound size={15} />Accepted. Contact: <strong>{r.contact}</strong></p>}
        {r?.status === 'pending' && <p className="mt-3 rounded-md border border-line bg-subtle p-3 text-sm text-muted">Waiting for the owner · {formatDay(r.from)} to {formatDay(r.to)}</p>}
        {r?.status === 'declined' && <p className="mt-3 rounded-md bg-danger-soft p-3 text-sm text-danger">Your last request was declined.</p>}
        {it.mine ? (it.available ? <p className="mt-3 text-xs text-muted">{it.pendingRequests ? `${it.pendingRequests} pending ${it.pendingRequests === 1 ? 'request' : 'requests'}` : 'No requests yet'}</p> : <button className="btn btn-ghost mt-3" onClick={() => back.mutate()}>Mark as returned</button>)
          : it.available && (!r || r.status === 'declined' || r.status === 'returned') && (ask ? (
            <form className="mt-3 grid gap-2" onSubmit={(e: FormEvent) => { e.preventDefault(); req.mutate() }}>
              <div className="grid grid-cols-2 gap-2"><input className="field" type="date" value={from} min={iso(Date.now())} onChange={(e) => setFrom(e.target.value)} aria-label="From" /><input className="field" type="date" value={to} min={from} onChange={(e) => setTo(e.target.value)} aria-label="To" /></div>
              <input className="field" placeholder="Short note (optional)" maxLength={200} value={note} onChange={(e) => setNote(e.target.value)} />
              <div className="flex gap-2"><button className="btn btn-primary flex-1" disabled={req.isPending}>{req.isPending ? <Spinner /> : 'Send request'}</button><button type="button" className="btn btn-ghost" onClick={() => setAsk(false)}>Cancel</button></div>
            </form>) : <button className="btn btn-primary mt-3" onClick={() => setAsk(true)}>Request to rent</button>)}
      </div>
    </div>
  )
}

export default function Rentals() {
  const qc = useQueryClient(); const toast = useToast()
  const [cat, setCat] = useState<RentalCategory | 'all'>('all'); const [open, setOpen] = useState(false); const [err, setErr] = useState('')
  const [f, setF] = useState({ title: '', category: 'calculator' as RentalCategory, pricePerDay: 2, deposit: 20, condition: 'good' as 'new' | 'good' | 'worn', description: '', contact: '' })
  const list = useQuery({ queryKey: ['rentals'], queryFn: api.rentals.list })
  const incoming = useQuery({ queryKey: ['incoming'], queryFn: api.rentals.incoming })
  const respond = useMutation({ mutationFn: (v: { id: string; ok: boolean }) => api.rentals.respond(v.id, v.ok), onSuccess: () => { qc.invalidateQueries({ queryKey: ['rentals'] }); qc.invalidateQueries({ queryKey: ['incoming'] }) }, onError: (e) => toast(errMsg(e), 'err') })
  const create = useMutation({ mutationFn: () => api.rentals.create(f), onSuccess: () => { qc.invalidateQueries({ queryKey: ['rentals'] }); setOpen(false); toast('Item listed.') }, onError: (e) => setErr(errMsg(e)) })
  const all = list.data ?? []
  const items = all.filter((i) => cat === 'all' || i.category === cat)
  const pill = (on: boolean) => cn('flex h-9 shrink-0 items-center gap-2 rounded-sm border px-4 text-sm font-medium transition-colors', on ? 'border-accent bg-accent-soft text-accent' : 'border-line bg-surface text-muted hover:text-ink')
  return (
    <div>
      <Banner tone="green" icon={<Handshake size={13} />} label="Rentals" title="Borrow it from a classmate" sub="Calculators, lab coats, books and chargers. You see the owner's contact once they accept."
        stats={[['Listed', all.length], ['Available', all.filter((i) => i.available).length], ['Yours', all.filter((i) => i.mine).length]]}
        action={<button className={bannerBtn} onClick={() => setOpen(!open)}>{open ? <X size={15} /> : <Plus size={15} />}{open ? 'Close' : 'List an item'}</button>} />

      {open && (
        <form className="card rise mb-7 grid gap-4 p-6 sm:grid-cols-2" onSubmit={(e) => { e.preventDefault(); setErr(''); create.mutate() }}>
          <div className="sm:col-span-2"><Field label="Item"><input className="field" required maxLength={80} value={f.title} onChange={(e) => setF({ ...f, title: e.target.value })} placeholder="Casio fx-991EX" /></Field></div>
          <div className="sm:col-span-2"><span className="label">Category</span><div className="flex flex-wrap gap-2">{(Object.keys(CAT) as RentalCategory[]).map((k) => { const I = CAT[k].icon; return <button type="button" key={k} onClick={() => setF({ ...f, category: k })} className={cn('chip h-9 cursor-pointer gap-2 px-3 text-xs transition', f.category === k ? CAT[k].soft + ' ring-1 ring-current' : 'hover:text-ink')}><I size={14} />{RENTAL_LABEL[k]}</button> })}</div></div>
          <Field label="Condition"><select className="field" value={f.condition} onChange={(e) => setF({ ...f, condition: e.target.value as typeof f.condition })}><option value="new">New</option><option value="good">Good</option><option value="worn">Worn</option></select></Field>
          <div className="grid grid-cols-2 gap-3"><Field label="TND per day"><input className="field" type="number" min={0} max={200} value={f.pricePerDay} onChange={(e) => setF({ ...f, pricePerDay: +e.target.value })} /></Field><Field label="Deposit"><input className="field" type="number" min={0} max={2000} value={f.deposit} onChange={(e) => setF({ ...f, deposit: +e.target.value })} /></Field></div>
          <div className="sm:col-span-2"><Field label="Description"><textarea className="field min-h-20" maxLength={400} value={f.description} onChange={(e) => setF({ ...f, description: e.target.value })} /></Field></div>
          <div className="sm:col-span-2"><Field label="Private contact" hint="WhatsApp, Telegram or Instagram. Only shown to a renter once you accept."><input className="field" required maxLength={80} value={f.contact} onChange={(e) => setF({ ...f, contact: e.target.value })} /></Field></div>
          {err && <p role="alert" className="rounded-md bg-danger-soft px-3 py-2 text-sm text-danger sm:col-span-2">{err}</p>}
          <div className="flex justify-end sm:col-span-2"><button className="btn btn-primary h-10 px-6" disabled={create.isPending}>{create.isPending ? <Spinner /> : 'Publish listing'}</button></div>
        </form>
      )}

      <div className="grid gap-6 xl:grid-cols-[minmax(0,1fr)_290px]">
        <section className="min-w-0">
          <div className="-mx-1 mb-5 flex gap-2 overflow-x-auto px-1 pb-1">
            <button className={pill(cat === 'all')} onClick={() => setCat('all')}>All<span className="num text-xs opacity-60">{all.length}</span></button>
            {(Object.keys(CAT) as RentalCategory[]).map((k) => { const I = CAT[k].icon; return <button key={k} className={pill(cat === k)} onClick={() => setCat(k)}><span className={cn('grid size-5 place-items-center rounded-full', cat === k ? '' : CAT[k].soft)}><I size={12} /></span>{RENTAL_LABEL[k]}<span className="num text-xs opacity-60">{all.filter((i) => i.category === k).length}</span></button> })}
          </div>
          {list.isLoading ? <Skeleton rows={3} /> : list.error ? <ErrorBox error={list.error} /> : !items.length ? <Empty title="No items yet" hint="List something you do not need every day." /> : <div className="grid gap-4 stagger sm:grid-cols-2 2xl:grid-cols-3">{items.map((i) => <ItemCard key={i.id} it={i} />)}</div>}
        </section>

        <aside className="grid h-fit gap-4 xl:sticky xl:top-16">
          <div className="card p-5">
            <p className="flex items-center justify-between text-sm font-semibold">Requests for your items{!!incoming.data?.length && <span className="num grid size-6 place-items-center rounded-full bg-accent-fill text-xs text-on-accent">{incoming.data.length}</span>}</p>
            {!incoming.data?.length ? <p className="mt-2 text-xs text-muted">Nobody has asked yet. Requests show up here.</p> : (
              <ul className="mt-3 grid gap-3">{incoming.data.map((q) => (
                <li key={q.id} className="rounded-lg bg-hover p-3">
                  <p className="flex items-center gap-2 text-sm"><Avatar user={q.renter} size={26} /><span className="min-w-0"><strong className="block truncate">{q.renter.name}</strong><span className="text-xs text-muted">{formatDay(q.from)} to {formatDay(q.to)}</span></span></p>
                  {q.note && <p className="mt-2 text-xs text-muted">"{q.note}"</p>}
                  <div className="mt-3 flex gap-2"><button className="btn btn-primary btn-sm flex-1" onClick={() => respond.mutate({ id: q.id, ok: true })}>Accept</button><button className="btn btn-ghost btn-sm flex-1" onClick={() => respond.mutate({ id: q.id, ok: false })}>Decline</button></div>
                </li>))}</ul>
            )}
          </div>
          <div className="card p-5">
            <p className="mb-3 text-sm font-semibold">How it works</p>
            <ol className="grid gap-3 text-xs text-muted">{['Send a request with your dates.', 'The owner accepts and you get their contact.', 'Meet on campus and check the item together.', 'Bring it back. The owner marks it returned.'].map((s, i) => <li key={s} className="flex gap-3"><span className="num grid size-6 shrink-0 place-items-center rounded-full bg-subtle text-xs font-semibold text-muted">{i + 1}</span><span className="pt-1">{s}</span></li>)}</ol>
          </div>
          <p className="flex gap-2 rounded-md border border-line bg-surface p-4 text-xs leading-relaxed text-muted"><ShieldAlert size={15} className="mt-1 shrink-0" />No money moves through SMUhub. Agree on the deposit in person and keep it simple.</p>
        </aside>
      </div>
    </div>
  )
}

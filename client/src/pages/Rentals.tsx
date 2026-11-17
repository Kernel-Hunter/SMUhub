import { useState, type FormEvent } from 'react'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { Plus, KeyRound, ShieldAlert } from 'lucide-react'
import { api } from '@/api/mock'
import { Avatar, Chip, Empty, ErrorBox, Field, PageHeader, Segmented, Skeleton, Spinner, useToast } from '@/components/ui'
import { RENTAL_LABEL, errMsg, formatDay } from '@/lib/utils'
import type { RentalCategory, RentalItem } from '@/api/types'

const day = 86400000
const iso = (t: number) => new Date(t).toISOString().slice(0, 10)

function ItemCard({ it }: { it: RentalItem }) {
  const qc = useQueryClient(); const toast = useToast()
  const [ask, setAsk] = useState(false); const [from, setFrom] = useState(iso(Date.now())); const [to, setTo] = useState(iso(Date.now() + 2 * day)); const [note, setNote] = useState('')
  const done = () => { qc.invalidateQueries({ queryKey: ['rentals'] }); qc.invalidateQueries({ queryKey: ['incoming'] }) }
  const req = useMutation({ mutationFn: () => api.rentals.request(it.id, new Date(from).getTime(), new Date(to).getTime(), note), onSuccess: () => { setAsk(false); toast('Request sent to the owner.'); done() }, onError: (e) => toast(errMsg(e), 'err') })
  const back = useMutation({ mutationFn: () => api.rentals.markReturned(it.id), onSuccess: () => { toast('Marked as returned.'); done() }, onError: (e) => toast(errMsg(e), 'err') })
  const r = it.myRequest
  return (
    <div className="card flex flex-col p-5">
      <div className="flex items-start justify-between gap-3"><Chip>{RENTAL_LABEL[it.category]}</Chip><Chip tone={it.available ? 'bg-moss-soft text-moss' : 'bg-gold-soft text-gold'}>{it.available ? 'Available' : 'Rented out'}</Chip></div>
      <h3 className="display mt-3 text-xl font-medium leading-snug">{it.title}</h3>
      <p className="mt-1 flex-1 text-sm text-muted">{it.description}</p>
      <p className="mt-4 flex items-baseline gap-2"><span className="display num text-3xl">{it.pricePerDay}</span><span className="text-sm text-muted">TND / day · {it.deposit} TND deposit</span></p>
      <p className="mt-3 flex items-center gap-2 text-xs text-muted"><Avatar user={it.owner} size={20} />{it.owner.name} · {it.condition}</p>
      {r?.status === 'accepted' && <p className="mt-3 flex items-center gap-2 rounded-xl bg-moss-soft p-3 text-sm text-moss"><KeyRound size={15} />Accepted. Contact: <strong>{r.contact}</strong></p>}
      {r?.status === 'pending' && <p className="mt-3 rounded-xl bg-paper p-3 text-sm text-muted">Request pending · {formatDay(r.from)} → {formatDay(r.to)}</p>}
      {r?.status === 'declined' && <p className="mt-3 rounded-xl bg-rose-soft p-3 text-sm text-rose">Your last request was declined.</p>}
      {it.mine ? (it.available ? <p className="mt-3 text-xs text-muted">{it.pendingRequests ? `${it.pendingRequests} pending request(s) below` : 'Your listing'}</p> : <button className="btn btn-ghost mt-3" onClick={() => back.mutate()}>Mark as returned</button>)
        : it.available && (!r || r.status === 'declined' || r.status === 'returned') && (ask ? (
          <form className="mt-3 grid gap-2" onSubmit={(e: FormEvent) => { e.preventDefault(); req.mutate() }}>
            <div className="grid grid-cols-2 gap-2"><input className="field" type="date" value={from} min={iso(Date.now())} onChange={(e) => setFrom(e.target.value)} aria-label="From" /><input className="field" type="date" value={to} min={from} onChange={(e) => setTo(e.target.value)} aria-label="To" /></div>
            <input className="field" placeholder="Short note (optional)" maxLength={200} value={note} onChange={(e) => setNote(e.target.value)} />
            <div className="flex gap-2"><button className="btn btn-primary flex-1" disabled={req.isPending}>{req.isPending ? <Spinner /> : 'Send request'}</button><button type="button" className="btn btn-ghost" onClick={() => setAsk(false)}>Cancel</button></div>
          </form>) : <button className="btn btn-primary mt-3" onClick={() => setAsk(true)}>Request to rent</button>)}
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
  const items = (list.data ?? []).filter((i) => cat === 'all' || i.category === cat)
  return (
    <div>
      <PageHeader title="Rentals" sub="Borrow calculators, lab gear, books and tech from other students. Contact details appear only after the owner accepts."
        action={<button className="btn btn-accent" onClick={() => setOpen(!open)}><Plus size={16} />List an item</button>} />
      <p className="mb-6 flex items-start gap-2 rounded-xl border border-dashed border-line p-3 text-xs text-muted"><ShieldAlert size={14} className="mt-0.5 shrink-0" />No money moves through SMUhub. Meet on campus, check the item together and keep the deposit agreement simple.</p>
      {!!incoming.data?.length && (
        <section className="card rise mb-8 p-5"><h2 className="display mb-3 text-xl">Requests for your items</h2>
          <ul className="grid gap-3">{incoming.data.map((q) => (
            <li key={q.id} className="flex flex-wrap items-center gap-3"><Avatar user={q.renter} size={30} /><span className="min-w-0 flex-1 text-sm"><strong>{q.renter.name}</strong> · {formatDay(q.from)} → {formatDay(q.to)}{q.note && <span className="block text-xs text-muted">“{q.note}”</span>}</span>
              <button className="btn btn-primary btn-sm" onClick={() => respond.mutate({ id: q.id, ok: true })}>Accept</button><button className="btn btn-ghost btn-sm" onClick={() => respond.mutate({ id: q.id, ok: false })}>Decline</button></li>))}</ul></section>
      )}
      {open && (
        <form className="card rise mb-8 grid gap-4 p-5 sm:grid-cols-2" onSubmit={(e) => { e.preventDefault(); setErr(''); create.mutate() }}>
          <div className="sm:col-span-2"><Field label="Item"><input className="field" required maxLength={80} value={f.title} onChange={(e) => setF({ ...f, title: e.target.value })} /></Field></div>
          <Field label="Category"><select className="field" value={f.category} onChange={(e) => setF({ ...f, category: e.target.value as RentalCategory })}>{Object.entries(RENTAL_LABEL).map(([k, l]) => <option key={k} value={k}>{l}</option>)}</select></Field>
          <Field label="Condition"><select className="field" value={f.condition} onChange={(e) => setF({ ...f, condition: e.target.value as typeof f.condition })}><option value="new">New</option><option value="good">Good</option><option value="worn">Worn</option></select></Field>
          <Field label="Price per day (TND)"><input className="field" type="number" min={0} max={200} value={f.pricePerDay} onChange={(e) => setF({ ...f, pricePerDay: +e.target.value })} /></Field>
          <Field label="Deposit (TND)"><input className="field" type="number" min={0} max={2000} value={f.deposit} onChange={(e) => setF({ ...f, deposit: +e.target.value })} /></Field>
          <div className="sm:col-span-2"><Field label="Description"><textarea className="field min-h-20" maxLength={400} value={f.description} onChange={(e) => setF({ ...f, description: e.target.value })} /></Field></div>
          <div className="sm:col-span-2"><Field label="Private contact" hint="WhatsApp, Telegram or Instagram. Only shown to a renter once you accept."><input className="field" required maxLength={80} value={f.contact} onChange={(e) => setF({ ...f, contact: e.target.value })} /></Field></div>
          {err && <p role="alert" className="text-sm text-rose sm:col-span-2">{err}</p>}
          <button className="btn btn-primary sm:col-span-2 sm:justify-self-end" disabled={create.isPending}>{create.isPending ? <Spinner /> : 'Publish listing'}</button>
        </form>
      )}
      <div className="mb-6 overflow-x-auto"><Segmented value={cat} onChange={setCat} options={[{ value: 'all', label: 'All' }, ...Object.entries(RENTAL_LABEL).map(([value, label]) => ({ value: value as RentalCategory, label }))]} /></div>
      {list.isLoading ? <Skeleton rows={3} /> : list.error ? <ErrorBox error={list.error} /> : !items.length ? <Empty title="No items yet" hint="List something you do not need every day." /> : <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">{items.map((i) => <ItemCard key={i.id} it={i} />)}</div>}
    </div>
  )
}

import { Router } from 'express'
import { isValidObjectId, type Types } from 'mongoose'
import { z } from 'zod'
import { HttpError } from '../lib/errors.js'
import { loadPeople, personOr, type PublicPerson } from '../lib/people.js'
import { RentalItem, RentalRequest } from '../models/Rental.js'

/**
 * Rentals API, mounted at /api/rentals behind requireAuth (see app.ts).
 * Same rules as the reference mock (client/src/api/mock.ts, docs/BACKEND.md): 10 listings per student,
 * no requesting your own item, one open request per item, only the owner responds or marks a return.
 * The owner's contact is private: it is only ever sent in `myRequest.contact`, to the renter whose request was accepted.
 * No money moves through SMUhub.
 */

const DAY = 86_400_000
export const LIMITS = { listingsPerStudent: 10, maxRentalDays: 30 }

const newItem = z.object({
  title: z.string().trim().min(4).max(80),
  category: z.enum(['calculator', 'lab', 'books', 'tech', 'other']),
  pricePerDay: z.number().min(0).max(200),
  deposit: z.number().min(0).max(2000),
  condition: z.enum(['new', 'good', 'worn']),
  description: z.string().trim().max(400).default(''),
  contact: z.string().trim().min(3).max(80),
})
const newRequest = z.object({ from: z.number(), to: z.number(), note: z.string().trim().max(200).default('') })
const answer = z.object({ accept: z.boolean() })

const ITEM_NOT_FOUND = 'Objet introuvable.'
const REQUEST_NOT_FOUND = 'Demande introuvable.'
const ITEM_ERRORS: Record<string, [string, string]> = {
  title: ['bad_title', 'Donne un nom clair à ton objet (4 caractères min.).'],
  pricePerDay: ['bad_price', 'Vérifie le prix (0 à 200 TND par jour) et la caution (0 à 2000 TND).'],
  deposit: ['bad_price', 'Vérifie le prix (0 à 200 TND par jour) et la caution (0 à 2000 TND).'],
  contact: ['bad_contact', "Ajoute un contact (3 caractères min.). Il n'est montré qu'au locataire que tu acceptes."],
}

type Id = Types.ObjectId
type ItemDoc = { _id: Id; title: string; category: string; pricePerDay: number; deposit: number; condition: string; description?: string | null; owner: Id; available: boolean; createdAt: Date }
type RequestDoc = { _id: Id; item: Id; renter: Id; from: Date; to: Date; note?: string | null; status: string }

/** The client's RentalRequest shape. `contact` is only filled for an accepted request shown to its renter. */
function requestJson(q: RequestDoc, people: Map<string, PublicPerson>, contact?: string) {
  return {
    id: q._id.toString(), itemId: q.item.toString(), renter: personOr(people, q.renter), from: q.from.getTime(), to: q.to.getTime(),
    note: q.note ?? '', status: q.status, contact: q.status === 'accepted' ? contact : undefined,
  }
}

/** The client's RentalItem shape, as seen by `me`: their latest request on each item, pending counts on their own items. */
async function itemsJson(items: ItemDoc[], me: Id) {
  const ids = items.map((i) => i._id)
  const [mine, pending] = await Promise.all([
    RentalRequest.find({ renter: me, item: { $in: ids } }).sort({ createdAt: -1, _id: -1 }),
    RentalRequest.aggregate<{ _id: Id; n: number }>([{ $match: { owner: me, status: 'pending', item: { $in: ids } } }, { $group: { _id: '$item', n: { $sum: 1 } } }]),
  ])
  const latest = new Map<string, RequestDoc>()
  for (const q of mine) if (!latest.has(q.item.toString())) latest.set(q.item.toString(), q)
  // Contacts are loaded only for items where my own latest request was accepted.
  const accepted = [...latest.values()].filter((q) => q.status === 'accepted').map((q) => q.item)
  const contacts = new Map(accepted.length ? (await RentalItem.find({ _id: { $in: accepted } }).select('+contact')).map((i) => [i._id.toString(), i.contact]) : [])
  const counts = new Map(pending.map((p) => [p._id.toString(), p.n]))
  const people = await loadPeople([...items.map((i) => i.owner), me])
  return items.map((i) => {
    const id = i._id.toString(), q = latest.get(id), mineItem = i.owner.equals(me)
    return {
      id, title: i.title, category: i.category, pricePerDay: i.pricePerDay, deposit: i.deposit, condition: i.condition, description: i.description ?? '',
      owner: personOr(people, i.owner), mine: mineItem, available: i.available, createdAt: i.createdAt.getTime(),
      myRequest: q ? requestJson(q, people, contacts.get(id)) : undefined, pendingRequests: mineItem ? (counts.get(id) ?? 0) : 0,
    }
  })
}

async function findItem(id: string) {
  if (!isValidObjectId(id)) throw new HttpError(404, 'not_found', ITEM_NOT_FOUND)
  const item = await RentalItem.findById(id)
  if (!item) throw new HttpError(404, 'not_found', ITEM_NOT_FOUND)
  return item
}

export function rentalsRouter() {
  const router = Router()

  // Every listing, available first, newest first: GET /api/rentals
  router.get('/', async (req, res) => {
    const items = await RentalItem.find().sort({ available: -1, createdAt: -1, _id: -1 }).limit(200)
    res.json({ items: await itemsJson(items, req.user!._id) })
  })

  // List an item: POST /api/rentals { title, category, pricePerDay, deposit, condition, description, contact }
  router.post('/', async (req, res) => {
    const me = req.user!._id
    const parsed = newItem.safeParse(req.body)
    if (!parsed.success) {
      const [code, message] = ITEM_ERRORS[String(parsed.error.issues[0]?.path[0])] ?? ['invalid_input', 'Vérifie les informations de ton annonce.']
      throw new HttpError(400, code, message)
    }
    const count = await RentalItem.countDocuments({ owner: me })
    if (count >= LIMITS.listingsPerStudent) throw new HttpError(429, 'rate_limited', `Tu peux proposer ${LIMITS.listingsPerStudent} objets au maximum.`)
    const item = await RentalItem.create({ ...parsed.data, owner: me })
    res.status(201).json({ item: (await itemsJson([item], me))[0] })
  })

  // Requests waiting for my answer: GET /api/rentals/incoming. Never carries a contact.
  router.get('/incoming', async (req, res) => {
    const requests = await RentalRequest.find({ owner: req.user!._id, status: 'pending' }).sort({ createdAt: 1 }).limit(100)
    const people = await loadPeople(requests.map((q) => q.renter))
    res.json({ requests: requests.map((q) => requestJson(q, people)) })
  })

  // Ask to borrow: POST /api/rentals/:id/requests { from, to, note }. Dates are ms timestamps.
  router.post('/:id/requests', async (req, res) => {
    const me = req.user!._id
    const parsed = newRequest.safeParse(req.body)
    if (!parsed.success) throw new HttpError(400, 'invalid_input', 'Choisis des dates valides.')
    const item = await findItem(req.params.id)
    if (item.owner.equals(me)) throw new HttpError(403, 'self_request', "C'est ton propre objet.")
    if (!item.available) throw new HttpError(409, 'unavailable', 'Cet objet est déjà loué.')
    const { from, to, note } = parsed.data
    // `from` may be today's midnight (date picker), hence one day of slack. Same-day rentals (to === from) are allowed.
    const now = Date.now()
    if (to < from || from < now - DAY || from > now + 365 * DAY || to - from > LIMITS.maxRentalDays * DAY) {
      throw new HttpError(400, 'bad_dates', `Choisis des dates valides (${LIMITS.maxRentalDays} jours max.).`)
    }
    if (await RentalRequest.exists({ item: item._id, renter: me, status: { $in: ['pending', 'accepted'] } })) {
      throw new HttpError(409, 'duplicate', 'Tu as déjà une demande en cours pour cet objet.')
    }
    try {
      const q = await RentalRequest.create({ item: item._id, owner: item.owner, renter: me, from: new Date(from), to: new Date(to), note })
      res.status(201).json({ request: requestJson(q, await loadPeople([me])) })
    } catch (err) {
      // The partial unique index catches parallel duplicates that slipped past the check above.
      if ((err as { code?: number }).code === 11000) throw new HttpError(409, 'duplicate', 'Tu as déjà une demande en cours pour cet objet.')
      throw err
    }
  })

  // Accept or decline: POST /api/rentals/requests/:id/respond { accept }. Owner only, pending requests only.
  router.post('/requests/:id/respond', async (req, res) => {
    const me = req.user!._id
    const parsed = answer.safeParse(req.body)
    if (!parsed.success) throw new HttpError(400, 'invalid_input', 'Réponse invalide.')
    const id = req.params.id
    if (!isValidObjectId(id)) throw new HttpError(404, 'not_found', REQUEST_NOT_FOUND)
    const q = await RentalRequest.findById(id)
    if (!q) throw new HttpError(404, 'not_found', REQUEST_NOT_FOUND)
    const item = await RentalItem.findById(q.item)
    if (!item) throw new HttpError(404, 'not_found', ITEM_NOT_FOUND)
    if (!item.owner.equals(me)) throw new HttpError(403, 'forbidden', 'Seul le propriétaire peut répondre.')
    const handled = () => new HttpError(409, 'bad_state', 'Cette demande a déjà été traitée.')
    if (q.status !== 'pending') throw handled()
    // Conditional updates throughout: a request is answered once, and an item is lent to one renter at a time.
    // On accept the item is claimed first, so a request is never "accepted" (contact visible) for an item already lent.
    if (parsed.data.accept) {
      const taken = await RentalItem.updateOne({ _id: item._id, owner: me, available: true }, { available: false })
      if (taken.modifiedCount === 0) throw new HttpError(409, 'unavailable', "Cet objet est déjà loué. Marque-le comme rendu avant d'accepter une autre demande.")
      const claimed = await RentalRequest.updateOne({ _id: q._id, status: 'pending' }, { status: 'accepted' })
      if (claimed.modifiedCount === 0) {
        await RentalItem.updateOne({ _id: item._id }, { available: true })
        throw handled()
      }
      await RentalRequest.updateMany({ item: item._id, status: 'pending', _id: { $ne: q._id } }, { status: 'declined' })
    } else {
      const claimed = await RentalRequest.updateOne({ _id: q._id, status: 'pending' }, { status: 'declined' })
      if (claimed.modifiedCount === 0) throw handled()
    }
    const fresh = (await RentalRequest.findById(q._id))!
    res.json({ request: requestJson(fresh, await loadPeople([fresh.renter])) })
  })

  // The item came back: POST /api/rentals/:id/returned. Owner only.
  router.post('/:id/returned', async (req, res) => {
    const me = req.user!._id
    const item = await findItem(req.params.id)
    if (!item.owner.equals(me)) throw new HttpError(403, 'forbidden', 'Seul le propriétaire peut marquer un retour.')
    await RentalRequest.updateMany({ item: item._id, status: 'accepted' }, { status: 'returned' })
    await RentalItem.updateOne({ _id: item._id, owner: me }, { available: true })
    res.json({ item: (await itemsJson([(await RentalItem.findById(item._id))!], me))[0] })
  })

  return router
}

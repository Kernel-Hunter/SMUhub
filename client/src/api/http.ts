/**
 * Thin fetch wrapper for the real SMUhub API (server/).
 * Requests go to VITE_API_URL when set, otherwise to the same origin (/api), which the Vite dev
 * server proxies to the backend. The session lives in an HttpOnly cookie, hence credentials: 'include'.
 */
import { ApiError } from './mock'

const BASE = (import.meta.env.VITE_API_URL ?? '').replace(/\/$/, '')

export class HttpError extends ApiError {
  status: number
  constructor(status: number, code: string, message: string) { super(code, message); this.status = status }
}

/** Full URL of an API path, for links the browser follows itself (file downloads). */
export const apiUrl = (path: string) => `${BASE}${path}`

/** JSON by default. A FormData body is sent as multipart, untouched: the browser sets the Content-Type and boundary. */
export async function http<T>(path: string, init: { method?: string; body?: unknown } = {}): Promise<T> {
  const form = init.body instanceof FormData
  let res: Response
  try {
    res = await fetch(apiUrl(path), {
      method: init.method ?? 'GET',
      credentials: 'include',
      headers: init.body !== undefined && !form ? { 'Content-Type': 'application/json' } : undefined,
      body: init.body === undefined ? undefined : form ? (init.body as FormData) : JSON.stringify(init.body),
    })
  } catch {
    throw new HttpError(0, 'network', 'Impossible de joindre le serveur. Vérifie que le backend est lancé.')
  }
  if (res.status === 204) return undefined as T
  const data = await res.json().catch(() => null)
  if (!res.ok) {
    const err = data?.error
    throw new HttpError(res.status, err?.code ?? 'http_error', err?.message ?? `Erreur ${res.status}. Réessaie.`)
  }
  return data as T
}

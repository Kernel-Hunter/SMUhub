/**
 * Thin fetch wrapper for the real SMUhub API (server/).
 * Requests go to VITE_API_URL when set, otherwise to the same origin (/api), which the Vite dev
 * server proxies to the backend. The session lives in an HttpOnly cookie, hence credentials: 'include'.
 */
const BASE = (import.meta.env.VITE_API_URL ?? '').replace(/\/$/, '')

/** Error with a stable code the UI can branch on (e.g. 'email_not_verified'). */
export class ApiError extends Error {
  code: string
  constructor(code: string, message: string) { super(message); this.code = code }
}

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
    throw new HttpError(0, 'network', 'Cannot reach the server. Check that the backend is running.')
  }
  if (res.status === 204) return undefined as T
  const data = await res.json().catch(() => null)
  if (!res.ok) {
    // The session ended (expired, password reset elsewhere): let the app drop everything it cached for this student.
    // Auth routes answer 401 for a wrong password, which is not a lost session.
    if (res.status === 401 && !path.startsWith('/api/auth/')) window.dispatchEvent(new Event('smuhub:signed-out'))
    const err = data?.error
    throw new HttpError(res.status, err?.code ?? 'http_error', err?.message ?? `Error ${res.status}. Try again.`)
  }
  return data as T
}

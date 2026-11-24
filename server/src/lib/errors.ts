import type { ErrorRequestHandler, RequestHandler } from 'express'

/** An error the API can show to the client as-is. Shape: { error: { code, message } }. */
export class HttpError extends Error {
  constructor(public status: number, public code: string, message: string) {
    super(message)
  }
}

export const notFound: RequestHandler = (_req, _res, next) => next(new HttpError(404, 'not_found', 'Route not found.'))

export const errorHandler: ErrorRequestHandler = (err, _req, res, _next) => {
  if (err instanceof HttpError) {
    res.status(err.status).json({ error: { code: err.code, message: err.message } })
    return
  }
  // Malformed JSON body from express.json()
  if (err?.type === 'entity.parse.failed' || err?.type === 'entity.too.large') {
    res.status(400).json({ error: { code: 'bad_request', message: 'Invalid request.' } })
    return
  }
  console.error(err)
  res.status(500).json({ error: { code: 'server_error', message: 'Server error. Try again later.' } })
}

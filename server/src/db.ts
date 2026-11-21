import mongoose from 'mongoose'

/** Host part of a MongoDB URI, without the credentials, safe to print in logs. */
export function describeUri(uri: string): string {
  const m = /^mongodb(?:\+srv)?:\/\/(?:[^@/]*@)?([^/?]+)/.exec(uri)
  return m ? m[1] : 'the configured MongoDB server'
}

/** Turns a driver error into a message that says what to fix. Never includes the password. */
export function explainConnectionError(err: unknown, uri: string): string {
  const raw = err instanceof Error ? err.message : String(err)
  const code = (err as { code?: unknown } | null)?.code
  const host = describeUri(uri)
  const fix = (why: string, hint: string) => `Cannot connect to MongoDB at ${host}: ${why}\n  -> ${hint}\n  (driver: ${raw.replace(/\/\/[^@\s]*@/g, '//<credentials>@')})`

  if (/querySrv|_mongodb\._tcp/i.test(raw)) {
    return fix(
      'the DNS SRV lookup failed.',
      'Check the cluster host in MONGODB_URI. Some networks or DNS servers block SRV records: try another network, or set your DNS to 8.8.8.8 / 1.1.1.1.',
    )
  }
  if (code === 18 || code === 8000 || /auth(entication)? failed|bad auth/i.test(raw)) {
    return fix(
      'authentication failed.',
      'Check the username and password in MONGODB_URI (Atlas > Database Access). Special characters in the password must be URL-encoded (e.g. @ -> %40).',
    )
  }
  if (/whitelist|IP.*access list|Could not connect to any servers/i.test(raw) || (err instanceof Error && err.name === 'MongooseServerSelectionError')) {
    return fix(
      'no server answered in time.',
      host.endsWith('.mongodb.net')
        ? 'Most likely your IP address is not allowed: add it in Atlas > Network Access, then retry.'
        : 'Make sure MongoDB is running and reachable at this address.',
    )
  }
  return fix('unexpected error.', 'Check MONGODB_URI in server/.env.')
}

export async function connectDb(uri: string) {
  mongoose.set('strictQuery', true)
  try {
    await mongoose.connect(uri, { serverSelectionTimeoutMS: 10000 })
  } catch (err) {
    throw new Error(explainConnectionError(err, uri), { cause: err })
  }
  return mongoose.connection
}

export async function disconnectDb() {
  await mongoose.disconnect()
}

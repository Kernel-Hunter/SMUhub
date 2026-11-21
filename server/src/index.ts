import 'dotenv/config'
import { loadConfig } from './config/env.js'
import { connectDb } from './db.js'
import { createApp } from './app.js'

async function main() {
  const config = loadConfig()
  await connectDb(config.mongoUri)
  const app = createApp(config)
  app.listen(config.port, () => {
    console.log(`SMUhub API listening on http://localhost:${config.port} (${config.env})`)
  })
}

main().catch((err) => {
  console.error(err instanceof Error ? err.message : err)
  process.exit(1)
})

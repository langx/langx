import { buildApp } from './app'
import { connectToDatabase } from './db/client'
import { ensureIndexes } from './db/indexes'
import { loadEnv } from './env'

async function main(): Promise<void> {
  const env = loadEnv()

  const { client, db, close } = await connectToDatabase(env.MONGODB_URI, env.MONGODB_DB)

  const app = await buildApp({ env, client, db })

  // Declarative indexes are applied before the first request is served, so a
  // fresh environment can never answer a discovery query without them.
  const indexResults = await ensureIndexes(db)
  app.log.info({ collections: indexResults.length }, 'indexes ensured')

  const shutdown = async (signal: string): Promise<void> => {
    app.log.info({ signal }, 'shutting down')
    await app.close()
    await close()
    process.exit(0)
  }

  process.on('SIGTERM', () => void shutdown('SIGTERM'))
  process.on('SIGINT', () => void shutdown('SIGINT'))

  await app.listen({ port: env.PORT, host: env.HOST })
}

main().catch((error: unknown) => {
  console.error(error)
  process.exit(1)
})

import { buildApp } from './app'
import { createAuth } from './auth'
import { warmUpAuthCollections } from './auth/warmUp'
import { connectToDatabase } from './db/client'
import { ensureIndexes } from './db/indexes'
import { createEmailSender } from './email/sender'
import { attachSentryErrorHandler, initSentry } from './observability/sentry'
import { loadEnv, publicApiUrl, unsubscribeSecret } from './env'
import { createStorageProvider } from './storage/createStorageProvider'
import { createTranslationProvider } from './translation/createTranslationProvider'
import { createRevenueCatClientFromEnv } from './modules/billing/createRevenueCatClient'
import { startPurgeScheduler } from './modules/account/purgeScheduler'
import { ExpoPushSender } from './modules/push/devices'
import type { NotificationEmailContext } from './email/notify'
import { AppwriteLegacyVerifier, DisabledLegacyVerifier } from './modules/handles/legacyLogin'
import { startLegacyImportScheduler } from './modules/handles/legacyImportScheduler'
import { startStreakReminderScheduler } from './modules/push/reminderScheduler'
import { startNotificationScheduler } from './modules/notifications/scheduler'
import { startDailyPoolScheduler } from './modules/tokens/poolScheduler'

async function main(): Promise<void> {
  const env = loadEnv()

  // Before anything else, so a failure during startup is reported too.
  const sentryEnabled = initSentry(env)

  const { client, db, close } = await connectToDatabase(env.MONGODB_URI, env.MONGODB_DB)

  const emailSender = createEmailSender(env, console)

  // Built before `createAuth` because the restore that runs on email
  // verification hands the v1 loyalty gift out through it.
  const revenueCat = createRevenueCatClientFromEnv(env)

  const auth = await createAuth({ env, db, client, emailSender, revenueCat })
  const storage = createStorageProvider(env)

  const translation = createTranslationProvider(env)

  const push = new ExpoPushSender(env.EXPO_ACCESS_TOKEN)

  /**
   * What every notification sender needs: an outbox, the secret its
   * unsubscribe links are signed with, and the address those links point back
   * at. Built once so no scheduler assembles its own and gets one of the three
   * subtly wrong.
   */
  const notificationEmail: NotificationEmailContext = {
    sender: emailSender,
    unsubscribeSecret: unsubscribeSecret(env),
    apiBaseUrl: publicApiUrl(env),
  }

  // The bridge only exists while v1 is still running. Without APPWRITE_* it is
  // simply off, and a returning user goes through the normal reset-password
  // route instead.
  const legacyVerifier =
    env.APPWRITE_ENDPOINT && env.APPWRITE_PROJECT_ID
      ? new AppwriteLegacyVerifier(env.APPWRITE_ENDPOINT, env.APPWRITE_PROJECT_ID)
      : new DisabledLegacyVerifier()

  const app = await buildApp({
    env,
    client,
    db,
    auth,
    storage,
    translation,
    revenueCat,
    push,
    email: emailSender,
    legacyVerifier,
  })

  // Declarative indexes are applied before the first request is served, so a
  // fresh environment can never answer a discovery query without them.
  if (sentryEnabled) attachSentryErrorHandler(app)

  const indexResults = await ensureIndexes(db)
  app.log.info({ collections: indexResults.length, sentry: sentryEnabled }, 'indexes ensured')

  await warmUpAuthCollections(auth, db, app.log)

  // Started here rather than in `buildApp` so tests get an app with no timers
  // running behind them — they drive `runDailyPool` directly instead.
  const schedulers = [
    startDailyPoolScheduler(db, app.log),
    startPurgeScheduler(db, app.log, { storage }),
    startStreakReminderScheduler(db, push, notificationEmail, app.log),
    startLegacyImportScheduler(db, app.log),
    startNotificationScheduler(db, notificationEmail, app.log),
  ]

  const shutdown = async (signal: string): Promise<void> => {
    app.log.info({ signal }, 'shutting down')
    for (const scheduler of schedulers) scheduler.stop()
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

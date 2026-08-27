import { compareVersions, isUpdateRequired, type AuthProviders } from '@langx/shared'
import type { FastifyInstance } from 'fastify'
import { MongoMemoryReplSet } from 'mongodb-memory-server'
import { afterAll, afterEach, beforeAll, describe, expect, it } from 'vitest'
import { buildApp } from '../app'
import { createAuth } from '../auth'
import { connectToDatabase, type DbHandle } from '../db/client'
import { ensureIndexes } from '../db/indexes'
import { loadEnv } from '../env'
import { createRevenueCatClientFromEnv } from '../modules/billing/createRevenueCatClient'
import {
  invalidateAppConfigCache,
  setMaintenance,
  updateAppConfig,
} from '../modules/appConfig/appConfig'
import { createStorageProvider } from '../storage/createStorageProvider'
import { CapturingEmailSender } from '../testSupport/authFlow'
import { createTranslationProvider } from '../translation/createTranslationProvider'

describe('app config, maintenance and the version gate', () => {
  let replSet: MongoMemoryReplSet
  let handle: DbHandle
  let app: FastifyInstance

  beforeAll(async () => {
    replSet = await MongoMemoryReplSet.create({ replSet: { count: 1 } })
    handle = await connectToDatabase(replSet.getUri(), 'langx_config_test')
    const env = loadEnv({
      NODE_ENV: 'test',
      MONGODB_URI: replSet.getUri(),
      MONGODB_DB: 'langx_config_test',
      LOG_LEVEL: 'silent',
      BETTER_AUTH_SECRET: 'a'.repeat(32),
      BETTER_AUTH_URL: 'http://localhost:4000',
    })
    await ensureIndexes(handle.db)
    const auth = await createAuth({
      env,
      db: handle.db,
      client: handle.client,
      emailSender: new CapturingEmailSender(),
    })
    app = await buildApp({
      env,
      client: handle.client,
      db: handle.db,
      auth,
      storage: createStorageProvider(env),
      translation: createTranslationProvider(env),
      revenueCat: createRevenueCatClientFromEnv(env),
    })
    await app.ready()
  }, 120_000)

  afterEach(async () => {
    await setMaintenance(handle.db, false)
    invalidateAppConfigCache()
  })

  afterAll(async () => {
    await app?.close()
    await handle?.close()
    await replSet?.stop()
  })

  const get = (url: string, headers: Record<string, string> = {}) =>
    app.inject({ method: 'GET', url, headers })

  describe('version comparison', () => {
    it('orders versions numerically, not lexically', () => {
      // The bug this prevents: '2.10.0' < '2.9.0' under string comparison.
      expect(compareVersions('2.10.0', '2.9.0')).toBe(1)
      expect(compareVersions('2.0.0', '2.0.0')).toBe(0)
      expect(compareVersions('1.9.9', '2.0.0')).toBe(-1)
    })

    it('never forces an update on an unparseable or missing version', () => {
      // Being wrong permissively is the only safe direction: a malformed
      // header must not be able to lock someone out of the app.
      expect(isUpdateRequired(undefined, '9.9.9')).toBe(false)
      expect(isUpdateRequired('not-a-version', '9.9.9')).toBe(false)
      expect(isUpdateRequired('2.0.0', '9.9.9')).toBe(true)
    })
  })

  describe('GET /app-config', () => {
    it('is reachable without a session', async () => {
      const response = await get('/app-config')
      expect(response.statusCode).toBe(200)
      expect(response.json<{ maintenance: { enabled: boolean } }>().maintenance.enabled).toBe(false)
    })

    it('reports no OAuth providers when none are configured', async () => {
      // The default for every self-hosted instance, and the reason this is on
      // the response at all: the sign-in screen must not draw a Google button
      // that opens a browser and comes back with a provider error.
      const response = await get('/app-config')
      expect(response.json<{ authProviders: AuthProviders }>().authProviders).toEqual({
        google: false,
        apple: false,
      })
    })

    it('reports a provider as available once its credentials are set', async () => {
      const env = loadEnv({
        NODE_ENV: 'test',
        MONGODB_URI: replSet.getUri(),
        MONGODB_DB: 'langx_config_test',
        LOG_LEVEL: 'silent',
        BETTER_AUTH_SECRET: 'a'.repeat(32),
        BETTER_AUTH_URL: 'http://localhost:4000',
        GOOGLE_CLIENT_ID: 'google-client-id',
        GOOGLE_CLIENT_SECRET: 'google-client-secret',
      })
      const configured = await buildApp({
        env,
        client: handle.client,
        db: handle.db,
        auth: await createAuth({
          env,
          db: handle.db,
          client: handle.client,
          emailSender: new CapturingEmailSender(),
        }),
        storage: createStorageProvider(env),
        translation: createTranslationProvider(env),
        revenueCat: createRevenueCatClientFromEnv(env),
      })
      await configured.ready()
      try {
        const response = await configured.inject({ method: 'GET', url: '/app-config' })
        // Apple stays false with Google set: the two are independent, and a
        // deployment with only one of them is the normal case while the other
        // is still waiting on a console.
        expect(response.json<{ authProviders: AuthProviders }>().authProviders).toEqual({
          google: true,
          apple: false,
        })
      } finally {
        await configured.close()
      }
    })

    it('computes updateRequired per platform', async () => {
      await updateAppConfig(handle.db, {
        minVersion: { ios: '3.0.0', android: '1.0.0', web: '1.0.0' },
      })
      invalidateAppConfigCache()

      const oldIos = await get('/app-config', { 'x-app-platform': 'ios', 'x-app-version': '2.0.0' })
      expect(oldIos.json<{ updateRequired: boolean }>().updateRequired).toBe(true)

      // Same version, different platform, different minimum.
      const android = await get('/app-config', {
        'x-app-platform': 'android',
        'x-app-version': '2.0.0',
      })
      expect(android.json<{ updateRequired: boolean }>().updateRequired).toBe(false)

      await updateAppConfig(handle.db, {
        minVersion: { ios: '0.0.0', android: '0.0.0', web: '0.0.0' },
      })
      invalidateAppConfigCache()
    })
  })

  describe('maintenance gate', () => {
    it('refuses every route with 503 and a Retry-After', async () => {
      await setMaintenance(handle.db, true, 'Back at 14:00 UTC', '2099-01-01T14:00:00.000Z')
      invalidateAppConfigCache()

      const response = await get('/discovery')
      expect(response.statusCode).toBe(503)
      expect(response.json<{ code: string; message: string }>()).toMatchObject({
        code: 'MAINTENANCE',
        message: 'Back at 14:00 UTC',
      })
      expect(Number(response.headers['retry-after'])).toBeGreaterThan(0)
    })

    it('keeps /health up so the platform does not restart the container', async () => {
      await setMaintenance(handle.db, true, 'down')
      invalidateAppConfigCache()
      expect((await get('/health')).statusCode).toBe(200)
    })

    it('keeps /app-config up so the client can explain itself', async () => {
      await setMaintenance(handle.db, true, 'down for now')
      invalidateAppConfigCache()

      const response = await get('/app-config')
      expect(response.statusCode).toBe(200)
      expect(response.json<{ maintenance: { message: string } }>().maintenance.message).toBe(
        'down for now',
      )
    })

    it('lifts immediately when turned off', async () => {
      await setMaintenance(handle.db, true, 'down')
      invalidateAppConfigCache()
      expect((await get('/discovery')).statusCode).toBe(503)

      await setMaintenance(handle.db, false)
      invalidateAppConfigCache()
      // 401 rather than 503 — the gate is gone and normal auth applies again.
      expect((await get('/discovery')).statusCode).toBe(401)
    })
  })
})

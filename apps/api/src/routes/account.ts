import {
  deleteAccountSchema,
  deletionRequestSchema,
  ERROR_CODES,
  handlesMatch,
  registerDeviceSchema,
  setPasswordSchema,
  updateDeviceSchema,
} from '@langx/shared'
import type { FastifyPluginAsyncZod } from 'fastify-type-provider-zod'
import { requireAuth, requireMember } from '../middleware/requireAuth'
import { getSignInMethods } from '../modules/account/signInMethods'
import {
  cancelDeletion,
  deletionStatus,
  exportUserData,
  requestDeletion,
} from '../modules/account/deletion'
import type { Profile } from '../modules/profiles/profiles'
import { registerDevice, setDevicePushEnabled, unregisterDevice } from '../modules/push/devices'
import { COLLECTIONS } from '../db/collections'
import { ApiError } from '../lib/ApiError'
import { publicApiUrl } from '../env'
import { deleteAccountEmail } from '../email/templates'
import { emailFor } from '../modules/profiles/emailFor'
import { deletionConfirmUrl, mintDeletionToken } from '../modules/account/deletionTokens'
import { localeFor } from '../modules/push/devices'

// eslint-disable-next-line @typescript-eslint/require-await -- Fastify plugin signature
export const accountRoutes: FastifyPluginAsyncZod = async (app) => {
  app.post(
    '/me/delete',
    { preHandler: requireMember, schema: { body: deleteAccountSchema } },
    async (request, reply) => {
      const status = await requestDeletion(app.mongo.db, request.userId, request.body.reason)
      return reply.send(status)
    },
  )

  /**
   * Every way this person can get back in.
   *
   * `requireAuth` rather than `requireMember`: a guest has no password and no
   * links, and answering that honestly is more useful than a 403 on a screen
   * whose entire job is to say what exists.
   */
  app.get('/me/sign-in-methods', { preHandler: requireAuth }, async (request, reply) => {
    const profile = await app.mongo.db
      .collection<Profile>(COLLECTIONS.profiles)
      .findOne({ _id: request.userId }, { projection: { handle: 1 } })
    if (!profile) throw new ApiError(ERROR_CODES.NOT_FOUND, 'Profile not found')
    return reply.send(await getSignInMethods(app.mongo.db, request.userId, profile.handle))
  })

  /**
   * Adds a password to an account that was made with Google or Apple.
   *
   * Better Auth's `setPassword` is `serverOnly`, so it cannot be called from
   * the app and has to be reached through a route of ours — which is the right
   * shape anyway: it refuses when a hash already exists
   * (`PASSWORD_ALREADY_SET`), so this can only ever *add* a way in, never
   * quietly replace one. Changing an existing password stays a different
   * operation that asks for the current one; a live session is enough to gain
   * a fallback, not enough to take one over.
   *
   * Rate-limited because an authenticated attacker with a stolen session would
   * use exactly this to make their access outlive the session.
   */
  app.post(
    '/me/password',
    {
      preHandler: requireMember,
      schema: { body: setPasswordSchema },
      config: { rateLimit: { max: 10, timeWindow: '1 minute' } },
    },
    async (request, reply) => {
      // Asked here as well as inside Better Auth, which throws its own
      // `PASSWORD_ALREADY_SET`. That error arrives as a bare 400 and the
      // generic handler would relabel it `FORBIDDEN`, which tells the app
      // nothing it can act on. Better Auth stays the real guard against the
      // race; this is the one that produces an answer worth showing.
      const existing = await getSignInMethods(app.mongo.db, request.userId, '')
      if (existing.hasPassword) {
        throw new ApiError(ERROR_CODES.PASSWORD_ALREADY_SET, 'This account already has a password')
      }

      const headers = new Headers()
      for (const [key, value] of Object.entries(request.headers)) {
        if (typeof value === 'string') headers.append(key, value)
        else if (Array.isArray(value)) for (const v of value) headers.append(key, v)
      }
      await app.auth.api.setPassword({ body: { newPassword: request.body.password }, headers })
      return reply.code(204).send()
    },
  )

  app.post('/me/delete/cancel', { preHandler: requireMember }, async (request, reply) => {
    return reply.send(await cancelDeletion(app.mongo.db, request.userId))
  })

  app.get('/me/delete', { preHandler: requireMember }, async (request, reply) => {
    return reply.send(await deletionStatus(app.mongo.db, request.userId))
  })

  // Served as a download rather than a rendered page: this is a portability
  // artefact, meant to be kept, not browsed.
  /**
   * Dismisses the welcome-back screen, once and for good.
   *
   * Conditional on `restoredFromV1` existing and not already being
   * acknowledged, so a replayed request is a no-op rather than a way to move
   * the timestamp around. 204 either way — the client's next question is only
   * ever "should I still show this?", and the answer is no in both cases.
   */
  app.post('/me/welcome-back/ack', { preHandler: requireMember }, async (request, reply) => {
    await app.mongo.db.collection<Profile>(COLLECTIONS.profiles).updateOne(
      {
        _id: request.userId,
        restoredFromV1: { $exists: true },
        'restoredFromV1.acknowledgedAt': { $exists: false },
      },
      { $set: { 'restoredFromV1.acknowledgedAt': new Date() } },
    )
    return reply.code(204).send()
  })

  app.get('/me/export', { preHandler: requireAuth }, async (request, reply) => {
    const data = await exportUserData(app.mongo.db, request.userId)
    return reply
      .header('content-disposition', `attachment; filename="langx-export.json"`)
      .type('application/json')
      .send(data)
  })

  app.post(
    '/me/devices',
    { preHandler: requireMember, schema: { body: registerDeviceSchema } },
    async (request, reply) => {
      await registerDevice(app.mongo.db, request.userId, request.body)
      return reply.code(204).send()
    },
  )

  app.delete('/me/devices/:token', { preHandler: requireMember }, async (request, reply) => {
    const { token } = request.params as { token: string }
    const { deviceId } = request.query as { deviceId?: string }
    // By installation where the client knows one: a phone whose Expo token has
    // rotated since it registered would otherwise leave its row behind on
    // sign-out, still receiving that account's notifications.
    await unregisterDevice(app.mongo.db, request.userId, {
      pushToken: decodeURIComponent(token),
      ...(deviceId ? { deviceId } : {}),
    })
    return reply.code(204).send()
  })

  /**
   * Step one of deleting an account: prove it is you at the keyboard, then
   * prove it is you at the mailbox.
   *
   * The handle is re-checked here and not only in the app. A client-side gate
   * is a suggestion — the request it guards is one `curl` away — and this is
   * the request that ends an account.
   *
   * Answers whether the mail can actually reach anybody. With no
   * `RESEND_API_KEY` the sender is `ConsoleEmailSender` and the link only ever
   * reaches a log, so the app has to be able to fall back to the direct path:
   * App Store 5.1.1(v) requires in-app deletion and does not care that email
   * is down. `"deliverable": false` is that answer, and it is the server's to
   * give rather than the client's to guess.
   */
  app.post(
    '/me/delete/request',
    {
      preHandler: requireMember,
      schema: { body: deletionRequestSchema },
      config: { rateLimit: { max: 30, timeWindow: '1 minute' } },
    },
    async (request, reply) => {
      const profile = await app.mongo.db
        .collection<Profile>(COLLECTIONS.profiles)
        .findOne({ _id: request.userId }, { projection: { handle: 1 } })
      if (!profile) throw new ApiError(ERROR_CODES.NOT_FOUND, 'Profile not found')
      if (!handlesMatch(request.body.handle, profile.handle)) {
        throw new ApiError(ERROR_CODES.VALIDATION_FAILED, 'Handle does not match')
      }

      const address = await emailFor(app.mongo.db, request.userId)
      // No verified address means there is no mailbox to prove anything with,
      // and the app falls back to the direct route.
      if (!address?.verified || !app.email.deliverable) {
        return reply.send({ sent: false, deliverable: false })
      }

      const token = await mintDeletionToken(app.mongo.db, request.userId)
      const locale = await localeFor(app.mongo.db, request.userId)
      await app.email.send({
        to: address.email,
        ...deleteAccountEmail(deletionConfirmUrl(publicApiUrl(app.env), token), locale),
      })
      return reply.send({ sent: true, deliverable: true })
    },
  )

  /**
   * The switch on one phone. Scoped by `userId`, so it can only ever silence a
   * device of the account making the request — and 404 rather than 204 when it
   * matches nothing, because reporting success for a device that is not there
   * is how a setting silently fails to apply.
   */
  app.patch(
    '/me/devices/:deviceId',
    { preHandler: requireMember, schema: { body: updateDeviceSchema } },
    async (request, reply) => {
      const { deviceId } = request.params as { deviceId: string }
      const updated = await setDevicePushEnabled(
        app.mongo.db,
        request.userId,
        decodeURIComponent(deviceId),
        request.body.pushEnabled,
      )
      if (!updated) throw new ApiError(ERROR_CODES.NOT_FOUND, 'Device not found')
      return reply.code(204).send()
    },
  )
}

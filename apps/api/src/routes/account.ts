import {
  deleteAccountSchema,
  ERROR_CODES,
  registerDeviceSchema,
  updateDeviceSchema,
} from '@langx/shared'
import type { FastifyPluginAsyncZod } from 'fastify-type-provider-zod'
import { requireAuth, requireMember } from '../middleware/requireAuth'
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

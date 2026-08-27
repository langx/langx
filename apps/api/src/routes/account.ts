import { deleteAccountSchema, registerDeviceSchema } from '@langx/shared'
import type { FastifyPluginAsyncZod } from 'fastify-type-provider-zod'
import { requireAuth } from '../middleware/requireAuth'
import {
  cancelDeletion,
  deletionStatus,
  exportUserData,
  requestDeletion,
} from '../modules/account/deletion'
import type { Profile } from '../modules/profiles/profiles'
import { registerDevice, unregisterDevice } from '../modules/push/devices'
import { COLLECTIONS } from '../db/collections'

// eslint-disable-next-line @typescript-eslint/require-await -- Fastify plugin signature
export const accountRoutes: FastifyPluginAsyncZod = async (app) => {
  app.post(
    '/me/delete',
    { preHandler: requireAuth, schema: { body: deleteAccountSchema } },
    async (request, reply) => {
      const status = await requestDeletion(app.mongo.db, request.userId, request.body.reason)
      return reply.send(status)
    },
  )

  app.post('/me/delete/cancel', { preHandler: requireAuth }, async (request, reply) => {
    return reply.send(await cancelDeletion(app.mongo.db, request.userId))
  })

  app.get('/me/delete', { preHandler: requireAuth }, async (request, reply) => {
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
  app.post('/me/welcome-back/ack', { preHandler: requireAuth }, async (request, reply) => {
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
    { preHandler: requireAuth, schema: { body: registerDeviceSchema } },
    async (request, reply) => {
      await registerDevice(app.mongo.db, request.userId, request.body)
      return reply.code(204).send()
    },
  )

  app.delete('/me/devices/:token', { preHandler: requireAuth }, async (request, reply) => {
    const { token } = request.params as { token: string }
    await unregisterDevice(app.mongo.db, request.userId, decodeURIComponent(token))
    return reply.code(204).send()
  })
}

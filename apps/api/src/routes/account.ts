import { deleteAccountSchema, registerDeviceSchema } from '@langx/shared'
import type { FastifyPluginAsyncZod } from 'fastify-type-provider-zod'
import { requireAuth } from '../middleware/requireAuth'
import {
  cancelDeletion,
  deletionStatus,
  exportUserData,
  requestDeletion,
} from '../modules/account/deletion'
import { registerDevice, unregisterDevice } from '../modules/push/devices'

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

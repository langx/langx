import { avatarConfirmSchema, avatarContentTypeSchema, ERROR_CODES } from '@langx/shared'
import { randomUUID } from 'node:crypto'
import type { FastifyPluginAsyncZod } from 'fastify-type-provider-zod'
import { z } from 'zod'
import { ApiError } from '../lib/ApiError'
import { requireAuth } from '../middleware/requireAuth'
import { setAvatarUrl } from '../modules/profiles/profiles'

const EXTENSION_BY_CONTENT_TYPE: Record<string, string> = {
  'image/jpeg': 'jpg',
  'image/png': 'png',
  'image/webp': 'webp',
}

// eslint-disable-next-line @typescript-eslint/require-await -- Fastify plugin signature
export const mediaRoutes: FastifyPluginAsyncZod = async (app) => {
  app.post(
    '/me/avatar/upload-url',
    {
      preHandler: requireAuth,
      schema: { body: z.object({ contentType: avatarContentTypeSchema }) },
    },
    async (request, reply) => {
      const extension = EXTENSION_BY_CONTENT_TYPE[request.body.contentType]
      const key = `avatars/${request.userId}/${randomUUID()}.${extension}`

      const upload = await app.storage.getUploadUrl(key, request.body.contentType)
      return reply.send(upload)
    },
  )

  app.post(
    '/me/avatar/confirm',
    { preHandler: requireAuth, schema: { body: avatarConfirmSchema } },
    async (request, reply) => {
      // Confirm-only, not free-form — an avatarUrl outside our own bucket
      // would break the Faz 10 "delete R2 avatars on hard delete" step and
      // any future moderation/rehosting of profile images.
      if (!app.env.STORAGE_PUBLIC_BASE_URL) {
        throw new ApiError(ERROR_CODES.INTERNAL, 'Storage is not configured')
      }
      if (!request.body.avatarUrl.startsWith(app.env.STORAGE_PUBLIC_BASE_URL)) {
        throw new ApiError(
          ERROR_CODES.VALIDATION_FAILED,
          'avatarUrl must point into our own storage bucket',
        )
      }

      const profile = await setAvatarUrl(app.mongo.db, request.userId, request.body.avatarUrl)
      return reply.send(profile)
    },
  )
}

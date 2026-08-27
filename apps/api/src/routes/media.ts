import {
  avatarContentTypeSchema,
  avatarConfirmSchema,
  ERROR_CODES,
  isAudioContentType,
  isImageContentType,
  mediaUploadUrlSchema,
  photoAddSchema,
  photoRemoveSchema,
} from '@langx/shared'
import { randomUUID } from 'node:crypto'
import type { FastifyPluginAsyncZod } from 'fastify-type-provider-zod'
import { z } from 'zod'
import { ApiError } from '../lib/ApiError'
import { requireAuth } from '../middleware/requireAuth'
import { assertConversationAccess } from '../modules/chat/access'
import { addPhoto, removePhoto, setAvatarUrl } from '../modules/profiles/profiles'

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
      assertOwnBucket(app.env.STORAGE_PUBLIC_BASE_URL, request.body.avatarUrl)

      const profile = await setAvatarUrl(app.mongo.db, request.userId, request.body.avatarUrl)
      return reply.send(profile)
    },
  )

  // Gallery photos take the same presigned path as the avatar, into their own
  // key prefix so the account-deletion purge can find them by prefix later.
  app.post(
    '/me/photos/upload-url',
    {
      preHandler: requireAuth,
      schema: { body: z.object({ contentType: avatarContentTypeSchema }) },
    },
    async (request, reply) => {
      const extension = EXTENSION_BY_CONTENT_TYPE[request.body.contentType]
      const key = `photos/${request.userId}/${randomUUID()}.${extension}`
      return reply.send(await app.storage.getUploadUrl(key, request.body.contentType))
    },
  )

  app.post(
    '/me/photos',
    { preHandler: requireAuth, schema: { body: photoAddSchema } },
    async (request, reply) => {
      assertOwnBucket(app.env.STORAGE_PUBLIC_BASE_URL, request.body.url)
      return reply.send(await addPhoto(app.mongo.db, request.userId, request.body.url))
    },
  )

  /**
   * A presigned URL for an attachment in a conversation.
   *
   * Access is checked *here*, before any URL is signed — a signed URL is a
   * capability, and handing one out to someone who cannot post in the
   * conversation would let them write into our bucket for free.
   */
  app.post(
    '/messages/upload-url',
    { preHandler: requireAuth, schema: { body: mediaUploadUrlSchema } },
    async (request, reply) => {
      const conversation = await assertConversationAccess(
        app.mongo.db,
        request.body.conversationId,
        request.userId,
      )

      const { kind, contentType } = request.body
      const allowed =
        kind === 'image' ? isImageContentType(contentType) : isAudioContentType(contentType)
      if (!allowed) {
        throw new ApiError(
          ERROR_CODES.VALIDATION_FAILED,
          `${contentType} is not a supported ${kind} type`,
        )
      }

      // Keyed by conversation so the account purge can find a user's
      // attachments, and so a leaked key reveals nothing about who is talking.
      const extension = contentType.split('/')[1]?.split(';')[0] ?? 'bin'
      const key = `messages/${conversation._id.toHexString()}/${randomUUID()}.${extension}`
      return reply.send(await app.storage.getUploadUrl(key, contentType))
    },
  )

  app.delete(
    '/me/photos',
    { preHandler: requireAuth, schema: { body: photoRemoveSchema } },
    async (request, reply) => {
      return reply.send(await removePhoto(app.mongo.db, request.userId, request.body.url))
    },
  )
}

/**
 * A URL outside our own bucket would break the account-deletion purge and any
 * future moderation or rehosting of profile images — and would let anyone
 * point their profile at an arbitrary host.
 */
function assertOwnBucket(base: string | undefined, url: string): void {
  if (!base) throw new ApiError(ERROR_CODES.INTERNAL, 'Storage is not configured')
  if (!url.startsWith(base)) {
    throw new ApiError(ERROR_CODES.VALIDATION_FAILED, 'URL must point into our own storage bucket')
  }
}

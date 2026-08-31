import {
  avatarContentTypeSchema,
  avatarConfirmSchema,
  ERROR_CODES,
  isAudioContentType,
  isImageContentType,
  mediaUploadUrlSchema,
  photoAddSchema,
  postMediaUploadUrlSchema,
  photoRemoveSchema,
} from '@langx/shared'
import { randomUUID } from 'node:crypto'
import type { FastifyPluginAsyncZod } from 'fastify-type-provider-zod'
import { z } from 'zod'
import { ApiError } from '../lib/ApiError'
import { assertOwnBucket } from '../lib/assertOwnBucket'
import { requireMember, requireVerifiedEmail } from '../middleware/requireAuth'
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
      preHandler: requireMember,
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
    { preHandler: requireMember, schema: { body: avatarConfirmSchema } },
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
      preHandler: requireMember,
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
    { preHandler: requireMember, schema: { body: photoAddSchema } },
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
    { preHandler: requireMember, schema: { body: mediaUploadUrlSchema } },
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

  /**
   * A presigned URL for an attachment on a post or a correction.
   *
   * `requireVerifiedEmail`, matching `POST /posts` rather than the plain
   * `requireAuth` on the message equivalent: a signed URL is a capability, and
   * the feed's version of "can you post here" is the guard on posting. Handing
   * one to an account that cannot post would let it write into our bucket for
   * nothing.
   *
   * Keyed by *user*, not by post, because the post does not exist yet when the
   * URL is signed — unlike a conversation. That also keeps the deletion purge
   * able to find a person's uploads by prefix.
   */
  app.post(
    '/posts/upload-url',
    { preHandler: requireVerifiedEmail, schema: { body: postMediaUploadUrlSchema } },
    async (request, reply) => {
      const { kind, contentType } = request.body
      const allowed =
        kind === 'image' ? isImageContentType(contentType) : isAudioContentType(contentType)
      if (!allowed) {
        throw new ApiError(
          ERROR_CODES.VALIDATION_FAILED,
          `${contentType} is not a supported ${kind} type`,
        )
      }

      // `EXTENSION_BY_CONTENT_TYPE` only covers images; audio needs the same
      // derivation the messages route uses.
      const extension = contentType.split('/')[1]?.split(';')[0] ?? 'bin'
      const key = `posts/${request.userId}/${randomUUID()}.${extension}`
      return reply.send(await app.storage.getUploadUrl(key, contentType))
    },
  )

  app.delete(
    '/me/photos',
    { preHandler: requireMember, schema: { body: photoRemoveSchema } },
    async (request, reply) => {
      return reply.send(await removePhoto(app.mongo.db, request.userId, request.body.url))
    },
  )
}

import {
  avatarConfirmSchema,
  ERROR_CODES,
  imageUploadUrlSchema,
  MEDIA_LIMITS,
  mediaKindOfContentType,
  mediaUploadUrlSchema,
  photoAddSchema,
  photoOrderSchema,
  postMediaUploadUrlSchema,
  photoRemoveSchema,
  type MediaKind,
} from '@langx/shared'
import { randomUUID } from 'node:crypto'
import type { FastifyPluginAsyncZod } from 'fastify-type-provider-zod'
import { ApiError } from '../lib/ApiError'
import { assertOwnObject } from '../lib/assertOwnBucket'
import {
  requireAdmin,
  requireAuth,
  requireMember,
  requireVerifiedEmail,
} from '../middleware/requireAuth'
import { assertConversationAccess, assertMediaUnlocked } from '../modules/chat/access'
import { recordPendingUpload } from '../modules/chat/pendingUploads'
import { objectExtension } from '../modules/media/objectExtension'
import { addPhoto, removePhoto, reorderPhotos, setAvatarUrl } from '../modules/profiles/profiles'
import { toOwnProfileWire } from '../modules/profiles/ownProfileWire'

/**
 * Before any URL is signed, because once it is the bytes are out of our hands:
 * the client PUTs straight to the bucket. The length is then signed into the
 * URL, so it cannot be a fib. An absent size is let through only for installed
 * binaries that predate the field — see `mediaUploadUrlSchema`.
 */
function assertUploadSize(kind: MediaKind, sizeBytes: number | undefined): void {
  if (sizeBytes !== undefined && sizeBytes > MEDIA_LIMITS[kind].maxBytes) {
    throw new ApiError(ERROR_CODES.MEDIA_TOO_LARGE, `That ${kind} is too large`)
  }
}

// eslint-disable-next-line @typescript-eslint/require-await -- Fastify plugin signature
export const mediaRoutes: FastifyPluginAsyncZod = async (app) => {
  app.post(
    '/me/avatar/upload-url',
    {
      preHandler: requireMember,
      schema: { body: imageUploadUrlSchema },
    },
    async (request, reply) => {
      const { contentType, sizeBytes } = request.body
      assertUploadSize('image', sizeBytes)
      const extension = objectExtension(contentType)
      const key = `avatars/${request.userId}/${randomUUID()}.${extension}`

      const upload = await app.storage.getUploadUrl(key, contentType, sizeBytes)
      return reply.send(upload)
    },
  )

  app.post(
    '/me/avatar/confirm',
    { preHandler: requireMember, schema: { body: avatarConfirmSchema } },
    async (request, reply) => {
      /*
       * Confirm-only, not free-form, and under this account's own prefix. A
       * URL outside our bucket would break the purge and hand us an
       * arbitrary-image-embed surface; one *inside* it but under somebody
       * else's prefix is worse, because the purge would then delete their
       * file when this account leaves. See `isOwnObjectUrl`.
       */
      assertOwnObject(
        app.env.STORAGE_PUBLIC_BASE_URL,
        request.body.avatarUrl,
        `avatars/${request.userId}/`,
        'Avatar',
      )

      const profile = await setAvatarUrl(app.mongo.db, request.userId, request.body.avatarUrl)
      return reply.send(toOwnProfileWire(profile))
    },
  )

  // Gallery photos take the same presigned path as the avatar, into their own
  // key prefix. The account-deletion purge finds them through `photos` on the
  // profile, as it does the avatar — the prefix keeps a bucket listing
  // readable, nothing more.
  app.post(
    '/me/photos/upload-url',
    {
      preHandler: requireMember,
      schema: { body: imageUploadUrlSchema },
    },
    async (request, reply) => {
      const { contentType, sizeBytes } = request.body
      assertUploadSize('image', sizeBytes)
      const extension = objectExtension(contentType)
      const key = `photos/${request.userId}/${randomUUID()}.${extension}`
      return reply.send(await app.storage.getUploadUrl(key, contentType, sizeBytes))
    },
  )

  app.post(
    '/me/photos',
    { preHandler: requireMember, schema: { body: photoAddSchema } },
    async (request, reply) => {
      assertOwnObject(
        app.env.STORAGE_PUBLIC_BASE_URL,
        request.body.url,
        `photos/${request.userId}/`,
        'Photo',
      )
      return reply.send(
        toOwnProfileWire(await addPhoto(app.mongo.db, request.userId, request.body.url)),
      )
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
      // Before any URL is signed, and this is the only place that can stop the
      // bytes: the client PUTs straight to the bucket and only then sends the
      // message, so refusing at send time would refuse a message pointing at a
      // photograph we had already stored.
      await assertMediaUnlocked(app.mongo.db, conversation, request.userId)

      const { kind, contentType, sizeBytes } = request.body
      if (mediaKindOfContentType(contentType) !== kind) {
        throw new ApiError(
          ERROR_CODES.UNSUPPORTED_MEDIA_TYPE,
          `${contentType} is not a supported ${kind} type`,
        )
      }
      // Here rather than only at send, which was after the bytes were stored.
      assertUploadSize(kind, sizeBytes)

      // Keyed by conversation so a leaked key reveals nothing about who is
      // talking. The account purge finds these through the message rows the
      // sender left behind; it could not do it from this prefix, which says
      // nothing about who uploaded.
      const extension = objectExtension(contentType)
      const key = `messages/${conversation._id.toHexString()}/${randomUUID()}.${extension}`
      const upload = await app.storage.getUploadUrl(key, contentType, sizeBytes)
      // After signing, so an unconfigured bucket records nothing; before the
      // reply, so no file can exist that the sweep does not know about.
      await recordPendingUpload(app.mongo.db, { url: upload.publicUrl, key })
      return reply.send(upload)
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
   * URL is signed — unlike a conversation. The deletion purge finds these
   * through the post and correction rows, not through the prefix.
   */
  app.post(
    '/posts/upload-url',
    { preHandler: requireVerifiedEmail, schema: { body: postMediaUploadUrlSchema } },
    async (request, reply) => {
      const { kind, contentType, sizeBytes } = request.body
      if (mediaKindOfContentType(contentType) !== kind) {
        throw new ApiError(
          ERROR_CODES.UNSUPPORTED_MEDIA_TYPE,
          `${contentType} is not a supported ${kind} type`,
        )
      }
      assertUploadSize(kind, sizeBytes)

      // One table for every kind now — see `objectExtension`.
      const extension = objectExtension(contentType)
      const key = `posts/${request.userId}/${randomUUID()}.${extension}`
      const upload = await app.storage.getUploadUrl(key, contentType, sizeBytes)
      // As for a chat upload: a post that is never sent leaves a file no row
      // names, and the sweep is the only thing that would ever find it while
      // the account lives. The post, correction or answer claims it.
      await recordPendingUpload(app.mongo.db, { url: upload.publicUrl, key })
      return reply.send(upload)
    },
  )

  /**
   * A presigned URL for a picture or a recording a person puts on their own
   * Echo card.
   *
   * `requireAuth`, not the `requireVerifiedEmail` above it, and matching the
   * rest of the module: a card is a note to yourself that nobody else can see,
   * so the guard is the one Echo already uses. The daily media ceiling is what
   * bounds the bytes, checked when the card is saved.
   *
   * Its own `echo/` prefix rather than the `posts/` one next door, for the
   * reason `feedback/` has one: the account purge deletes these by prefix,
   * because the card rows are deleted by the same purge and depending on which
   * of the two runs first is not worth doing.
   */
  app.post(
    '/echo/upload-url',
    { preHandler: requireAuth, schema: { body: postMediaUploadUrlSchema } },
    async (request, reply) => {
      const { kind, contentType, sizeBytes } = request.body
      if (mediaKindOfContentType(contentType) !== kind) {
        throw new ApiError(
          ERROR_CODES.UNSUPPORTED_MEDIA_TYPE,
          `${contentType} is not a supported ${kind} type`,
        )
      }
      assertUploadSize(kind, sizeBytes)

      const extension = objectExtension(contentType)
      const key = `echo/${request.userId}/${randomUUID()}.${extension}`
      const upload = await app.storage.getUploadUrl(key, contentType, sizeBytes)
      // The prefix only finds these once the account is purged; a picture
      // picked and never saved onto a card is the sweep's. `updateCard` claims.
      await recordPendingUpload(app.mongo.db, { url: upload.publicUrl, key })
      return reply.send(upload)
    },
  )

  /**
   * A presigned URL for the picture on a broadcast draft.
   *
   * `requireAdmin`, and keyed by nothing in particular: a broadcast belongs to
   * the operator panel rather than to a person, and the file outlives the
   * draft it was uploaded for — the message rows point at it once it has gone
   * out, so the account purge must never find it under somebody's prefix.
   *
   * Images only. The other two kinds would each need a ceiling, a player and a
   * reason; an announcement that needs a video needs a link to one.
   */
  app.post(
    '/admin/broadcasts/upload-url',
    { preHandler: requireAdmin, schema: { body: postMediaUploadUrlSchema } },
    async (request, reply) => {
      const { kind, contentType } = request.body
      if (kind !== 'image' || mediaKindOfContentType(contentType) !== 'image') {
        throw new ApiError(
          ERROR_CODES.UNSUPPORTED_MEDIA_TYPE,
          `${contentType} is not a supported image type`,
        )
      }

      const extension = objectExtension(contentType)
      const key = `broadcasts/${randomUUID()}.${extension}`
      return reply.send(await app.storage.getUploadUrl(key, contentType))
    },
  )

  app.delete(
    '/me/photos',
    { preHandler: requireMember, schema: { body: photoRemoveSchema } },
    async (request, reply) => {
      return reply.send(
        toOwnProfileWire(await removePhoto(app.mongo.db, request.userId, request.body.url)),
      )
    },
  )

  app.put(
    '/me/photos/order',
    { preHandler: requireMember, schema: { body: photoOrderSchema } },
    async (request, reply) => {
      return reply.send(
        toOwnProfileWire(await reorderPhotos(app.mongo.db, request.userId, request.body.urls)),
      )
    },
  )
}

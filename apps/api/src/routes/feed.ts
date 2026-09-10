import {
  createPostCommentSchema,
  createPostCorrectionSchema,
  createPostSchema,
  createPronunciationAnswerSchema,
  listFeedQuerySchema,
  listMyPostsQuerySchema,
  listPostCommentsQuerySchema,
  listPostCorrectionsQuerySchema,
  listPronunciationAnswersQuerySchema,
} from '@langx/shared'
import type { FastifyInstance } from 'fastify'
import type { FastifyPluginAsyncZod } from 'fastify-type-provider-zod'
import { ObjectId } from 'mongodb'
import { z } from 'zod'
import { COLLECTIONS } from '../db/collections'
import { requireAuth } from '../middleware/requireAuth'
import { requireVerifiedEmail } from '../middleware/requireAuth'
import { addComment, deleteComment, listPostComments } from '../modules/feed/comments'
import type { Post } from '../modules/feed/documents'
import { notifyPostReply, type FeedReply } from '../modules/notifications/social'
import {
  correctPost,
  createPost,
  deleteCorrection,
  deletePost,
  listFeed,
  listMyPosts,
  listPostCorrections,
} from '../modules/feed/feed'
import {
  answerPronunciation,
  deleteAnswer,
  listPronunciationAnswers,
} from '../modules/feed/pronunciation'

const postParamsSchema = z.object({ id: z.string() })
const childParamsSchema = z.object({ postId: z.string(), id: z.string() })

/**
 * Tells a post's author that somebody answered them.
 *
 * Never awaited into the response and never allowed to throw: the correction
 * is already written by the time this runs, and a push service having a bad
 * minute must not turn a successful write into a 500. `notifyPostReply`
 * swallows its own failures too; this catch is the belt to that's braces.
 */
function tellTheAuthor(
  app: FastifyInstance,
  postId: string,
  responderId: string,
  kind: FeedReply,
): void {
  void (async () => {
    const post = await app.mongo.db
      .collection<Post>(COLLECTIONS.posts)
      .findOne({ _id: new ObjectId(postId) }, { projection: { authorId: 1 } })
    if (!post) return
    await notifyPostReply(
      app.mongo.db,
      { push: app.push, logger: app.log },
      { postId: post._id, authorId: post.authorId, responderId, kind },
    )
  })().catch((error: unknown) => {
    app.log.error({ err: error, postId }, 'feed reply push failed')
  })
}

// eslint-disable-next-line @typescript-eslint/require-await -- Fastify plugin signature
export const feedRoutes: FastifyPluginAsyncZod = async (app) => {
  app.get(
    '/feed',
    { preHandler: requireAuth, schema: { querystring: listFeedQuerySchema } },
    async (request, reply) => {
      return reply.send(await listFeed(app.mongo.db, request.userId, request.query))
    },
  )

  /**
   * Your own posts, newest first.
   *
   * Hangs off `/me` for the same reason `/me/corrections` and `/me/starred` do:
   * it is a read across the whole collection that names only you. Paged rather
   * than capped, because the answer to "where is the thing I asked last month"
   * has to still be reachable in a year.
   */
  app.get(
    '/me/posts',
    { preHandler: requireAuth, schema: { querystring: listMyPostsQuerySchema } },
    async (request, reply) => {
      return reply.send(await listMyPosts(app.mongo.db, request.userId, request.query))
    },
  )

  // Verified, like starting a conversation: a post is visible to strangers and
  // is the cheapest thing in the app to write, so it is the first place an
  // unverified account would be used to reach people.
  app.post(
    '/posts',
    { preHandler: requireVerifiedEmail, schema: { body: createPostSchema } },
    async (request, reply) => {
      return reply
        .code(201)
        .send(
          await createPost(
            app.mongo.db,
            request.userId,
            request.body,
            app.env.STORAGE_PUBLIC_BASE_URL,
            app.normalizeAttachments,
          ),
        )
    },
  )

  app.get(
    '/posts/:id/corrections',
    {
      preHandler: requireAuth,
      schema: { params: postParamsSchema, querystring: listPostCorrectionsQuerySchema },
    },
    async (request, reply) => {
      return reply.send(
        await listPostCorrections(app.mongo.db, request.userId, request.params.id, request.query),
      )
    },
  )

  app.post(
    '/posts/:id/corrections',
    {
      preHandler: requireVerifiedEmail,
      schema: { params: postParamsSchema, body: createPostCorrectionSchema },
    },
    async (request, reply) => {
      const correction = await correctPost(
        app.mongo.db,
        request.userId,
        request.params.id,
        request.body,
        app.env.STORAGE_PUBLIC_BASE_URL,
        app.normalizeAttachments,
      )
      tellTheAuthor(app, request.params.id, request.userId, 'correction')
      return reply.code(201).send(correction)
    },
  )

  /**
   * Deleting your own post takes its corrections, answers, comments and likes
   * with it. `requireAuth` rather than `requireVerifiedEmail`: removing your
   * own words is not a thing to gate behind an inbox you may no longer have.
   */
  app.delete(
    '/posts/:id',
    { preHandler: requireAuth, schema: { params: postParamsSchema } },
    async (request, reply) => {
      await deletePost(app.mongo.db, request.userId, request.params.id, app.storage)
      return reply.code(204).send()
    },
  )

  app.get(
    '/posts/:id/comments',
    {
      preHandler: requireAuth,
      schema: { params: postParamsSchema, querystring: listPostCommentsQuerySchema },
    },
    async (request, reply) => {
      return reply.send(
        await listPostComments(app.mongo.db, request.userId, request.params.id, request.query),
      )
    },
  )

  app.post(
    '/posts/:id/comments',
    {
      preHandler: requireVerifiedEmail,
      schema: { params: postParamsSchema, body: createPostCommentSchema },
    },
    async (request, reply) => {
      const comment = await addComment(
        app.mongo.db,
        request.userId,
        request.params.id,
        request.body,
      )
      tellTheAuthor(app, request.params.id, request.userId, 'comment')
      return reply.code(201).send(comment)
    },
  )

  app.delete(
    '/posts/:postId/comments/:id',
    { preHandler: requireAuth, schema: { params: childParamsSchema } },
    async (request, reply) => {
      await deleteComment(app.mongo.db, request.userId, request.params.postId, request.params.id)
      return reply.code(204).send()
    },
  )

  app.delete(
    '/posts/:postId/corrections/:id',
    { preHandler: requireAuth, schema: { params: childParamsSchema } },
    async (request, reply) => {
      await deleteCorrection(
        app.mongo.db,
        request.userId,
        request.params.postId,
        request.params.id,
        app.storage,
      )
      return reply.code(204).send()
    },
  )

  app.get(
    '/posts/:id/answers',
    {
      preHandler: requireAuth,
      schema: { params: postParamsSchema, querystring: listPronunciationAnswersQuerySchema },
    },
    async (request, reply) => {
      return reply.send(
        await listPronunciationAnswers(
          app.mongo.db,
          request.userId,
          request.params.id,
          request.query,
        ),
      )
    },
  )

  app.post(
    '/posts/:id/answers',
    {
      preHandler: requireVerifiedEmail,
      schema: { params: postParamsSchema, body: createPronunciationAnswerSchema },
    },
    async (request, reply) => {
      const answer = await answerPronunciation(
        app.mongo.db,
        request.userId,
        request.params.id,
        request.body,
        app.env.STORAGE_PUBLIC_BASE_URL,
        app.normalizeAttachments,
      )
      tellTheAuthor(app, request.params.id, request.userId, 'answer')
      return reply.code(201).send(answer)
    },
  )

  app.delete(
    '/posts/:postId/answers/:id',
    { preHandler: requireAuth, schema: { params: childParamsSchema } },
    async (request, reply) => {
      await deleteAnswer(
        app.mongo.db,
        request.userId,
        request.params.postId,
        request.params.id,
        app.storage,
      )
      return reply.code(204).send()
    },
  )
}

import { COMMENT_TO_DM_PAYLOADS, COMMENT_TO_DM_RULES } from '@langx/shared'
import type { Db } from 'mongodb'
import { MongoMemoryReplSet } from 'mongodb-memory-server'
import { afterAll, beforeAll, beforeEach, describe, expect, it } from 'vitest'
import { connectToDatabase, type DbHandle } from '../../db/client'
import { COLLECTIONS } from '../../db/collections'
import type { InstagramGraph, MessageButton } from './graph'
import { handleEvents, type GrowthDeps, type ParsedEvent } from './handle'
import { ASK_TO_FOLLOW, ASK_TO_FOLLOW_AGAIN, DELIVERY } from './messages'

/**
 * A Graph that writes down what it was asked to do, in order.
 *
 * The order is the point. Both bugs this feature has shipped were orderings —
 * a reply that never went out because an earlier one had, and a question
 * answered by the tap that caused it — and neither is visible in anything
 * except the sequence of calls.
 */
function recording(follows: boolean | (() => boolean)) {
  const calls: string[] = []
  const graph: InstagramGraph = {
    accountId: () => Promise.resolve('us'),
    replyToComment: (commentId, message) => {
      calls.push(`replyToComment ${commentId} ${message}`)
      return Promise.resolve()
    },
    sendPrivateReply: (commentId, _message, buttons?: readonly MessageButton[]) => {
      calls.push(`sendPrivateReply ${commentId} [${buttons?.map((b) => b.title).join()}]`)
      return Promise.resolve()
    },
    sendMessage: (recipientId, message, buttons?: readonly MessageButton[]) => {
      calls.push(`sendMessage ${recipientId} ${message} [${buttons?.map((b) => b.title).join()}]`)
      return Promise.resolve()
    },
    follows: () => Promise.resolve(typeof follows === 'function' ? follows() : follows),
  }
  return { graph, calls }
}

describe('handleEvents', () => {
  let replSet: MongoMemoryReplSet
  let handle: DbHandle
  let db: Db

  beforeAll(async () => {
    replSet = await MongoMemoryReplSet.create({ replSet: { count: 1 } })
    handle = await connectToDatabase(replSet.getUri(), 'langx_growth_handle_test')
    db = handle.db
  }, 120_000)

  afterAll(async () => {
    await handle.close()
    await replSet.stop()
  })

  beforeEach(async () => {
    await db.collection(COLLECTIONS.instagramComments).deleteMany({})
    await db.collection(COLLECTIONS.instagramLeads).deleteMany({})
  })

  /** Everything real except the waiting, which is deliberate and not the subject. */
  const deps = (graph: InstagramGraph | null): GrowthDeps => ({
    db,
    graph,
    log: { debug: () => undefined, warn: () => undefined },
    sleep: () => Promise.resolve(),
  })

  /**
   * The wall clock, deliberately.
   *
   * The rule under test compares Instagram's timestamp for an event against
   * our own `platformAskedAt`, written with `new Date()` when the question
   * goes out — two clocks, one real. Fixed timestamps in the past would sit
   * before every question ever asked and make the rule look broken, so each
   * event is stamped when it is sent, exactly as a real one is.
   *
   * What this does **not** give is an ordering. A round trip through an
   * in-memory replica set can finish inside one millisecond, so a stamp taken
   * after the question can equal the question's own — and the rule reads `<=`,
   * on purpose, so equal means "the tap that prompted this". A test that wants
   * an answer to land after a question has to say so: see `afterTheQuestion`.
   */
  const clock = () => () => new Date()

  /**
   * A stamp strictly later than the question's own, read from the row the
   * question wrote.
   *
   * Sleeping until the clock moved would do the same thing and say less: what
   * this test needs is not elapsed time but the one relation the rule is
   * about, and taking it from `platformAskedAt` states it.
   */
  async function afterTheQuestion(): Promise<Date> {
    const lead = await db
      .collection<{ platformAskedAt?: Date }>(COLLECTIONS.instagramLeads)
      .findOne({ _id: 'them' as never })
    if (!lead?.platformAskedAt) throw new Error('the question was never asked')
    return new Date(lead.platformAskedAt.getTime() + 1)
  }

  const tap = (payload: string, at: Date): ParsedEvent => ({
    kind: 'message',
    senderId: 'them',
    text: payload,
    at,
  })

  it('answers a comment in public first, then in private, with a button', async () => {
    const { graph, calls } = recording(false)
    const event: ParsedEvent = {
      kind: 'comment',
      commentId: 'c1',
      text: 'LANGX',
      fromId: 'them',
      postedAt: new Date(),
    }

    await handleEvents([event], deps(graph))

    // Public first: the reply under the post is what tells everybody else
    // scrolling past that something happened.
    expect(calls[0]).toContain('replyToComment c1')
    expect(calls[1]).toContain('sendPrivateReply c1 [Get my link]')
    expect(calls).toHaveLength(2)
  })

  it('answers the same comment only once, however many times it arrives', async () => {
    // Instagram retries anything it did not get a prompt 200 for, and the
    // platform allows exactly one private reply per comment.
    const { graph, calls } = recording(false)
    const event: ParsedEvent = {
      kind: 'comment',
      commentId: 'c1',
      text: 'LANGX',
      fromId: 'them',
      postedAt: new Date(),
    }

    await handleEvents([event, { ...event }], deps(graph))

    expect(calls.filter((c) => c.startsWith('sendPrivateReply'))).toHaveLength(1)
  })

  it('answers a tap on "I followed" even when the follow is still missing', async () => {
    /*
     * The regression. This used to stop after the first ask, so tapping
     * "I followed" produced nothing at all — no refusal, no message, a thread
     * that simply stopped. Every one of these is the reply to a button the
     * person just pressed.
     */
    const { graph, calls } = recording(false)
    const next = clock()

    await handleEvents([tap(COMMENT_TO_DM_PAYLOADS.sendLink, next())], deps(graph))
    await handleEvents([tap(COMMENT_TO_DM_PAYLOADS.followed, next())], deps(graph))

    expect(calls).toHaveLength(2)
    expect(calls[0]).toContain(ASK_TO_FOLLOW)
    // And not the same words twice, which is what reads as a loop.
    expect(calls[1]).toContain(ASK_TO_FOLLOW_AGAIN)
  })

  it('does not deliver on the copy of the tap that prompted the question', async () => {
    /*
     * The other regression, and the one that cost a live test.
     *
     * A single tap reaches the webhook twice: the button press, and the
     * message the button leaves in the thread. Walked in order, the first
     * asked which phone they were on and the second read the flag it had just
     * written and sent the link — 2.9 seconds after the question, to somebody
     * who had not answered it.
     */
    const { graph, calls } = recording(true)
    const at = clock()()

    await handleEvents(
      [
        { kind: 'message', senderId: 'them', text: COMMENT_TO_DM_PAYLOADS.followed, at },
        { kind: 'message', senderId: 'them', text: 'I followed', at },
      ],
      deps(graph),
    )

    expect(calls).toHaveLength(1)
    expect(calls[0]).toContain('[iPhone,Android]')
    expect(calls.join()).not.toContain(DELIVERY)
  })

  it('delivers when the answer really does come after the question', async () => {
    const { graph, calls } = recording(true)
    const next = clock()

    await handleEvents([tap(COMMENT_TO_DM_PAYLOADS.followed, next())], deps(graph))
    await handleEvents([tap(COMMENT_TO_DM_PAYLOADS.ios, await afterTheQuestion())], deps(graph))

    expect(calls[1]).toContain(DELIVERY)
    const lead = await db.collection(COLLECTIONS.instagramLeads).findOne({ _id: 'them' as never })
    expect(lead).toMatchObject({ platform: 'ios' })
  })

  it('sends the link anyway once it has asked for the follow enough times', async () => {
    const { graph, calls } = recording(false)
    const d = deps(graph)
    const next = clock()

    for (let i = 0; i < COMMENT_TO_DM_RULES.followAsksBeforeGivingUp; i += 1) {
      await handleEvents([tap(COMMENT_TO_DM_PAYLOADS.followed, next())], d)
    }
    expect(calls.every((c) => !c.includes(DELIVERY))).toBe(true)

    // The ask after the last one gives up and moves on.
    await handleEvents([tap(COMMENT_TO_DM_PAYLOADS.followed, next())], d)
    await handleEvents([tap(COMMENT_TO_DM_PAYLOADS.android, next())], d)

    expect(calls.at(-1)).toContain(DELIVERY)
  })

  it('never sends the link twice', async () => {
    const { graph, calls } = recording(true)
    const d = deps(graph)
    const next = clock()

    await handleEvents([tap(COMMENT_TO_DM_PAYLOADS.followed, next())], d)
    await handleEvents([tap(COMMENT_TO_DM_PAYLOADS.ios, next())], d)
    await handleEvents([tap('thanks!', next())], d)

    expect(calls.filter((c) => c.includes(DELIVERY))).toHaveLength(1)
  })

  it('takes a just-tapped "I followed" seriously enough to look twice', async () => {
    // Instagram does not report a follow the instant it happens, and the
    // person that lands on is exactly the one who just said they followed.
    let reads = 0
    const { graph, calls } = recording(() => {
      reads += 1
      return reads > 1
    })

    await handleEvents([tap(COMMENT_TO_DM_PAYLOADS.followed, clock()())], deps(graph))

    expect(reads).toBe(2)
    expect(calls[0]).toContain('[iPhone,Android]')
  })

  it('decides, and sends nothing, with no page token configured', async () => {
    // The optional-service rule: unconfigured is quiet, not broken.
    await expect(
      handleEvents([tap(COMMENT_TO_DM_PAYLOADS.sendLink, clock()())], deps(null)),
    ).resolves.toBeUndefined()
  })
})

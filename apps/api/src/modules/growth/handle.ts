import { COMMENT_TO_DM_PAYLOADS, COMMENT_TO_DM_RULES } from '@langx/shared'
import { decideForComment, decideForMessage, type GrowthAction } from './flow'
import type { InstagramGraph } from './graph'
import {
  ASK_PLATFORM,
  ASK_TO_FOLLOW,
  ASK_TO_FOLLOW_AGAIN,
  DELIVERY,
  FOLLOWED_BUTTON,
  PLATFORM_BUTTONS,
  PRIVATE_REPLIES,
  PUBLIC_REPLIES,
  SEND_LINK_BUTTON,
  pick,
} from './messages'
import {
  claimComment,
  countFollowAsk,
  markDelivered,
  markPlatformAsked,
  recordInboundMessage,
} from './repo'
import type { Db } from 'mongodb'

/**
 * What the webhook does once the body has been read and its signature
 * checked — everything except the HTTP.
 *
 * It lives here rather than in the route because of what went wrong twice.
 * Both live bugs in this feature were in the code below: a guard that
 * silently dropped the reply to a tapped button, and two events from one tap
 * being walked in an order that answered a question with the tap that had
 * caused it. Neither could be tested while it sat in closures inside a
 * Fastify plugin that builds its own Graph client out of `app.env` — the
 * route's tests run without a token, so they never reached any of it.
 *
 * With the dependencies passed in, `handle.test.ts` drives the whole thing
 * against a real database and a recording Graph, and can assert the one thing
 * that actually matters here: what gets called, and in what order.
 */
export type ParsedEvent =
  | { kind: 'comment'; commentId: string; text: string; fromId: string; postedAt: Date }
  | { kind: 'message'; senderId: string; text: string; at: Date }

export interface GrowthDeps {
  db: Db
  /**
   * Null when no page token is configured. Decisions still run and are still
   * logged; nothing is sent. That is the same shape every optional service in
   * this codebase degrades to.
   */
  graph: InstagramGraph | null
  /** `IG_ACCOUNT_ID`, used only when the token cannot say who it is. */
  fallbackAccountId?: string
  log: {
    debug(details: Record<string, unknown>, message: string): void
    warn(details: Record<string, unknown> | string, message?: string): void
  }
  /**
   * Injected so a test does not sit out the seconds a comment waits, or the
   * eight a follow re-check does. The delays are real and deliberate; waiting
   * for them to prove an ordering is not.
   */
  sleep?: (ms: number) => Promise<void>
}

const realSleep = (ms: number): Promise<void> =>
  new Promise((resolve) => {
    setTimeout(resolve, ms)
  })

/** In order, and one at a time: the order is the behaviour. */
export async function handleEvents(events: ParsedEvent[], deps: GrowthDeps): Promise<void> {
  for (const event of events) {
    const action =
      event.kind === 'comment'
        ? decideForComment(event, {
            seen: !(await claimComment(deps.db, event.commentId)),
            selfId: await selfId(deps),
            postedAt: event.postedAt,
            now: new Date(),
          })
        : await decideForMessageEvent(event, deps)

    if (action.kind === 'ignore') {
      deps.log.debug({ because: action.because }, 'instagram event ignored')
      continue
    }
    if (!deps.graph) {
      deps.log.warn('instagram action skipped: no page token configured')
      continue
    }
    await perform(action, deps.graph, deps)
  }
}

/**
 * Who we are, for the "do not answer ourselves" check.
 *
 * Asked of the token when there is one, because the configured id and the one
 * the token answers with are not always the same. An empty string when
 * neither is available matches nothing, which fails towards answering a
 * stranger rather than towards silence.
 */
async function selfId(deps: GrowthDeps): Promise<string> {
  if (!deps.graph) return deps.fallbackAccountId ?? ''
  try {
    return await deps.graph.accountId()
  } catch (caught) {
    deps.log.warn({ err: caught }, 'instagram /me lookup failed')
    return deps.fallbackAccountId ?? ''
  }
}

async function decideForMessageEvent(
  event: Extract<ParsedEvent, { kind: 'message' }>,
  deps: GrowthDeps,
): Promise<GrowthAction> {
  const sleep = deps.sleep ?? realSleep
  const lead = await recordInboundMessage(deps.db, event.senderId, event.at)
  // Asked now and not at comment time because now is the first moment Meta
  // will answer it.
  let follows = deps.graph ? await deps.graph.follows(event.senderId) : false
  /*
   * Somebody who just tapped "I followed" is the one person this call is most
   * likely to be wrong about: Instagram does not report a follow the instant
   * it happens. Refusing them on the first read would turn the platform's lag
   * into our dead end, so the claim is taken seriously enough to look once
   * more.
   */
  if (!follows && deps.graph && event.text === COMMENT_TO_DM_PAYLOADS.followed) {
    await sleep(COMMENT_TO_DM_RULES.followRecheckMs)
    follows = await deps.graph.follows(event.senderId)
  }
  return decideForMessage(event, {
    follows,
    delivered: lead.deliveredAt !== undefined,
    withinWindow: Date.now() - event.at.getTime() < COMMENT_TO_DM_RULES.conversationWindowMs,
    ...(lead.platformAskedAt ? { platformAskedAt: lead.platformAskedAt } : {}),
    followAsks: lead.followAsks ?? 0,
  })
}

async function perform(
  action: GrowthAction,
  graph: InstagramGraph,
  deps: GrowthDeps,
): Promise<void> {
  const sleep = deps.sleep ?? realSleep
  switch (action.kind) {
    case 'answerComment': {
      await sleep(action.delayMs)
      await graph.replyToComment(action.commentId, pick(PUBLIC_REPLIES))
      await graph.sendPrivateReply(action.commentId, pick(PRIVATE_REPLIES), [SEND_LINK_BUTTON])
      return
    }
    case 'deliver': {
      await graph.sendMessage(action.recipientId, DELIVERY)
      await markDelivered(deps.db, action.recipientId, action.platform)
      return
    }
    case 'askPlatform': {
      // Marked before the send, not after: a failure here must not leave
      // somebody being asked the same question on every reply.
      await markPlatformAsked(deps.db, action.recipientId)
      await graph.sendMessage(action.recipientId, ASK_PLATFORM, PLATFORM_BUTTONS)
      return
    }
    case 'askToFollow': {
      /*
       * Always an answer, never silence.
       *
       * This used to stop after the first ask, which was right when the only
       * way to get here was to type something unprompted — a brand that
       * repeats itself at somebody is harassing them. With buttons it is
       * exactly backwards: every one of these is the reply to a tap the
       * person just made, and the guard turned "I followed" into a message
       * that did nothing at all. Repeating is not the risk; leaving them
       * staring at their own tap is.
       */
      const asks = await countFollowAsk(deps.db, action.recipientId)
      const message = asks > 1 ? ASK_TO_FOLLOW_AGAIN : ASK_TO_FOLLOW
      await graph.sendMessage(action.recipientId, message, [FOLLOWED_BUTTON])
      return
    }
    default:
      return
  }
}

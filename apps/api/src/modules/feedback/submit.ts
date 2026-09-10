import type { FeedbackInput } from '@langx/shared'
import { randomUUID } from 'node:crypto'
import type { FastifyInstance } from 'fastify'
import { BOUNTY_TOKEN_TTL_MS, bountyAwardUrl, signBountyToken } from '../../email/bountyToken'
import { feedbackEmail } from '../../email/templates'
import { publicApiUrl } from '../../env'
import { assertAttachmentsAllowed } from '../media/assertMedia'
import { emailFor } from '../profiles/emailFor'
import { getProfile } from '../profiles/profiles'
import { newIssueUrl } from './githubIssue'

/**
 * A bug or an idea, on its way to the support mailbox.
 *
 * Lifted out of `POST /feedback` unchanged so the assistant can file one from
 * a conversation. The alternative was a second sender beside this one, which
 * would have been a second prefilled issue link, a second bounty link and a
 * second mail template to keep in step — three things that only fail quietly,
 * on the one path where the person has already been told it was sent.
 *
 * The route keeps what belongs to a route: its rate limit, its schema and its
 * 202.
 */
export async function submitFeedback(
  app: FastifyInstance,
  userId: string,
  input: FeedbackInput,
): Promise<void> {
  const attachments = input.attachments ?? []
  // Before anything leaves this process: the same ceilings and the same bucket
  // check every other attachment goes through. A URL outside our own storage
  // would put a link to wherever the sender liked in a public issue.
  if (attachments.length > 0) {
    assertAttachmentsAllowed(attachments, app.env.STORAGE_PUBLIC_BASE_URL)
  }

  const profile = await getProfile(app.mongo.db, userId)
  const address = await emailFor(app.mongo.db, userId)
  const attachmentUrls = attachments.map((item) => item.url)

  /*
   * A link to GitHub's own new-issue form, prefilled — not an issue. This
   * service holds no credential that can write to the tracker, so nothing here
   * can be revoked, leaked or silently expire, and a person decides what
   * becomes public. See `githubIssue.ts`.
   */
  const issueUrl = newIssueUrl(app.env.GITHUB_ISSUE_REPO, {
    kind: input.kind,
    body: input.body,
    attachmentCount: attachments.length,
  })

  /*
   * The report's own id, and the only place it is ever written down is the
   * link below — which is enough, because the one thing it has to be is the
   * ledger's `refId`, and the ledger is what remembers it after that.
   */
  const reportId = randomUUID()
  const awardUrl = bountyAwardUrl(
    publicApiUrl(app.env),
    signBountyToken(app.env.BETTER_AUTH_SECRET, {
      userId,
      reportId,
      expiresAt: Date.now() + BOUNTY_TOKEN_TTL_MS,
    }),
  )

  const mail = feedbackEmail({
    kind: input.kind,
    body: input.body,
    attachmentUrls,
    sender: {
      userId,
      handle: profile?.handle ?? null,
      email: address?.email ?? null,
    },
    awardUrl,
    newIssueUrl: issueUrl,
  })

  await app.email.send({
    to: app.env.SUPPORT_EMAIL,
    ...mail,
    // So that confirming a report — or asking for the step that is missing —
    // is a reply rather than a lookup.
    ...(address ? { headers: { 'Reply-To': address.email } } : {}),
  })
}

import { resolveNotificationPrefs } from '@langx/shared'
import type { Db } from 'mongodb'
import { COLLECTIONS } from '../../db/collections'
import type { Profile } from '../profiles/profiles'
import { audiencePlan, type AudienceSource } from './audience'

/**
 * Writes down, in the only place the app reads it, a consent that was given
 * somewhere else.
 *
 * `promotions.email` is the one preference that is never inferred — a default
 * cannot grant it and an older stored shape cannot imply it. That rule is
 * right, and this does not weaken it: it **records** an answer rather than
 * guessing one. Whoever runs it is asserting that these people said yes at v1's
 * sign-up, and the record they leave behind is the profile itself, where its
 * owner can see the switch and turn it off.
 *
 * Two things it will not do. It never touches somebody who said no — those are
 * filtered out upstream by `audiencePlan`, which knows the difference between a
 * refusal and a default nobody was asked about. And it never invents a profile
 * for an account that has none: a pre-created v1 row has no `profiles`
 * document until its owner onboards, so there is nowhere for the consent to
 * live yet, and those are counted rather than written.
 */

/** How a recorded consent got there, kept so a later question has an answer. */
export interface PromotionsConsent {
  source: AudienceSource
  at: Date
}

export interface ConsentAdoption {
  /** Profiles written, or that would be written on a dry run. */
  updated: string[]
  /** Already say yes; nothing to do. */
  alreadyRecorded: number
  /** No `profiles` document, so the consent has nowhere to live yet. */
  noProfile: number
  /** Said no, in this database. Never touched, whatever the source claims. */
  refused: number
}

/** Mongo takes far more than this at once; the cap is about a readable failure. */
const WRITE_CHUNK = 500

export async function adoptPromotionsConsent(
  db: Db,
  source: AudienceSource,
  options: { limit?: number; apply?: boolean } = {},
): Promise<ConsentAdoption> {
  const plan = await audiencePlan(db, source)
  const candidates = plan.contacts.filter((contact) => contact.action === 'subscribe')
  const refused = plan.contacts.filter((contact) => contact.action === 'unsubscribe').length

  const profiles = new Map(
    (
      await db
        .collection<Profile>(COLLECTIONS.profiles)
        .find(
          { _id: { $in: candidates.map((contact) => contact.userId) } },
          { projection: { settings: 1 } },
        )
        .toArray()
    ).map((profile) => [profile._id, profile]),
  )

  const outcome: ConsentAdoption = { updated: [], alreadyRecorded: 0, noProfile: 0, refused }
  const writes: { userId: string; notifications: ReturnType<typeof resolveNotificationPrefs> }[] =
    []

  for (const contact of candidates) {
    const profile = profiles.get(contact.userId)
    if (!profile) {
      outcome.noProfile++
      continue
    }
    /*
     * Resolved rather than patched. The stored value may be v1's single
     * boolean or the bare boolean per kind, and a dotted path cannot reach
     * into either — `settings.notifications.promotions.email` on a boolean
     * writes nothing and reports success. Resolving answers every cell the way
     * `notificationsAllowed` already answers it and then changes exactly one,
     * so nobody's mail changes except the promotion they consented to.
     */
    const resolved = resolveNotificationPrefs(profile.settings?.notifications)
    if (resolved.promotions.email) {
      outcome.alreadyRecorded++
      continue
    }
    resolved.promotions = { ...resolved.promotions, email: true }
    writes.push({ userId: contact.userId, notifications: resolved })
    outcome.updated.push(contact.userId)
    if (options.limit && outcome.updated.length >= options.limit) break
  }

  if (!options.apply) return outcome

  const at = new Date()
  for (let index = 0; index < writes.length; index += WRITE_CHUNK) {
    await db.collection<Profile>(COLLECTIONS.profiles).bulkWrite(
      writes.slice(index, index + WRITE_CHUNK).map((write) => ({
        updateOne: {
          filter: { _id: write.userId },
          update: {
            $set: {
              'settings.notifications': write.notifications,
              promotionsConsent: { source, at } satisfies PromotionsConsent,
            },
          },
        },
      })),
    )
  }

  return outcome
}

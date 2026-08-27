import { TOKEN_RULES } from '@langx/shared'
import type { Db } from 'mongodb'
import { awardTokens } from './ledger'

/**
 * What a new account starts with.
 *
 * Without it the token store is inert on day one — a balance of zero, every
 * row priced out, and no way to discover that any of it is real. The grant is
 * enough for a streak freeze, which is the one thing worth owning before you
 * have earned anything: it protects the first day you miss.
 *
 * `refId` is the user id, so the ledger's `user_kind_ref_unique` index decides
 * once and for all whether this account has been paid — no flag on the
 * profile, no check here, and safe to call from more than one place. Which it
 * is: a profile is created either by `createProfile` (onboarding) or by
 * `restoreByHash` (a returning v1 user never sees that form), and both call
 * this.
 *
 * A returning user gets this *and* the welcome-back bonus. That is intended —
 * one is for having an account, the other is for coming back.
 *
 * There is no farming incentive to guard against: tokens cannot be bought,
 * sold, traded, transferred or withdrawn, so a second account earns its owner
 * nothing they can use on the first.
 */
export async function grantSignupBonus(db: Db, userId: string, at?: Date): Promise<number> {
  const result = await awardTokens(db, {
    userId,
    kind: 'signupBonus',
    amount: TOKEN_RULES.signupBonus,
    refId: userId,
    ...(at ? { at } : {}),
  })
  return result.amount
}

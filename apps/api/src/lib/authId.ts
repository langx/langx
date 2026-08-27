import { ObjectId } from 'mongodb'

/**
 * Two id worlds live in this database and they do not look the same.
 *
 * Better Auth's own collections (`user`, `session`, `account`, `verification`)
 * store ids as **ObjectId**. Every domain collection we own stores the *string*
 * form, because `profiles._id` is the user id and a string `_id` is what makes
 * `tokenAggregates`'s `<userId>:<period>` keys and `dailyActivity`'s
 * `<userId>:<day>` keys work at all.
 *
 * The failure this prevents is silent: `deleteMany({ userId: '6a8f...' })`
 * against `session` matches nothing and reports success, so a deleted account
 * keeps a live session. Caught exactly that way — the deletion test found a
 * signed-out user still authenticated.
 *
 * Use this at every boundary that touches a Better Auth collection.
 */
export function authId(userId: string): ObjectId {
  return new ObjectId(userId)
}

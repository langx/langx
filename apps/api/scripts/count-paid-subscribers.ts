/**
 * How many people are actually on a paid plan right now, and how many of them
 * have a setting that a tier change would take away.
 *
 * Read-only, and it exists because moving a capability between tiers is only
 * safe to do quietly when nobody is paying for it. `promise-change.md` treats
 * taking something back from a paying customer as a communication deliverable,
 * not a code change — this is how you find out which one you are doing.
 */
import { connectToDatabase } from '../src/db/client'
import { loadEnv } from '../src/env'
import { COLLECTIONS } from '../src/db/collections'
import type { Profile } from '../src/modules/profiles/profiles'

const env = loadEnv()
const dbName = process.argv[process.argv.indexOf('--db') + 1] ?? env.MONGODB_DB
const handle = await connectToDatabase(env.MONGODB_URI, dbName)
const profiles = handle.db.collection<Profile>(COLLECTIONS.profiles)

const live = {
  $or: [
    { 'entitlement.expiresAt': { $exists: false } },
    { 'entitlement.expiresAt': { $gt: new Date() } },
  ],
}

const [total, pro, proPlus, proWithIncognito] = await Promise.all([
  profiles.countDocuments({}),
  profiles.countDocuments({ 'entitlement.tier': 'pro', ...live }),
  profiles.countDocuments({ 'entitlement.tier': 'pro_plus', ...live }),
  profiles.countDocuments({ 'entitlement.tier': 'pro', 'privacy.incognito': true, ...live }),
])

console.log(`db                        ${dbName}`)
console.log(`profiles                  ${total}`)
console.log(`live Fluent (pro)         ${pro}`)
console.log(`live Polyglot (pro_plus)  ${proPlus}`)
console.log(`  of Fluent, incognito on ${proWithIncognito}`)
await handle.client.close()

/**
 * Read-only: what the read-before-write bugs left behind.
 *
 * Seven fixes landed together, and every one of them was forward-looking —
 * each stops the damage, none repairs what was already written. This says how
 * much there is, per bug, so that the decision about whether any repair is
 * worth writing is made from numbers rather than from a guess. It changes
 * nothing; a `migrate-*` script is the thing that would, and none exists yet
 * on purpose.
 *
 * Read the counts as an upper bound rather than a diagnosis. Each section says
 * what it cannot tell apart, because a row that looks damaged and a row that
 * is merely unusual are not always distinguishable after the fact.
 *
 *   cd apps/api && pnpm exec tsx --env-file=../../.env --env-file=../../.env.prod scripts/inspect-race-damage.ts
 */
import { MARKETING_MIN_GAP_DAYS, MAX_PINNED_CONVERSATIONS, TOKEN_RULES } from '@langx/shared'
import { connectToDatabase } from '../src/db/client'
import { COLLECTIONS } from '../src/db/collections'
import { loadEnv } from '../src/env'

/** `indexOf` returns -1 for a flag that is absent, and argv[0] is the node binary. */
function flag(name: string): string | undefined {
  const at = process.argv.indexOf(name)
  return at === -1 ? undefined : process.argv[at + 1]
}

/** How many example ids each section prints, so the output stays readable. */
const SAMPLES = Number(flag('--samples')) || 5

const env = loadEnv()
const dbName = flag('--db') ?? env.MONGODB_DB
const handle = await connectToDatabase(env.MONGODB_URI, dbName)
const db = handle.db

function section(n: number, title: string): void {
  console.log('')
  console.log(`── ${String(n)}. ${title}`)
}

function report(count: number, what: string, samples: unknown[] = []): void {
  console.log(`   ${String(count).padStart(6)}  ${what}`)
  if (count > 0 && samples.length > 0) console.log(`           e.g. ${samples.join(', ')}`)
}

console.log(`db  ${dbName}`)

// ── 1. reservations spent by a change that was then refused ────────────────
section(1, 'v1 handle reservations burned by a refused rename')
{
  const claimed = await db
    .collection<{ handle: string; claimedBy?: string }>(COLLECTIONS.handleReservations)
    .find({ claimedBy: { $exists: true } })
    .toArray()

  const burned: string[] = []
  for (const row of claimed) {
    // The claim is honest when somebody actually holds the name. It is burned
    // when nobody does — the refusal spent it and the handle stayed free.
    const holder = await db
      .collection<{ _id: string }>(COLLECTIONS.profiles)
      .findOne({ handle: row.handle }, { projection: { _id: 1 } })
    if (!holder) burned.push(`@${row.handle}`)
  }

  report(claimed.length, 'reservations carry a claim')
  report(
    burned.length,
    'of those are held by nobody — the claim bought nothing',
    burned.slice(0, SAMPLES),
  )
  console.log('           (a name whose claimer has since deleted their account looks the same)')
}

// ── 2. referral audit rows a retry overwrote with zero ─────────────────────
section(2, 'referrals recorded as having paid nothing, where the ledger says otherwise')
{
  const rows = await db
    .collection<{
      _id: string
      referrerId: string
      activationAward?: number
      inviteeAward?: number
      subscriptionAward?: number
    }>(COLLECTIONS.referrals)
    .find({
      $or: [{ activationAward: 0 }, { inviteeAward: 0 }, { subscriptionAward: 0 }],
    })
    .toArray()

  const wrong: string[] = []
  for (const row of rows) {
    // A frozen referrer is genuinely recorded as 0 and no ledger row exists,
    // which is what tells the two apart.
    const paid = await db.collection<{ amount: number }>(COLLECTIONS.tokenLedger).findOne({
      refId: row._id,
      kind: { $in: ['referral', 'referralWelcome', 'referralSubscription'] },
      amount: { $gt: 0 },
    })
    if (paid) wrong.push(row._id)
  }

  report(rows.length, 'referral rows carry a zero award')
  report(wrong.length, 'of those have a paid ledger row behind them', wrong.slice(0, SAMPLES))
  console.log(
    '           (these under-report `tokensEarned` on the invite screen; the wallet is right)',
  )
}

// ── 3. repairs bought past the monthly cap ─────────────────────────────────
section(
  3,
  `streak repairs past ${String(TOKEN_RULES.sinks.dayRepairPerMonth)} in one calendar month`,
)
{
  const over = await db
    .collection(COLLECTIONS.streakDays)
    .aggregate<{ _id: { userId: string; month: string }; bought: number }>([
      { $match: { source: 'purchase' } },
      {
        $group: {
          _id: { userId: '$userId', month: { $substr: ['$day', 0, 7] } },
          bought: { $sum: 1 },
        },
      },
      { $match: { bought: { $gt: TOKEN_RULES.sinks.dayRepairPerMonth } } },
      { $sort: { bought: -1 } },
    ])
    .toArray()

  report(
    over.length,
    'user-months went over the cap',
    over
      .slice(0, SAMPLES)
      .map((row) => `${row._id.userId}/${row._id.month} (${String(row.bought)})`),
  )
  console.log(
    '           (they paid full price for each, so this is a cap breach, not a free ride)',
  )
}

// ── 4. accounts over the pin cap, and the threads that hides ───────────────
section(4, `accounts holding more than ${String(MAX_PINNED_CONVERSATIONS)} pinned threads`)
{
  const conversations = await db
    .collection<{ participants: string[]; pinnedBy?: Record<string, true> }>(
      COLLECTIONS.conversations,
    )
    .find({ pinnedBy: { $exists: true } }, { projection: { participants: 1, pinnedBy: 1 } })
    .toArray()

  const pinsPerUser = new Map<string, number>()
  for (const row of conversations) {
    for (const userId of Object.keys(row.pinnedBy ?? {})) {
      pinsPerUser.set(userId, (pinsPerUser.get(userId) ?? 0) + 1)
    }
  }
  const over = [...pinsPerUser].filter(([, n]) => n > MAX_PINNED_CONVERSATIONS)
  const hidden = over.reduce((sum, [, n]) => sum + (n - MAX_PINNED_CONVERSATIONS), 0)

  report(
    over.length,
    'accounts are over the cap',
    over.slice(0, SAMPLES).map(([userId, n]) => `${userId} (${String(n)})`),
  )
  report(hidden, 'threads are in neither half of their conversation list')
  console.log('           (the fix takes one surplus pin off on their next pin attempt)')
}

// ── 5. what the purge left behind before it knew about these ───────────────
section(5, 'rows belonging to accounts that no longer have a profile')
{
  for (const [name, field] of [
    [COLLECTIONS.phraseCards, 'authorId'],
    [COLLECTIONS.streakDays, 'userId'],
  ] as const) {
    const owners = await db.collection(name).distinct(field)
    const alive = new Set(
      (
        await db
          .collection<{ _id: string }>(COLLECTIONS.profiles)
          .find({ _id: { $in: owners as string[] } }, { projection: { _id: 1 } })
          .toArray()
      ).map((row) => row._id),
    )
    const orphanOwners = (owners as string[]).filter((id) => !alive.has(id))
    const orphanRows = orphanOwners.length
      ? await db.collection(name).countDocuments({ [field]: { $in: orphanOwners } })
      : 0
    report(
      orphanRows,
      `${name} rows from ${String(orphanOwners.length)} purged accounts`,
      orphanOwners.slice(0, SAMPLES),
    )
  }
}

// ── 6. marketing sent twice inside the gap ─────────────────────────────────
section(6, `marketing sent twice inside ${String(MARKETING_MIN_GAP_DAYS)} days`)
{
  const rows = await db
    .collection<{ _id: string; sentOn: Date }>(COLLECTIONS.notificationLedger)
    .find({ _id: { $regex: '^promo\\.' } })
    .toArray()

  const byUser = new Map<string, Date[]>()
  for (const row of rows) {
    // `promo.<job>:<userId>:<period>` — neither the job nor the period holds a colon.
    const userId = row._id.split(':')[1]
    if (!userId) continue
    byUser.set(userId, [...(byUser.get(userId) ?? []), row.sentOn])
  }

  const gapMs = MARKETING_MIN_GAP_DAYS * 24 * 60 * 60 * 1000
  const doubled: string[] = []
  for (const [userId, dates] of byUser) {
    const sorted = [...dates].sort((a, b) => a.getTime() - b.getTime())
    if (sorted.some((at, i) => i > 0 && at.getTime() - sorted[i - 1]!.getTime() < gapMs)) {
      doubled.push(userId)
    }
  }

  report(
    doubled.length,
    'accounts had two marketing sends inside the gap',
    doubled.slice(0, SAMPLES),
  )
  console.log('           (the ledger has a 30-day TTL, so this only sees the last month)')
}

// ── 7. the one that cannot be counted afterwards ───────────────────────────
section(7, 'reciprocity counted twice')
console.log('        —  not measurable after the fact. `dailyActivity.mutualConversations`')
console.log('           is a running total with nothing behind it to reconcile against,')
console.log('           and the pool days it skewed are already paid and closed.')

console.log('')
await handle.close()

/**
 * Post a RevenueCat-shaped webhook at a running API.
 *
 * The companion to the in-app fake store (`docs/billing-testing.md`). That one
 * proves the purchase flow; this one proves the *endpoint* — it goes over HTTP
 * through `POST /webhooks/revenuecat`, so it is the only local way to exercise
 * the `Authorization` shared secret, the body schema and the idempotency guard
 * exactly as RevenueCat will. It is also what to reach for when a real event
 * needs replaying against a deployed API.
 *
 * Reads `REVENUECAT_WEBHOOK_AUTH_HEADER` (and optionally `API_URL`) from the
 * environment rather than through `loadEnv`: this talks to an API over the
 * network and has no business demanding a database URI to do it.
 *
 *   REVENUECAT_WEBHOOK_AUTH_HEADER=dev-secret \
 *     pnpm --filter @langx/api exec tsx scripts/revenuecat-webhook.ts \
 *     --user <userId> --type INITIAL_PURCHASE --package pro_plus_monthly
 *
 *   ... --type CANCELLATION --package $rc_monthly
 *   ... --type EXPIRATION --package $rc_monthly --expires-in-days -1
 *
 * `--user` is the Better Auth user id, because that is what the app sets as
 * RevenueCat's `app_user_id`; anything else produces an event the webhook
 * records for audit and cannot apply to anybody.
 */
import {
  TIER_ENTITLEMENTS,
  packageDefinition,
  type BillingPeriod,
  type RevenueCatEvent,
} from '@langx/shared'
import { randomUUID } from 'node:crypto'

const DAY_MS = 24 * 60 * 60 * 1000

/** Unused for `lifetime`, which has no expiry at all — see `expiration_at_ms` below. */
const DEFAULT_DAYS: Record<BillingPeriod, number> = { monthly: 30, yearly: 365, lifetime: 0 }

function flag(name: string): string | undefined {
  const index = process.argv.indexOf(`--${name}`)
  return index === -1 ? undefined : process.argv[index + 1]
}

function required(name: string): string {
  const value = flag(name)
  if (!value) throw new Error(`--${name} is required`)
  return value
}

async function main(): Promise<void> {
  const url = flag('url') ?? process.env.API_URL ?? 'http://localhost:4000'
  const secret = flag('secret') ?? process.env.REVENUECAT_WEBHOOK_AUTH_HEADER
  if (!secret) {
    throw new Error(
      'REVENUECAT_WEBHOOK_AUTH_HEADER is not set (or pass --secret). It must match the API exactly — the route refuses every request otherwise.',
    )
  }

  const userId = required('user')
  const type = required('type')
  const packageId = required('package')
  const definition = packageDefinition(packageId)
  if (definition === null || definition.tier === 'free') {
    throw new Error(`No such package: ${packageId}`)
  }

  // Defaulted from the package rather than to a fixed 30, so an annual
  // subscription does not arrive dated a month out — reading that back and
  // believing it is what the yearly plan does is an easy mistake to make once.
  // Negative values are the point of the flag being there at all: an
  // EXPIRATION carries a timestamp in the past, and sending one is how the
  // expiry branch gets exercised without waiting a year.
  const expiresInDays = Number(flag('expires-in-days') ?? DEFAULT_DAYS[definition.period])
  if (!Number.isFinite(expiresInDays)) throw new Error('--expires-in-days must be a number')

  const event: RevenueCatEvent = {
    // Fresh every run: `subscriptions.eventId` is unique, so re-sending one id
    // is answered with `processed: false` — which is the correct behaviour and
    // a confusing thing to hit by accident.
    id: `script_${randomUUID()}`,
    type,
    app_user_id: userId,
    product_id: `script.${definition.tier}.${definition.period}`,
    store: 'fake_store',
    environment: 'SANDBOX',
    expiration_at_ms: definition.period === 'lifetime' ? null : Date.now() + expiresInDays * DAY_MS,
    entitlement_ids: [...TIER_ENTITLEMENTS[definition.tier]],
  }

  console.log(`${event.type} → ${userId} (${definition.tier}, ${definition.period})`)

  const response = await fetch(`${url}/webhooks/revenuecat`, {
    method: 'POST',
    headers: { 'content-type': 'application/json', authorization: secret },
    body: JSON.stringify({ api_version: '1.0', event }),
  })

  console.log(`${response.status} ${response.statusText}`)
  console.log(await response.text())
  if (!response.ok) process.exitCode = 1
}

main().catch((error: unknown) => {
  console.error(error instanceof Error ? error.message : error)
  process.exit(1)
})

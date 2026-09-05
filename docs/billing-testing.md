# Testing a purchase without a store

Faz 7's billing code — paywall, webhook handler, entitlement writer,
reconciliation — could not be run against itself outside its unit tests. A real
purchase needs an App Store or Play product, a RevenueCat offering configured
against it, and a device build to make it from; none of that exists yet
(`release-runbook.md` → "Before the stores"). That left the one flow the whole
tier system rests on unexercised.

The harness below replaces RevenueCat with a stand-in on both sides, so the
flow can be run end to end from a laptop, on the web build, with no network.

## What it proves, and what it does not

It fakes RevenueCat's **state** — what a subscriber holds — and produces the
events RevenueCat would have sent. Everything after that point is the shipping
code: the events go through `processRevenueCatWebhook`, entitlement lands in
`profiles.entitlement`, and the paywall reads it back through
`POST /billing/refresh` exactly as it does in production. The mobile client
branches inside `lib/purchases.ts`, which is the app's only surface onto
billing, so the screen under test is the screen that ships.

What it says nothing about:

- whether the RevenueCat dashboard's packages, entitlements and offerings match
  `PACKAGES` and `ENTITLEMENT_TIERS`
- whether a store receipt validates
- whether RevenueCat can reach `POST /webhooks/revenuecat` — that needs a
  public URL, and the shared secret is only exercised by the script below

Those still need a **Test Store purchase on a device**, which is the runbook's
existing checklist item and is not replaced by any of this.

## Turning it on

Two flags, one per side. Both are needed: with only the client flag the paywall
lists packages and buying one fails; with only the server flag nothing calls
the route.

```bash
# .env
REVENUECAT_FAKE_STORE=true
EXPO_PUBLIC_REVENUECAT_FAKE_STORE=1
```

Then `pnpm dev` and open the paywall — on the web build, or a device, or both.

The guards are deliberate and worth knowing about, because they are what makes
a flag like this safe to have in a public repo:

- `loadEnv` **refuses to boot** with `REVENUECAT_FAKE_STORE` set under
  `NODE_ENV=production`. It does not ignore the flag: the two look identical
  from outside, and only one of them is safe.
- The client half is also gated on `__DEV__`. Expo inlines `EXPO_PUBLIC_*` at
  build time, so a flag left set in a shell could otherwise ride a
  `pnpm build:web` into a published bundle.
- `POST /billing/test-event` is not registered at all unless the server flag is
  on, so it does not exist to be found on any deployment.

## Buying

The paywall works normally. Every package is listed at a price beginning with
`TEST`, and buying one calls `POST /billing/test-event`, which runs an
`INITIAL_PURCHASE` through the webhook handler and returns the resulting
entitlement. The paywall's usual `POST /billing/refresh` follows and the tier
appears.

The same route covers the rest of a subscription's life, which is most of what
goes wrong in billing:

```bash
# cookies from a signed-in session; --user is never taken from the body
curl -X POST localhost:4000/billing/test-event -H 'content-type: application/json' \
  -b "$COOKIE" -d '{"action":"purchase","packageId":"pro_plus_monthly"}'
curl ... -d '{"action":"cancel"}'   # access continues, willRenew flips
curl ... -d '{"action":"expire"}'   # access ends, tier drops to free
```

Purchases live in memory and are lost when the API restarts. Persisting them
would mean a collection and an index that exist only for a harness; re-buying
after a restart is the cheaper trade.

**Upgrading is a second purchase.** Buy `$rc_monthly` and then
`pro_plus_monthly` and the fake store answers the second with
`PRODUCT_CHANGE`, the event a store sends when a running subscription is
swapped, rather than another `INITIAL_PURCHASE` — which is what the paywall's
upgrade path produces on iOS and Play, and what the webhook has to land on
`pro_plus` (until 4 September 2026 it landed on `pro`). The paywall under the
harness takes the same route: a Fluent tap on Polyglot is an `upgrade` and
goes straight to `/billing/test-event`, where a real web build would leave for
RevenueCat's portal instead.

**The v1 loyalty gift survives a purchase.** A promotional grant is held
beside the store subscription, not inside it, so `grantLifetimeEntitlement`
followed by a purchase and an `expire` lands back on the gifted tier — the
one coexistence `ENTITLEMENT_PRECEDENCE` exists for, and the one the harness
could not rehearse while a purchase overwrote the grant. There is no route
for the grant; `billingTestStore.test.ts` reaches the fake directly.

## The web checkout, without Stripe

The harness above is not the only way to buy on a laptop, and since the web
paywall shipped it is no longer the closest one. `@revenuecat/purchases-js`
accepts a **Test Store key** — it validates `rcb_`, `test_`, `strp_` and `pdl_`
prefixes alike — so setting nothing but

```bash
# apps/mobile/.env, the file Expo reads
EXPO_PUBLIC_REVENUECAT_TEST_STORE_KEY=test_...
```

and opening the paywall in a browser gets the real SDK, the real `default`
offering, RevenueCat's own checkout over the page, and a real webhook. The
key is picked up on web through the same `__DEV__`-only fallback the native
path uses, so it cannot follow a `pnpm build:web` into production.

Verified on 5 September 2026 against the project's Test Store app: all five
`PACKAGES` identifiers came back, closing the checkout arrived as
`ErrorCode.UserCancelledError` (which is what makes the paywall say nothing
rather than "purchase failed"), and completing one wrote `pro` onto the
subscriber with `store: "test_store"`.

Two things it still cannot rehearse, both of which need the `rcb_` key:

- **The management link.** The Test Store has no customer portal, so
  `getCustomerInfo().managementURL` is `null` and Settings correctly shows no
  _Manage subscription_ row. With Web Billing it is the only cancellation path
  a web subscriber has — there are no store URLs to fall back on.
- **Money.** Nothing reaches Stripe, so nothing exercises tax, currency or the
  card form.

The fake store below is still the right tool when the API is what is under
test, or when there is no network: it is the only one of the three that runs
`processRevenueCatWebhook` without leaving the machine.

## Replaying a webhook

`POST /billing/test-event` skips the HTTP hop, so it never checks the shared
secret. The script does, against a running API — local or deployed — and is
also how a real event gets replayed:

```bash
REVENUECAT_WEBHOOK_AUTH_HEADER=dev-secret \
  pnpm --filter @langx/api exec tsx scripts/revenuecat-webhook.ts \
  --user <userId> --type INITIAL_PURCHASE --package pro_plus_monthly
```

`--user` is the Better Auth user id, because that is what the app sets as
RevenueCat's `app_user_id`. Anything else produces an event the webhook records
for audit and cannot apply to anybody — which is itself worth seeing once.

Useful variations: `--type CANCELLATION`, `--type EXPIRATION`,
`--expires-in-days -1` for a subscription that has already lapsed, and
`--url https://<host>` to aim at a deployment. Re-sending is safe: a repeated
event id comes back `processed: false`, which is the idempotency guard doing
its job.

## Where the pieces are

| Path                                             | What                                        |
| ------------------------------------------------ | ------------------------------------------- |
| `apps/api/src/modules/billing/fakeRevenueCat.ts` | The stand-in: subscriber state and events   |
| `apps/api/src/routes/billing.ts`                 | `POST /billing/test-event`, flag-gated      |
| `apps/api/scripts/revenuecat-webhook.ts`         | Posts an event at the real webhook route    |
| `apps/mobile/src/lib/fakePurchases.ts`           | The client half, behind `purchases.ts`      |
| `apps/api/src/routes/billingTestStore.test.ts`   | The whole flow, in CI, with no flags to set |

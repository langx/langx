import { normalizePlanTier, type StoredPaidPlanTier, type StoredPlanTier } from '@langx/shared'
import { effectiveHiddenMode } from './hiddenMode'

/**
 * What a profile looks like to the person it belongs to, on the wire.
 *
 * Everything is as stored except the two fields that name a paid tier, which
 * say `pro_plus` whenever they say anything paid. That is the retired Polyglot
 * id, and it is written on purpose, for the apps released before the single
 * plan: they unlock features off their **own** profile's `entitlement.tier`,
 * and to them `pro` is Fluent — so a Pro subscriber told `pro` would see half
 * of what they pay for locked behind "Upgrade to Polyglot". Told `pro_plus`,
 * an old app unlocks everything, which is exactly what Pro is.
 *
 * Every route that hands back the caller's own profile goes through this,
 * because those apps write any such response straight into their `me` cache —
 * one route missed is a paying subscriber locked out until the next refetch.
 * `routes/profiles.test.ts` walks all of them. Nothing else says `pro_plus`:
 * public profiles, discovery and admin all carry the canonical `pro`.
 *
 * Current apps read the tier through `effectivePlanTier`, which reads
 * `pro_plus` as Pro, so no header negotiation is needed — a current app would
 * have to accept `pro_plus` anyway, from its own persisted cache.
 *
 * **Removal:** once `stats.appVersion` shows no build older than the first
 * one carrying the single-plan JS, raise `minVersion` past them and delete
 * this. See `docs/decisions.md` → "One plan: Pro".
 */
export function toOwnProfileWire<
  T extends {
    entitlement?: { tier: StoredPlanTier } | undefined
    restoredFromV1?: { lifetimeGranted?: StoredPaidPlanTier | null | undefined } | undefined
    privacy?: { hiddenMode?: boolean } | undefined
  },
>(profile: T): T {
  const wire = { ...profile }
  /*
   * The hidden-mode switch, always present, worked out for a profile that
   * never stored it — see `effectiveHiddenMode`. Before the tier below is
   * rewritten, since incognito's part in it depends on the real one.
   */
  if (wire.privacy && wire.entitlement) {
    wire.privacy = {
      ...wire.privacy,
      hiddenMode: effectiveHiddenMode(
        profile as unknown as Parameters<typeof effectiveHiddenMode>[0],
      ),
    }
  }
  if (wire.entitlement && normalizePlanTier(wire.entitlement.tier) !== 'free') {
    wire.entitlement = { ...wire.entitlement, tier: LEGACY_WIRE_TIER }
  }
  if (wire.restoredFromV1?.lifetimeGranted) {
    wire.restoredFromV1 = { ...wire.restoredFromV1, lifetimeGranted: LEGACY_WIRE_TIER }
  }
  return wire
}

/** Kept a named constant so the one place that writes it is findable. */
const LEGACY_WIRE_TIER = 'pro_plus' satisfies StoredPaidPlanTier

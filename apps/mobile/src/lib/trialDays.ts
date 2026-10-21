/**
 * How many days of free trial a store's "count × unit" period amounts to.
 *
 * A month counts as 30 days and a year as 365. The screen says "30 days free",
 * which is what every other subscription app says and what people compare
 * against. The alternative is a message per unit in eight languages, for trial
 * lengths we do not sell.
 *
 * Pure, and in a file of its own, because two SDKs need it and neither spells
 * the unit the way the other does: `react-native-purchases` reports `MONTH`,
 * RevenueCat's web SDK reports `month`. Folding the case here rather than at
 * each call site is what keeps the 30-and-365 convention written down once —
 * two copies of it is how one of them quietly stops matching what the paywall
 * claims.
 */
const DAYS_PER_PERIOD_UNIT: Record<string, number> = { DAY: 1, WEEK: 7, MONTH: 30, YEAR: 365 }

/**
 * `null` for a unit this does not recognise, or a count that is not a real
 * one — a trial length we cannot state is one the paywall must not claim.
 */
export function trialDays(unit: string, count: number): number | null {
  const days = DAYS_PER_PERIOD_UNIT[unit.toUpperCase()]
  if (days === undefined || count <= 0) return null
  return days * count
}

/** The parts of a native `PurchasesStoreProduct` the trial is read from. */
export interface NativeTrialProduct {
  introPrice: { price: number; periodUnit: string; periodNumberOfUnits: number } | null
  /** Google Play only; `null` (or absent) on the App Store. */
  defaultOption?: {
    freePhase: {
      billingPeriod: { unit: string; value: number }
      billingCycleCount: number | null
    } | null
  } | null
}

/**
 * The free trial a native product would start, read from the offer the
 * purchase will actually use.
 *
 * **Google Play: `defaultOption`.** A Play subscription can carry several base
 * plans and offers, and `purchasePackage` buys the product's `defaultOption` —
 * the one with the longest free phase, else the base plan. So the trial the
 * paywall states is that option's free phase and nothing else: reading the
 * product-level `introPrice` instead would describe *some* offer on the
 * product, which is not a promise about the one the tap buys. Play returns an
 * offer only to somebody its eligibility rule admits, so a monthly plan
 * somebody has had the trial on simply comes back without one.
 *
 * **App Store: `introPrice`**, whose zero price is the whole test — a
 * discounted first period is a real thing the stores can sell and this app
 * does not, and calling one a free trial would be a false claim. It describes
 * the product, not the customer; `ineligibleForTrial` in `purchases.ts` takes
 * it away from somebody the group's one introductory offer was already spent
 * on.
 *
 * Product-agnostic on purpose: since 3.0 the monthly plan carries the same
 * free week the yearly one does, and nothing here may assume which of them a
 * store configured it on.
 */
export function nativeFreeTrialDays(product: NativeTrialProduct): number | null {
  const option = product.defaultOption
  if (option) {
    const phase = option.freePhase
    if (!phase) return null
    const cycles = phase.billingCycleCount ?? 1
    return trialDays(phase.billingPeriod.unit, phase.billingPeriod.value * cycles)
  }
  const intro = product.introPrice
  if (intro === null || intro.price !== 0) return null
  return trialDays(intro.periodUnit, intro.periodNumberOfUnits)
}

/**
 * The App Store products this person would *not* get a trial on, from
 * StoreKit's eligibility answer (`checkTrialOrIntroductoryPriceEligibility`).
 *
 * Only an explicit "eligible" keeps the trial. A missing answer, `UNKNOWN`,
 * `INELIGIBLE` and a call that throws all take it away. The asymmetry is the
 * point: a trial the store then grants unannounced is a pleasant surprise,
 * while a free week the paywall promised and the store did not give is a
 * false price, which is what App Review 3.1.2 asks to be accurate.
 */
export async function iosIneligibleForTrial(
  productIds: readonly string[],
  check: (ids: string[]) => Promise<Record<string, { status: unknown } | undefined>>,
  eligibleStatus: unknown,
): Promise<ReadonlySet<string>> {
  if (productIds.length === 0) return new Set()
  try {
    const eligibility = await check([...productIds])
    return new Set(productIds.filter((id) => eligibility[id]?.status !== eligibleStatus))
  } catch {
    return new Set(productIds)
  }
}

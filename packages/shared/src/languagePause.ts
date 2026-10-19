import { PLAN_LIMITS, type PlanTier } from './limits'

/**
 * The parts of a profile that decide which of its languages are paused.
 *
 * `giftLanguages` is the codes a person added while their Pro was a gift — a
 * streak's week, a code, an operator's month, the Pro Week. Nothing else is
 * ever marked: a language added on the free plan, under a subscription, or
 * before the marker existed is the person's for good, as it always was.
 */
export interface LanguagePauseInput {
  nativeLanguages: readonly { code: string }[]
  learning: readonly { code: string; priority?: number }[]
  giftLanguages?: readonly string[] | undefined
}

/**
 * The language codes that do not count for matching on `tier`, in the order
 * they are listed.
 *
 * A language added during a gift is matched on while Pro lasts and paused when
 * it ends, so a week of Pro cannot leave somebody matched on five languages
 * for good. Paused, not removed: it stays on the profile, its owner still sees
 * it, and it counts again the moment they hold Pro.
 *
 * Never below the plan's own allowance. The free plan matches one learning
 * and one native language, and a person who swapped their first language for
 * one added during the gift keeps that one: gift languages fill whatever room
 * the unmarked ones leave, in the order the person arranged them, and only the
 * rest pause. Unmarked languages never pause, however many there are — the
 * grandfathering `languageCapAllows` describes is untouched.
 */
export function pausedLanguageCodes(profile: LanguagePauseInput, tier: PlanTier): string[] {
  const gifted = new Set(profile.giftLanguages ?? [])
  if (gifted.size === 0) return []
  const limits = PLAN_LIMITS[tier]
  const learning = profile.learning
    .map((entry, index) => ({ entry, index }))
    .sort(
      (a, b) =>
        (a.entry.priority ?? Number.MAX_SAFE_INTEGER) -
          (b.entry.priority ?? Number.MAX_SAFE_INTEGER) || a.index - b.index,
    )
    .map(({ entry }) => entry)
  return [
    ...pausedIn(learning, gifted, limits.maxLearningLanguages),
    ...pausedIn(profile.nativeLanguages, gifted, limits.maxNativeLanguages),
  ]
}

function pausedIn(
  list: readonly { code: string }[],
  gifted: ReadonlySet<string>,
  allowance: number,
): string[] {
  let room = Math.max(0, allowance - list.filter((entry) => !gifted.has(entry.code)).length)
  const paused: string[] = []
  for (const entry of list) {
    if (!gifted.has(entry.code)) continue
    if (room > 0) {
      room--
      continue
    }
    paused.push(entry.code)
  }
  return paused
}

/**
 * The gift markers a language write leaves behind.
 *
 * What was marked stays marked while it is still listed, in either list —
 * moving a language from learning to native is not adding one. A code that
 * is new to the profile is marked only when this write happens during a gift.
 * A code no longer listed loses its mark, so the same language added later on
 * the free plan, inside the free allowance, is not paused for having once been
 * a gift's.
 */
export function nextGiftLanguages(
  before: LanguagePauseInput,
  after: Pick<LanguagePauseInput, 'nativeLanguages' | 'learning'>,
  duringGift: boolean,
): string[] {
  const listed = (lists: Pick<LanguagePauseInput, 'nativeLanguages' | 'learning'>) =>
    new Set([...lists.nativeLanguages, ...lists.learning].map((entry) => entry.code))
  const had = listed(before)
  const has = listed(after)
  const marked = new Set((before.giftLanguages ?? []).filter((code) => has.has(code)))
  if (duringGift) for (const code of has) if (!had.has(code)) marked.add(code)
  return [...marked]
}

import { PLAN_LIMITS, TIER_NAMES } from '@langx/shared'
import { useEditLanguages, useEffectiveTier, useMe, type MeProfile } from '../api/queries'
import { useDisplayNames, useT } from '../i18n'
import { showAlert } from '../lib/alert'
import { openPaywall } from '../lib/paywall'
import { showToast } from '../lib/toast'
import {
  isOverCap,
  refuseLanguageEdit,
  roomForAnother,
  type LanguageEdit,
  type LanguageListName,
  type LanguageRefusal,
} from '../lib/profileLanguages'

/**
 * The languages screen and its picker, sharing one set of answers.
 *
 * Both of them make edits and both have to word the same refusals, so the
 * rule, the request and the sentence live here rather than twice. The screen
 * decides what to draw; this decides what happens when it is pressed.
 */
export function useLanguageEditor(): {
  profile: MeProfile | undefined
  caps: { maxNativeLanguages: number; maxLearningLanguages: number }
  /** Sends the edit, or explains why it cannot. `false` means nothing was sent. */
  apply: (edit: LanguageEdit) => boolean
  /**
   * The same verdict without the write, for a control that has something to do
   * first — the × on a row asks this before it opens a confirmation, so the
   * last language of a list refuses immediately rather than after a dialog
   * that turns out to have been pointless.
   */
  allows: (edit: LanguageEdit) => boolean
  /** Opens the picker's way in, or says why the list is full. */
  canAddTo: (list: LanguageListName) => boolean
} {
  const t = useT()
  const names = useDisplayNames()
  const me = useMe()
  const tier = useEffectiveTier()
  const edit = useEditLanguages()

  const profile = me.data
  const caps = PLAN_LIMITS[tier]

  function explain(refusal: LanguageRefusal): void {
    switch (refusal.kind) {
      // Nothing to say and nothing to do: the top row moved up, a level set to
      // the one it already had, a language replaced by itself.
      case 'noop':
        return
      case 'last':
        showToast(
          t(refusal.list === 'nativeLanguages' ? 'languages.lastNative' : 'languages.lastLearning'),
        )
        return
      case 'overlap':
        showToast(t('languages.overlapRefused'))
        return
      case 'duplicate':
        showToast(t('languages.alreadyInList', { language: names.language(refusal.code) }))
        return
      case 'cap':
        void explainCap(refusal)
        return
    }
  }

  /**
   * The allowance, in words, before the paywall rather than instead of it.
   *
   * The old screen dimmed every unpicked chip at the cap and said nothing at
   * all — so the one thing a free account most wants to do, change the single
   * language it is allowed, looked like a broken control. A sentence naming
   * the number, then what the paid rows hold, then the offer.
   *
   * Somebody *over* their allowance gets the sentence without the offer:
   * upgrading would not give them another, and selling it would be a lie.
   */
  async function explainCap(refusal: Extract<LanguageRefusal, { kind: 'cap' }>): Promise<void> {
    const over = profile !== undefined && isOverCap(profile, refusal.list, caps)
    const key = refusal.list === 'nativeLanguages' ? 'maxNativeLanguages' : 'maxLearningLanguages'
    await showAlert(
      t('languages.capReached', { count: refusal.max }),
      over
        ? t('languages.capOverGrandfathered')
        : t('languages.capUpgrade', {
            fluent: TIER_NAMES.pro,
            fluentMax: PLAN_LIMITS.pro[key],
            polyglot: TIER_NAMES.pro_plus,
            polyglotMax: PLAN_LIMITS.pro_plus[key],
          }),
    )
    if (!over) openPaywall(undefined, '/(app)/languages')
  }

  function allows(next: LanguageEdit): boolean {
    if (!profile) return false
    const refusal = refuseLanguageEdit(profile, next, caps)
    if (refusal) {
      explain(refusal)
      return false
    }
    return true
  }

  return {
    profile,
    caps,
    allows,
    apply: (next) => {
      if (!allows(next)) return false
      edit.mutate(next)
      return true
    },
    canAddTo: (list) => {
      if (!profile) return false
      const refusal = roomForAnother(profile, list, caps)
      if (refusal) {
        explain(refusal)
        return false
      }
      return true
    },
  }
}

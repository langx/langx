import type { MessageParams } from '@langx/shared'
import type { MessageKey } from '../i18n/runtime'

/** One line of the welcome's copy: a key and what it interpolates. */
export interface WelcomeLine {
  key: MessageKey
  params?: MessageParams
}

export interface ProWelcomeCopy {
  title: WelcomeLine
  body: WelcomeLine
}

/**
 * What the "You're Pro now" screen says, by why somebody is Pro.
 *
 * A grant says how long it lasts when it knows ("3 months of Pro, on us"),
 * and falls back to the plain gift title when it does not — a lifetime grant,
 * or one written before grants carried a length. `source` is read as a plain
 * string: a newer server may name a reason this build has never heard of, and
 * the honest thing to say then is the generic one.
 */
export function proWelcomeCopy(welcome: { source: string; months?: number }): ProWelcomeCopy {
  const body: WelcomeLine = { key: 'proWelcome.body' }
  const months = welcome.months && welcome.months > 0 ? welcome.months : null
  const counted = (key: MessageKey): WelcomeLine =>
    months ? { key, params: { count: months } } : { key: 'proWelcome.titleGiftOpen' }

  switch (welcome.source) {
    case 'trial':
      return { title: { key: 'proWelcome.titleTrial' }, body }
    case 'gift':
      return { title: counted('proWelcome.titleGift'), body }
    case 'referral':
      return { title: counted('proWelcome.titleReferral'), body }
    case 'streak':
      return { title: counted('proWelcome.titleStreak'), body }
    case 'merge':
      return { title: { key: 'proWelcome.titleMerge' }, body: { key: 'proWelcome.bodyMerge' } }
    default:
      return { title: { key: 'proWelcome.titlePurchase' }, body }
  }
}

/**
 * The four things the screen points at, in the order worth trying them: the
 * limit most people hit first, then the three that change what Discover
 * shows. The paywall's own titles, so the two screens name each benefit the
 * same way; "and more" stands for the rest of `PRO_BENEFITS`.
 */
export const PRO_WELCOME_HIGHLIGHTS = [
  { icon: 'message-circle', key: 'paywall.unlimitedChats' },
  { icon: 'eye', key: 'paywall.whoViewed' },
  { icon: 'sliders', key: 'paywall.advancedFilters' },
  { icon: 'trending-up', key: 'paywall.boostedProfile' },
] as const satisfies readonly { icon: string; key: MessageKey }[]

/*
 * Whether "You're Pro now" is on screen — a latch like `launchOver.ts`, read
 * by the Discover tour. Both are Modals and both wait for the launch film, so
 * on a cold start they opened in the same frame, one over the other. The
 * welcome goes first and the tour waits for it: the tour points at the
 * screen the welcome's button leads to.
 */
type Listener = () => void

let welcomeOpen = false
const welcomeListeners = new Set<Listener>()

export function setProWelcomeOpen(open: boolean): void {
  if (welcomeOpen === open) return
  welcomeOpen = open
  for (const listener of welcomeListeners) listener()
}

export function isProWelcomeOpen(): boolean {
  return welcomeOpen
}

export function subscribeToProWelcomeOpen(listener: Listener): () => void {
  welcomeListeners.add(listener)
  return () => {
    welcomeListeners.delete(listener)
  }
}

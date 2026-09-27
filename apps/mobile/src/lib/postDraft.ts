import type { MessageKey } from '../i18n'
import { askSummary, normaliseAsks, type PostAsk } from './postAsks'

/**
 * The composer's decisions, away from the screen that draws it.
 *
 * Pure, for the reason every `src/lib` helper is: vitest cannot load
 * `react-native`, and these are the rules worth pinning — what may be posted,
 * how the route's params become a set of asks, what the toast says. They are
 * the server's own rules read ahead of time (`createPost`), so a Post button
 * that is enabled is a post the server takes.
 */

/**
 * The asks a composer opens with, from its route params.
 *
 * `asks` is a comma-separated string because router params are strings. A
 * legacy `?kind=` — an installed build's link, a notification, an old
 * bookmark — becomes the one ask it named, so a link from before this change
 * still opens pre-set to its question. Neither means a moment: nothing ticked.
 */
export function asksFromParams(params: { asks?: string; kind?: string }): PostAsk[] {
  if (params.asks !== undefined) return normaliseAsks(params.asks.split(','))
  if (params.kind) return normaliseAsks([params.kind])
  return []
}

/** The inverse, for a caller building the composer's params. */
export function asksParam(asks: readonly PostAsk[]): string {
  return normaliseAsks(asks).join(',')
}

/** What a post needs before it can be sent, and it is missing. */
export type DraftBlock = 'noLanguage' | 'askNeedsLearning' | 'needsText' | 'needsSomething'

export interface DraftState {
  body: string
  /** The asks that will be sent — already empty when the language cannot ask. */
  asks: readonly PostAsk[]
  media: readonly { kind: 'image' | 'audio' | 'video' }[]
  language: string | undefined
  /** Whether `language` is one the writer learns: asking works only there. */
  asksAllowed: boolean
}

/**
 * Why the draft cannot be posted yet, or `null` when it can.
 *
 * - Any ask needs words: a correction is an edit of the sentence, and a
 *   recording is of it.
 * - With no ask, words or at least one photo or video. A voice note alone is
 *   not enough — there would be nothing on the card to read, and nothing to
 *   tell somebody scrolling past what it is.
 * - An ask needs a language the writer is learning.
 */
export function draftBlock(draft: DraftState): DraftBlock | null {
  if (!draft.language) return 'noLanguage'
  const text = draft.body.trim().length > 0
  if (draft.asks.length > 0) {
    if (!draft.asksAllowed) return 'askNeedsLearning'
    return text ? null : 'needsText'
  }
  if (text) return null
  return draft.media.some((item) => item.kind === 'image' || item.kind === 'video')
    ? null
    : 'needsSomething'
}

export function canSubmitPost(draft: DraftState): boolean {
  return draftBlock(draft) === null
}

const BLOCK_KEYS: Record<DraftBlock, MessageKey> = {
  noLanguage: 'feed.postLanguageRequired',
  askNeedsLearning: 'feed.askNeedsLearning',
  needsText: 'feed.needsText',
  needsSomething: 'feed.needsSomething',
}

/** The sentence under a disabled Post button, saying what it is waiting for. */
export function draftBlockKey(block: DraftBlock): MessageKey {
  return BLOCK_KEYS[block]
}

/** The toast after posting: it promises only what was asked for. */
export function postedKey(asks: readonly PostAsk[]): MessageKey {
  switch (askSummary(asks)) {
    case 'none':
      return 'feed.postedPlain'
    case 'correction':
      return 'feed.postedCorrection'
    case 'pronunciation':
      return 'feed.postedPronunciation'
    case 'both':
      return 'feed.postedBoth'
  }
}

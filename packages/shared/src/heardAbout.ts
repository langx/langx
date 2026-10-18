import type { PollResults } from './interactive'

/**
 * "How did you hear about LangX?" — the poll @langx sends a new account
 * straight after the welcome.
 *
 * One fixed `pollId` for every account and every language, so the answers add
 * up in one place: `pollAnswers` is keyed by it, the operator panel reads it,
 * and the Telegram bot in `langx/admin-tg` watches for it by this exact
 * string. Renaming it starts a second, empty poll.
 *
 * The options were picked from where sign-ups actually come from, not from a
 * list of channels we wish we were on — which is why an AI assistant is one
 * and Reddit is not. At most `POLL_MAX_OPTIONS`, and `other` stays last.
 * Their words live in the API catalogues under `official.heardAbout`.
 */
export const HEARD_ABOUT_POLL_ID = 'heard-about'

export const HEARD_ABOUT_OPTIONS = [
  'store',
  'search',
  'ai',
  'friend',
  'tiktok-instagram',
  'youtube',
  'app-list',
  'other',
] as const
export type HeardAboutOption = (typeof HEARD_ABOUT_OPTIONS)[number]

/** One answer, as the operator panel lists it — newest first. */
export interface HeardAboutAnswerView {
  userId: string
  handle: string | null
  displayName: string | null
  country: string | null
  optionId: string
  createdAt: string
}

export interface HeardAboutView {
  results: PollResults
  recent: HeardAboutAnswerView[]
}

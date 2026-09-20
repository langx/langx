import type { EnMessages } from './messages/en'
import type { Paths } from '@langx/shared'

/**
 * The only keys Swift is allowed to ask for.
 *
 * A Swift target cannot import `src/i18n`, so the rule that no user-facing
 * string is written in a component would quietly stop applying the moment a
 * native target drew a word of its own. Swift and Kotlin both read from here:
 * the watch app, the Wear app and the widget gallery. This list is how it keeps applying:
 * `scripts/generate-xcstrings.ts` copies exactly these keys out of the eight
 * catalogues into `targets/_shared/Localizable.xcstrings`, and a lint rule
 * refuses a literal user-facing string inside `targets/**`.
 *
 * Two failures are worth naming, because each is caught somewhere different:
 *
 * - A key here that English does not have fails `satisfies` below, at
 *   typecheck.
 * - A key English has that a locale does not already fails typecheck in that
 *   locale's own file, through `Localized<EnMessages>`. Nothing new is needed
 *   for it; that is the whole reason the generator reads the catalogues
 *   instead of a file of its own.
 *
 * Keep it short. Every key here is a word that has to be translated eight
 * times before it can ship, and the widgets deliberately avoid the cost by
 * rendering words the app already wrote into the snapshot.
 */
export const NATIVE_KEYS = [
  'watch.unread',
  'watch.nothingUnread',
  'watch.openOnPhone',
  'watch.phoneNotReachable',
  'watch.reply',
  'watch.sending',
  'watch.sent',
  'watch.notSent',
  'watch.loading',
  'widget.streakName',
  'widget.streakDetail',
  'widget.todayName',
  'widget.todayDetail',
  'widget.activityName',
  'widget.activityDetail',
  'widget.glanceName',
  'widget.glanceDetail',
  'widget.exchangeStartsIn',
  'widget.exchangeEndsIn',
  'intents.openEcho',
  'intents.openEchoDetail',
  'intents.openChats',
  'intents.openChatsDetail',
] as const satisfies readonly Paths<EnMessages>[]

export type NativeKey = (typeof NATIVE_KEYS)[number]

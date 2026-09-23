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
  /*
   * The watch app's own list is the phone's chat list, so it borrows the
   * phone's words for it rather than being given two of its own. Eight
   * translations that already exist and already agree with the tab the wearer
   * taps on the phone — and if that word is ever changed, both change.
   */
  'tabs.chats',
  'chats.emptyTitle',
  /*
   * The car. Its title is the chat tab's, like the watch's; its one sentence
   * of its own is the alert for a message that could not be read aloud, and
   * the alert's button is the app's own OK.
   */
  'carplay.readFailed',
  'carplay.listen',
  'common.ok',
  /*
   * These two are the Wear tile's, and only the tile's. It answers "how many
   * are waiting", which stayed the right question for a glance when the app's
   * own screen stopped asking it.
   */
  'watch.unread',
  'watch.nothingUnread',
  'watch.openOnPhone',
  'watch.phoneNotReachable',
  'watch.reply',
  'watch.sending',
  'watch.sent',
  'watch.notSent',
  'watch.loading',
  'watch.complication',
  'watch.showsUnread',
  'watch.showsStreak',
  'widget.streakName',
  'widget.streakDetail',
  'widget.todayName',
  'widget.todayDetail',
  'widget.activityName',
  'widget.activityDetail',
  'widget.glanceName',
  'widget.glanceDetail',
  'widget.faceDetail',
  'widget.exchangeStartsIn',
  'widget.exchangeEndsIn',
  'intents.openEcho',
  'intents.openEchoDetail',
  'intents.openChats',
  'intents.openChatsDetail',
  'intents.openConversation',
  'intents.openConversationDetail',
  'intents.conversationType',
  'intents.conversationParameter',
  /*
   * The car. Android Auto reads a `MessagingStyle` notification out loud and
   * answers it, and the notification is built in Kotlin — so the four words
   * on it cannot come from `t()` the way the rest of the shade's do. Three
   * are already written; `messageMeta.you` is the name Android wants for the
   * person being written to, and it is the same "You" the chat screen uses.
   */
  'notifications.replyAction',
  'notifications.replyPlaceholder',
  'notifications.markAsRead',
  'notifications.replyFailed',
  'messageMeta.you',
] as const satisfies readonly Paths<EnMessages>[]

export type NativeKey = (typeof NATIVE_KEYS)[number]

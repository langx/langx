import type { MessageType } from '@langx/shared'
import type { MessageKey } from '../i18n/runtime'

/**
 * What to call a message that has no text of its own.
 *
 * Used wherever a message is named rather than drawn: above the long-press
 * menu, in the reply band, and in each row of the starred list. It lived in
 * `chat/[id].tsx` and knew two of the nine types, so a starred meeting, quiz,
 * phrase card, sticker or video all read "Message" — which is the same thing
 * the screen says when it has no idea what it is looking at.
 *
 * The table is exhaustive against `MESSAGE_TYPES` rather than a `switch` with
 * a default, so adding a tenth type is a compile error here instead of a
 * silent tenth "Message". `apps/api`'s `previewFor` guards its own list the
 * same way, and `previewFor.test.ts` is the mirror of this module's test.
 *
 * The keys deliberately cross namespaces — `messageMeta.photo` beside
 * `chat.voiceMessage`. Gathering them all under `messageMeta.*` would be a
 * rename with no behaviour in it, across eight catalogues.
 *
 * Takes `MessageType` from `@langx/shared`, **not** `MessageDto['type']`:
 * `vitest.config.ts` collects only `src/lib/**` and `src/i18n/**`, and
 * importing `react-native` from that graph fails with "Flow is not supported".
 * `messageActions.ts` solves the same constraint the same way.
 */
const MESSAGE_PREVIEW_KEY = {
  text: 'messageMeta.message',
  correction: 'messageMeta.correction',
  image: 'messageMeta.photo',
  audio: 'chat.voiceMessage',
  video: 'messageMeta.video',
  phrase: 'messageMeta.phrase',
  meeting: 'messageMeta.meeting',
  quiz: 'messageMeta.quiz',
  sticker: 'messageMeta.sticker',
} as const satisfies Record<MessageType, MessageKey>

export function messagePreviewKey(type: MessageType): MessageKey {
  return MESSAGE_PREVIEW_KEY[type]
}

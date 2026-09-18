import { TTS_MAX_TEXT_LENGTH, type MessageType } from '@langx/shared'
import type { TranslateFn } from '../i18n/runtime'

export const MESSAGE_ACTION_IDS = [
  'reply',
  'copy',
  'translate',
  'speak',
  'correct',
  'echo',
  'delete',
  'edit',
  'star',
  'pin',
  'phrase',
  'share',
  'report',
] as const
export type MessageActionId = (typeof MESSAGE_ACTION_IDS)[number]

/** Which of the menu's two pages a row belongs on. */
export type MessageActionPage = 'primary' | 'more'

export interface MessageAction {
  id: MessageActionId
  label: string
  /** Ionicons name. */
  icon: string
  page: MessageActionPage
  destructive?: boolean
  /**
   * Shown, but not selectable — the only case is a message somebody has
   * corrected. Hiding Edit there would look like a bug on your own recent
   * message; saying why is the point.
   */
  disabled?: boolean
}

export interface MessageActionContext {
  /**
   * Whether the reader has a language a translation can be written in. A
   * reader whose only native language is signed has none, and offering the
   * action would offer a request the server refuses.
   */
  canTranslate?: boolean
  /**
   * Whether a reading is possible: this deployment has a voice service *and*
   * the caller worked out a language it can be read in. Hidden by default,
   * unlike `canTranslate` — translation is configured everywhere and a voice
   * service is not, so the row must be earned rather than assumed.
   */
  canSpeak?: boolean
  /** Characters the service would be asked to read. The cap is its own. */
  bodyLength: number
  /** Whether the signed-in user sent it. */
  mine: boolean
  type: MessageType
  /** A voice note without a caption has nothing to copy, quote or translate. */
  hasBody: boolean
  alreadyTranslated: boolean
  /** `canEditMessage` from shared, evaluated by the caller against the clock. */
  canEdit: boolean
  /** Somebody has corrected this sentence, so editing it is locked off. */
  corrected: boolean
  starred: boolean
  pinned: boolean
  /** The reader already keeps an Echo card for this message. */
  echoed: boolean
  /**
   * The thread is a channel: `@langx` announces, and there is nothing at the
   * other end to read anything sent back. The screen draws no composer for
   * one, and this is the same fact reaching the menu — every row that would
   * write into that composer, or reach the account behind it, is off with it.
   *
   * Reading rows are untouched: a translation, a copy, an Echo card and a
   * deletion are all things the reader does to their own copy, and an
   * announcement is exactly the kind of text worth keeping.
   */
  channel?: boolean
  /**
   * Passed in rather than reached for: this stays a pure function the tests
   * call directly, and the labels are the reader's language rather than the
   * module's import-time language.
   */
  t: TranslateFn
}

/**
 * Which actions a message offers.
 *
 * These rules used to live as conditions scattered through the chat screen's
 * `renderItem` — "only the other person's", "only text", "not once
 * translated" — where `vitest.config.ts` cannot reach them and where adding a
 * sixth action meant finding all five.
 */
export function messageActionsFor(context: MessageActionContext): MessageAction[] {
  const { t } = context
  const actions: MessageAction[] = []

  // Every message can be answered, including a captionless voice note — the
  // quote carries a label for those rather than a body. First in the list
  // because on web it is the only way in: the swipe gesture is native-only.
  //
  // Except in a channel, where the composer it would fill is not drawn: the
  // row used to open a reply that had nowhere to be written and no way to be
  // sent, which reads as a broken tap rather than as a rule.
  if (!context.channel) {
    actions.push({
      id: 'reply',
      label: t('messageActions.reply'),
      icon: 'arrow-undo-outline',
      page: 'primary',
    })
  }

  // The teaching gesture, and the highest-earning action in the app. Only on
  // the other person's text: there is nothing to correct in an image, and
  // correcting a correction is a thread nobody wants. Never in a channel — a
  // correction is a message, so the server refuses it, and nobody is learning
  // a language behind an announcement anyway.
  if (!context.mine && !context.channel && context.type === 'text') {
    actions.push({
      id: 'correct',
      label: t('messageActions.correct'),
      icon: 'pencil-outline',
      page: 'primary',
    })
  }

  // Translating your own message is a round trip to something you already
  // understand, and a correction is already both languages side by side.
  if (
    !context.mine &&
    context.hasBody &&
    context.type !== 'correction' &&
    !context.alreadyTranslated &&
    context.canTranslate !== false
  ) {
    actions.push({
      id: 'translate',
      label: t('messageActions.translate'),
      icon: 'language-outline',
      page: 'primary',
    })
  }

  /**
   * Hear the sentence said.
   *
   * **On your own messages too**, which is where this parts company with
   * Translate and Correct. Translating what you wrote is a round trip to
   * something you already understand; *hearing* what you wrote, in the
   * language you are learning to write it in, is much of the reason for
   * writing it at all.
   *
   * The same three types `echo` takes: a captioned photo's caption is a
   * sentence, and a correction's body is the corrected line, which is the one
   * most worth hearing. Never a voice note — that bubble is already a person
   * saying it, and a machine reading its caption beside them is the one case
   * that confuses rather than helps.
   *
   * Over the cap the row is hidden rather than disabled. The menu's only
   * disabled row is Edit-after-correction, where hiding would look like a bug
   * on your own recent message; nobody expects three paragraphs to offer to
   * read themselves, so there is nothing to explain.
   *
   * `hasBody` also removes the tombstone, the way it does for `phrase`.
   */
  if (
    context.canSpeak === true &&
    context.hasBody &&
    context.bodyLength <= TTS_MAX_TEXT_LENGTH &&
    (context.type === 'text' || context.type === 'correction' || context.type === 'image')
  ) {
    actions.push({
      id: 'speak',
      label: t('messageActions.speak'),
      icon: 'volume-medium-outline',
      page: 'primary',
    })
  }

  if (context.hasBody) {
    actions.push({
      id: 'copy',
      label: t('messageActions.copy'),
      icon: 'copy-outline',
      page: 'primary',
    })
  }

  /**
   * Anything with a sentence on it, and — unlike `phrase` — your own messages
   * too. A correction is the case that settles it: the corrected line is
   * exactly the thing worth learning, and it is written on *your* sentence.
   *
   * `image` is here because a photo with a caption is typed `image`: the
   * caption is the sentence and the photo becomes the card's cue. A sticker,
   * a meeting, a quiz and a voice note without a caption have no sentence at
   * all, and a phrase card's author already holds the mirrored card.
   */
  if (
    context.hasBody &&
    (context.type === 'text' || context.type === 'correction' || context.type === 'image')
  ) {
    actions.push({
      id: 'echo',
      label: t(context.echoed ? 'messageActions.unecho' : 'messageActions.echo'),
      // Solid once it is kept, outline while it is on offer — the same "on"
      // state `star` uses two rows below.
      icon: context.echoed ? 'repeat' : 'repeat-outline',
      page: 'primary',
    })
  }

  /**
   * Always offered, on anyone's message and at any age: "delete for me" is a
   * filter on your own copy and never expires. Whether *withdrawing* it from
   * the other person is also on the table is the caller's question — the rule
   * is `canDeleteForEveryone` in shared, and the screen asks with it rather
   * than the menu guessing.
   */
  actions.push({
    id: 'delete',
    label: t('messageActions.delete'),
    icon: 'trash-outline',
    page: 'primary',
    destructive: true,
  })

  if (context.canEdit) {
    actions.push({
      id: 'edit',
      label: t('messageActions.edit'),
      icon: 'create-outline',
      page: 'more',
    })
  } else if (context.mine && context.type === 'text' && context.corrected) {
    actions.push({
      id: 'edit',
      label: t('messageActions.correctedCannotEdit'),
      icon: 'lock-closed-outline',
      page: 'more',
      disabled: true,
    })
  }

  actions.push({
    id: 'star',
    label: t(context.starred ? 'messageActions.unstar' : 'messageActions.star'),
    icon: context.starred ? 'star' : 'star-outline',
    page: 'more',
  })

  actions.push({
    id: 'pin',
    label: t(context.pinned ? 'messageActions.unpin' : 'messageActions.pin'),
    icon: 'pin-outline',
    page: 'more',
  })

  /**
   * Turn what they said into a card in the deck, with their sentence already
   * in the example field.
   *
   * Their message, because the point is to keep a phrase *encountered* rather
   * than one you already know how to write; something to put in the example,
   * because a card whose example is blank is the empty form the attachment
   * menu already opens; and not on a phrase card, because a card is what this
   * would produce.
   *
   * `hasBody` also removes the tombstone without a `deleted` check: a
   * withdrawn message has an empty `body`, and a card quoting "This message
   * was deleted" is the one thing this must not offer.
   *
   * Not in a channel either: the card this opens is *sent* to the other
   * person as a phrase message, so the form would fill in and then be
   * refused on save.
   */
  if (!context.mine && !context.channel && context.hasBody && context.type !== 'phrase') {
    actions.push({
      id: 'phrase',
      label: t('messageActions.savePhrase'),
      icon: 'bookmark-outline',
      page: 'more',
    })
  }

  // Out through the platform sheet, as text: a message has no address of its
  // own, and a link into a private thread would resolve for nobody but the
  // two people already in it. Same gate as copy — a captionless voice note has
  // nothing to hand over.
  if (context.hasBody) {
    actions.push({
      id: 'share',
      label: t('messageActions.share'),
      icon: 'share-outline',
      page: 'more',
    })
  }

  // Not in a channel: the account being reported is ours, so the complaint
  // would reach the people who wrote the message it is about.
  if (!context.mine && !context.channel) {
    actions.push({
      id: 'report',
      label: t('messageActions.report'),
      icon: 'flag-outline',
      page: 'more',
      destructive: true,
    })
  }

  return actions
}

/**
 * The menu's two pages.
 *
 * A page rather than one long list because the anchored menu has to fit
 * between a bubble and the edge of the screen, and nine rows do not. Pure so
 * the split is testable: which rows are behind `More…` is a product decision,
 * and a wrong one is invisible in a screenshot of the first page.
 */
export function paginateActions(
  actions: MessageAction[],
  page: MessageActionPage,
): { actions: MessageAction[]; hasMore: boolean } {
  const primary = actions.filter((action) => action.page === 'primary')
  const more = actions.filter((action) => action.page === 'more')
  // Nothing behind the divider means no divider: a `More…` row that opens an
  // empty page is worse than one row too many on the first.
  if (more.length === 0) return { actions: primary, hasMore: false }
  return page === 'primary'
    ? { actions: primary, hasMore: true }
    : { actions: more, hasMore: false }
}

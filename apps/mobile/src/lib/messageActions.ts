import type { TranslateFn } from '../i18n/runtime'

export const MESSAGE_ACTION_IDS = [
  'reply',
  'copy',
  'translate',
  'correct',
  'delete',
  'edit',
  'star',
  'pin',
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
  /** Whether the signed-in user sent it. */
  mine: boolean
  type: 'text' | 'correction' | 'image' | 'audio' | 'video'
  /** A voice note without a caption has nothing to copy, quote or translate. */
  hasBody: boolean
  alreadyTranslated: boolean
  /** `canEditMessage` from shared, evaluated by the caller against the clock. */
  canEdit: boolean
  /** Somebody has corrected this sentence, so editing it is locked off. */
  corrected: boolean
  starred: boolean
  pinned: boolean
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
  actions.push({
    id: 'reply',
    label: t('messageActions.reply'),
    icon: 'arrow-undo-outline',
    page: 'primary',
  })

  // The teaching gesture, and the highest-earning action in the app. Only on
  // the other person's text: there is nothing to correct in an image, and
  // correcting a correction is a thread nobody wants.
  if (!context.mine && context.type === 'text') {
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
    !context.alreadyTranslated
  ) {
    actions.push({
      id: 'translate',
      label: t('messageActions.translate'),
      icon: 'language-outline',
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

  if (!context.mine) {
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

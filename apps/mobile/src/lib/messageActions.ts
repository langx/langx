export const MESSAGE_ACTION_IDS = [
  'reply',
  'copy',
  'translate',
  'correct',
  'delete',
  'report',
] as const
export type MessageActionId = (typeof MESSAGE_ACTION_IDS)[number]

export interface MessageAction {
  id: MessageActionId
  label: string
  /** Ionicons name. */
  icon: string
  destructive?: boolean
}

export interface MessageActionContext {
  /** Whether the signed-in user sent it. */
  mine: boolean
  type: 'text' | 'correction' | 'image' | 'audio'
  /** A voice note without a caption has nothing to copy, quote or translate. */
  hasBody: boolean
  alreadyTranslated: boolean
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
  const actions: MessageAction[] = []

  // Every message can be answered, including a captionless voice note — the
  // quote carries a label for those rather than a body. First in the list
  // because on web it is the only way in: the swipe gesture is native-only.
  actions.push({ id: 'reply', label: 'Reply', icon: 'arrow-undo-outline' })

  // Edit, react, star, pin and delete are still absent: each needs a field on
  // `Message` and a way to mutate one that already exists, which is one piece
  // of plumbing they should share rather than four.
  if (context.hasBody) {
    actions.push({ id: 'copy', label: 'Copy', icon: 'copy-outline' })
  }

  // Translating your own message is a round trip to something you already
  // understand, and a correction is already both languages side by side.
  if (
    !context.mine &&
    context.hasBody &&
    context.type !== 'correction' &&
    !context.alreadyTranslated
  ) {
    actions.push({ id: 'translate', label: 'Translate', icon: 'language-outline' })
  }

  // The teaching gesture, and the highest-earning action in the app. Only on
  // the other person's text: there is nothing to correct in an image, and
  // correcting a correction is a thread nobody wants.
  if (!context.mine && context.type === 'text') {
    actions.push({ id: 'correct', label: 'Correct', icon: 'pencil-outline' })
  }

  /**
   * Always offered, on anyone's message and at any age: "delete for me" is a
   * filter on your own copy and never expires. Whether *withdrawing* it from
   * the other person is also on the table is the caller's question — the rule
   * is `canDeleteForEveryone` in shared, and the screen asks with it rather
   * than the menu guessing.
   */
  actions.push({ id: 'delete', label: 'Delete', icon: 'trash-outline', destructive: true })

  if (!context.mine) {
    actions.push({ id: 'report', label: 'Report', icon: 'flag-outline', destructive: true })
  }

  return actions
}

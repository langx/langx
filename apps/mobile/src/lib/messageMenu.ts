import type { Media } from '@langx/shared'
import type { MessageAction, MessageActionId } from './messageActions'
import { DURATION, STAGGER_TIGHT } from './theme/motionValues'

/**
 * The state behind the long-press menu, separate from the component that
 * draws it — the same split, and for the same reason, as `alert.ts`: what is
 * decided here is a pure function of a queue, and `src/lib` is the only place
 * the test setup can reach.
 *
 * Unlike alerts these do **not** queue. A menu is opened by a deliberate
 * gesture on one message; a second one arriving means the first is stale, so
 * it is dismissed rather than stacked behind.
 */
/** Where on screen the bubble was when it was pressed. */
export interface AnchorRect {
  x: number
  y: number
  width: number
  height: number
}

export interface MessageMenuRequest {
  id: number
  /** Shown above the actions so it is obvious which message is being acted on. */
  preview: string
  /** Tints the copy of the bubble the anchored layout draws. */
  mine: boolean
  /**
   * The fill of the partner's bubble in the v3 look — their hue — so the
   * lifted copy is drawn in it rather than in grey. Absent for your own
   * bubbles, in the current look, and while the partner is not yet known.
   */
  tint?: string
  /**
   * Whether the pressed bubble carried the tail corner — the squared one a
   * run of messages gets on its last bubble. The lifted copy keeps it, or it
   * is a different bubble from the one under the finger.
   */
  tail?: boolean
  actions: MessageAction[]
  /**
   * The measured bubble. Present means the menu is drawn against it; absent
   * falls back to the sheet, which is what a caller with nothing to measure —
   * or a platform where the measurement failed — still gets.
   */
  anchor?: AnchorRect
  /**
   * What the pressed bubble drew, when it drew a picture rather than a
   * sentence. Without it a photo is lifted out of the thread as a grey box
   * with the word "Photo" in it — a description of the message standing where
   * the message was.
   *
   * A voice note is deliberately not here. Its bubble is a player, and a copy
   * of a player is a second player: a second `useAudioPlayer` on the same
   * file, with its own play button, inside a menu. It keeps the label.
   */
  picture?:
    | { kind: 'media'; items: readonly Media[] }
    | { kind: 'sticker'; packId: string; stickerId: string }
  /** The sentence under a picture, when the message carried one. */
  caption?: string
  /** The emoji strip, when the message can carry a reaction. */
  reactions?: readonly string[]
  /** Which of them is already the viewer's, drawn selected. */
  myReaction?: string | undefined
}

/**
 * Two ways out, because the strip and the rows are one gesture's worth of UI
 * but not one kind of answer.
 */
export type MessageMenuResult =
  { kind: 'action'; id: MessageActionId } | { kind: 'reaction'; emoji: string }

type Listener = (request: MessageMenuRequest | null) => void

let nextId = 1
let open: {
  request: MessageMenuRequest
  resolve: (value: MessageMenuResult | null) => void
} | null = null
let listener: Listener | null = null

function publish(): void {
  listener?.(open?.request ?? null)
}

/** `MessageMenuHost` subscribes; the returned function unsubscribes. */
export function subscribeToMessageMenu(next: Listener): () => void {
  listener = next
  publish()
  return () => {
    if (listener === next) listener = null
  }
}

/**
 * Resolves with what was chosen, or `null` when dismissed.
 *
 * One options object rather than positional arguments: the anchor, the strip
 * and the current reaction all arrive together, and a fifth positional
 * parameter is where a call site starts passing them in the wrong order.
 */
export function openMessageMenu(
  request: Omit<MessageMenuRequest, 'id'>,
): Promise<MessageMenuResult | null> {
  return new Promise((resolve) => {
    // A menu already up belongs to a message the user has moved on from.
    open?.resolve(null)
    open = { request: { ...request, id: nextId++ }, resolve }
    publish()
  })
}

/** Called by the host when an action is picked or the menu is dismissed. */
export function resolveMessageMenu(id: number, value: MessageMenuResult | null): void {
  if (!open || open.request.id !== id) return
  const { resolve } = open
  open = null
  resolve(value)
  publish()
}

/**
 * How the v3 anchored menu lifts out of the thread and goes back, in ms.
 *
 * Numbers rather than `Animated` calls, so they are testable here and so the
 * host — root-mounted, on the launch path, RN `Animated` only — reads plain
 * values. The scrim and the copy arrive together, the copy only just lifting
 * (3%: enough to read as picked up, not as zoomed); the menu and the strip
 * grow from the bubble's side a beat behind; the emoji follow one by one.
 * Going is shorter than coming, and the pick resolves once it has gone.
 */
export const MENU_MOTION = {
  scrim: 150,
  lift: DURATION.press,
  liftScale: 1.03,
  menu: 180,
  menuFrom: 0.92,
  emoji: 180,
  emojiFrom: 0.6,
  /** The last emoji starts no later than this, however long the strip. */
  emojiCap: 160,
  close: 140,
} as const

/** When the emoji at `index` starts: `STAGGER_TIGHT` apart, capped. */
export function emojiDelay(index: number): number {
  return Math.min(Math.max(0, index) * STAGGER_TIGHT, MENU_MOTION.emojiCap)
}

/**
 * Where the menu or the strip grows from: the edge that touches the bubble,
 * on the side it hangs from — so each opens out of the bubble rather than out
 * of its own middle. The strip sits on the far side of the bubble from the
 * menu, so it grows from the opposite edge.
 *
 * `trailing` is `messageMenuLayout`'s own rule (`mine !== rtl`): aligned to
 * the bubble's right edge on screen. Physical words, because a transform's
 * origin is not mirrored by an RTL layout.
 */
export function menuOrigin(
  placement: 'below' | 'above',
  part: 'menu' | 'strip',
  trailing: boolean,
): string {
  const menuBelow = placement === 'below'
  const fromTop = part === 'menu' ? menuBelow : !menuBelow
  return `${trailing ? 'right' : 'left'} ${fromTop ? 'top' : 'bottom'}`
}

/** Test seam: drops any open request without resolving it. */
export function resetMessageMenuForTest(): void {
  open = null
  listener = null
  nextId = 1
}

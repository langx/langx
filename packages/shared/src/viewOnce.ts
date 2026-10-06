import { z } from 'zod'

/**
 * A photo or a video that the recipient can open once, or once plus one
 * replay, and that then disappears from the thread — Instagram's "view once"
 * and "allow replay".
 *
 * "Disappears" is about the app, not the bucket. The file stays where every
 * chat file stays, because a report about it has to be checkable after the
 * person who received it has looked; what ends is the API handing its address
 * to anybody. See `docs/decisions.md` → _View-once hides, it does not delete_.
 */
export const VIEW_ONCE_MODES = ['once', 'replay'] as const
export type ViewOnceMode = (typeof VIEW_ONCE_MODES)[number]

/** How many times the recipient may open it, per mode. Config, not a literal in a handler. */
export const VIEW_ONCE_OPENS: Record<ViewOnceMode, number> = { once: 1, replay: 2 }

export function viewOnceMaxOpens(replay: boolean): number {
  return VIEW_ONCE_OPENS[replay ? 'replay' : 'once']
}

/** What a send asks for. `replay: false` is "view once". */
export const viewOnceSendSchema = z.object({ replay: z.boolean() })
export type ViewOnceSend = z.infer<typeof viewOnceSendSchema>

/**
 * A view-once message as either person receives it, in place of its
 * attachments — which neither of them is ever sent. Not even the sender: the
 * row is the same one for both of them, and a URL in the sender's copy of the
 * history is a URL in the backup, the starred list and the next build's cache.
 */
export interface MessageViewOnce {
  kind: 'image' | 'video'
  replay: boolean
  /** How many times the recipient has opened it. The sender reads "Opened" and "Replayed" off this. */
  opens: number
  /** How many opens are left for the recipient. `0` once it is gone. */
  opensLeft: number
  /** The recipient took a screenshot while it was open. */
  screenshotAt?: string
  /** For a video, so the bubble can say how long it is without the file. */
  durationSeconds?: number
}

export type ViewOnceState = 'unopened' | 'opened' | 'gone'

/**
 * Which of the three a bubble draws.
 *
 * `opened` exists only for "allow replay": opened once, one replay left. A
 * view-once photo goes straight from `unopened` to `gone` on its first open.
 */
export function viewOnceState(view: Pick<MessageViewOnce, 'opens' | 'opensLeft'>): ViewOnceState {
  if (view.opensLeft <= 0) return 'gone'
  return view.opens === 0 ? 'unopened' : 'opened'
}

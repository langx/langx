import { makeStyles } from '../../lib/theme'

/**
 * The v3 thread's restyle of `MessageBubble`, as overrides of its own
 * stylesheet: the same keys, v3's values. Only the look moves — every branch,
 * gesture and handler is the bubble's own, so the two looks cannot drift in
 * what they do, only in how they are drawn.
 *
 * Your side is the drawing's solid blue with white text; theirs is the
 * partner's hue (`partnerHueFor`, passed in as a colour) with ink, which
 * reads on every hue in both schemes. Until the partner is known their side
 * is the surface grey with the ground's text, because ink on the dark
 * scheme's surface would be black on near-black. Cards, calls and view-once
 * rows are records rather than speech, so they stay on the surface grey on
 * both sides, as the drawing's correction stays outlined.
 */
const useOverrides = makeStyles(({ v3 }) => ({
  bubble: {
    borderRadius: v3.radius.tile,
    paddingHorizontal: v3.space[14],
    paddingVertical: v3.space[10],
  },
  mine: { backgroundColor: v3.colors.blue },
  theirs: { backgroundColor: v3.colors.surface },
  tailMine: { borderBottomEndRadius: v3.space[8] },
  tailTheirs: { borderBottomStartRadius: v3.space[8] },
  /**
   * A picture fills its bubble almost to the edge: a 14pt frame of blue or
   * hue around a photo reads as a mount, not as a message. The caption, if
   * any, takes the padding back.
   */
  mediaFrame: { padding: v3.space[4] },
  caption: {
    marginTop: 0,
    paddingBottom: v3.space[6],
    paddingHorizontal: v3.space[10],
    paddingTop: v3.space[6],
  },
  // 17 on 23, the drawing's; the colour is set per side, on the bubble.
  bubbleText: { ...v3.type.body, color: v3.colors.fg, lineHeight: 23 },
  quote: { borderStartColor: v3.colors.blue },
  quoteText: { ...v3.type.caption, color: v3.colors.muted },
  // The ground's text colour: a blue ring would vanish around your own bubble.
  highlighted: { borderColor: v3.colors.fg, borderWidth: 2 },
  tombstone: { backgroundColor: v3.colors.surface },
  tombstoneText: { ...v3.type.callout, color: v3.colors.muted, fontStyle: 'italic' },
  edited: { color: v3.colors.muted },
  forwardedText: { color: v3.colors.muted },
  // v3 is flat: an outline on the ground, no shadow under it.
  reactions: {
    backgroundColor: v3.colors.bg,
    borderColor: v3.colors.line,
    elevation: 0,
    shadowOpacity: 0,
  },
  reactionCount: { color: v3.colors.muted },
  card: {
    backgroundColor: v3.colors.surface,
    borderRadius: v3.radius.row,
    gap: v3.space[4],
    padding: v3.space[14],
  },
  cardKicker: {
    ...v3.type.label,
    color: v3.colors.muted,
    letterSpacing: 0,
    textTransform: 'none',
  },
  phraseTerm: { ...v3.type.headline, color: v3.colors.fg },
  phraseMeaning: { ...v3.type.callout, color: v3.colors.fg },
  phraseExample: { color: v3.colors.muted },
  meetingWhen: { color: v3.colors.fg },
  meetingTheirs: { color: v3.colors.muted },
  callIcon: { backgroundColor: v3.colors.bg },
  callTitle: { color: v3.colors.fg },
  callTitleMissed: { color: v3.colors.danger },
  viewOnceIconLive: { backgroundColor: v3.colors.blue },
  viewOnceIconUsed: { borderColor: v3.colors.line },
  viewOnceUsedTitle: { color: v3.colors.muted },
  // Blue as text is `echoText`: `blue` itself falls under 4.5:1 on the surface.
  viewOnceAction: { color: v3.colors.echoText },
  locationPlace: { color: v3.colors.fg },
  locationOpen: { color: v3.colors.echoText },
  quizOption: { backgroundColor: v3.colors.bg, borderRadius: v3.radius.icon },
  quizOptionText: { color: v3.colors.fg },
  quizRight: { borderColor: v3.colors.correction },
  quizWrong: { borderColor: v3.colors.danger },
  meetingAccept: { color: v3.colors.correction },
  meetingDecline: { color: v3.colors.danger },
  meetingCalendar: { color: v3.colors.echoText },
  meetingAccepted: { color: v3.colors.correction },
  meetingRefused: { color: v3.colors.muted },
  sentTranslation: { color: v3.colors.muted },
  askLabel: { color: v3.colors.muted },
  askAction: { color: v3.colors.echoText },
  echoAction: { color: v3.colors.echoText },
  echoMark: { color: v3.colors.muted },
  translation: { color: v3.colors.echoText },
  translateLink: { color: v3.colors.echoText },
  /**
   * The drawing's correction: an outline in the correction green on the
   * ground, no fill, on the side of whoever wrote it — a correction is a
   * message one of them sent, and the side is what says whose. The inside is
   * `CorrectionCardV3`.
   */
  correction: {
    alignSelf: 'flex-start',
    backgroundColor: 'transparent',
    borderColor: v3.colors.correction,
    borderRadius: v3.radius.row,
    borderWidth: 2,
    gap: v3.space[4],
    maxWidth: '85%',
    paddingHorizontal: v3.space[12],
    paddingVertical: v3.space[8],
  },
}))

/** Merged once per scheme: `base` is the bubble's own cached sheet, one per scheme. */
const merged = new WeakMap<object, object>()

/**
 * `MessageBubble`'s stylesheet with v3's values over it. Called on every
 * render of every bubble, so the merge is cached against the base sheet,
 * which `makeStyles` already keeps one of per scheme.
 *
 * Key by key as a style array, never by spreading one sheet over the other:
 * a spread replaces a whole entry, so an override that only re-colours the
 * quote's edge would drop the edge's width and padding with it — and on the
 * web, where a created style is a compiled class rather than a plain object,
 * there is nothing to spread into anyway.
 */
export function useBubbleStylesV3<T extends object>(base: T): T {
  const overrides = useOverrides()
  let styles = merged.get(base)
  if (!styles) {
    const under = base as unknown as Record<string, unknown>
    const next = { ...under }
    for (const [key, value] of Object.entries(overrides)) {
      const below = under[key]
      next[key] = below === undefined ? value : [below, value]
    }
    styles = next
    merged.set(base, styles)
  }
  return styles as T
}

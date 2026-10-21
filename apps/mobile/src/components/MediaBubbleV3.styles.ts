import { WAVEFORM_BAR_WIDTH } from '../lib/waveform'
import { makeStyles } from '../lib/theme'

/** The disc a voice note's play sits in, and the badge on a video: the board's sizes. */
export const PLAY_DISC = 40
export const PLAY_BADGE = 30
/** The badge on a single video, which is the post rather than one tile of it. */
export const PLAY_BADGE_LARGE = 56

/**
 * `MediaBubble`'s drawing in the v3 look, behind `flags.v3Home`: the play
 * and pause in a disc rather than a bare text glyph, the duration and the
 * speed at a size a person can read, the video's play as the dark badge
 * `V-ChatMedia` draws in the corner of a tile, and the blocks on v3's grey.
 *
 * A second sheet with the same names rather than a second component, for the
 * reason `PostScreenV3.styles.ts` gives: the players, the scrubbing and the
 * fall-backs for a file that is gone are the file's whole point, and a copy
 * to change their colours would be two places for them to drift apart.
 * `MediaBubble` picks this sheet or its own by the flag, and the type of
 * `styles` there refuses a name one sheet has and the other lacks. The
 * `playDisc` and `playBadge*` names are this sheet's own, read only under
 * the flag.
 */
export const useMediaStylesV3 = makeStyles(({ v3 }) => ({
  audioRow: { alignItems: 'center', flexDirection: 'row', gap: v3.space[10], minWidth: 200 },
  // Not drawn under v3, where the glyph is a Feather icon in `playDisc`.
  playIcon: { ...v3.type.callout },
  playDisc: {
    alignItems: 'center',
    borderRadius: v3.radius.pill,
    borderWidth: 2,
    height: PLAY_DISC,
    justifyContent: 'center',
    width: PLAY_DISC,
  },
  // `space-between`, as the current sheet's: the bars span the row. The
  // height is `MediaBubble`'s `WAVEFORM_HEIGHT`, which the bars scale to.
  waveform: {
    alignItems: 'center',
    flex: 1,
    flexDirection: 'row',
    height: v3.space[24],
    justifyContent: 'space-between',
  },
  bar: { borderRadius: WAVEFORM_BAR_WIDTH / 2, width: WAVEFORM_BAR_WIDTH },
  duration: { ...v3.type.caption, fontVariant: ['tabular-nums'], fontWeight: '600' },
  unavailable: { ...v3.type.caption, flex: 1 },
  rate: { ...v3.type.caption, fontVariant: ['tabular-nums'], fontWeight: '700' },
  image: {
    backgroundColor: v3.colors.surface,
    borderRadius: v3.radius.card,
    overflow: 'hidden',
    width: 220,
  },
  imageFill: { height: '100%', width: '100%' },
  gone: {
    alignItems: 'center',
    backgroundColor: v3.colors.surface,
    justifyContent: 'center',
    padding: v3.space[8],
    zIndex: 1,
  },
  goneText: { ...v3.type.caption, color: v3.colors.muted, textAlign: 'center' },
  imageUnmeasured: { height: 220 },
  placeholder: { bottom: 0, height: 'auto', left: 0, position: 'absolute', right: 0, top: 0 },
  video: {
    backgroundColor: v3.colors.surface,
    borderRadius: v3.radius.card,
    overflow: 'hidden',
    width: 220,
  },
  videoFill: { height: '100%', width: '100%' },
  gallery: {
    borderRadius: v3.radius.card,
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: v3.space[2],
    overflow: 'hidden',
  },
  // Square seams inside the gallery's own rounded edge, as the board's grid.
  tile: { backgroundColor: v3.colors.surface, overflow: 'hidden' },
  fillColumn: { alignSelf: 'stretch' },
  fillPending: { height: 220 },
  tileFill: { height: '100%', width: '100%' },
  tilePlay: {
    alignItems: 'center',
    bottom: 0,
    justifyContent: 'center',
    left: 0,
    position: 'absolute',
    right: 0,
    top: 0,
  },
  tilePlayGlyph: { ...v3.type.callout, color: v3.colors.onBlue },
  // The corner badge on a tile: the scrim's dark, which reads on a bright
  // first frame and on a dark one alike. `end`, so it follows RTL.
  playBadge: {
    alignItems: 'center',
    backgroundColor: v3.colors.scrim,
    borderRadius: v3.radius.pill,
    bottom: v3.space[6],
    end: v3.space[6],
    height: PLAY_BADGE,
    justifyContent: 'center',
    position: 'absolute',
    width: PLAY_BADGE,
  },
  playBadgeLarge: {
    alignItems: 'center',
    backgroundColor: v3.colors.scrim,
    borderRadius: v3.radius.pill,
    height: PLAY_BADGE_LARGE,
    justifyContent: 'center',
    width: PLAY_BADGE_LARGE,
  },
}))

import { makeStyles } from '../lib/theme'

/**
 * `AttachmentBar`'s drawing in the v3 look, behind `flags.v3Home`: the
 * picker and the microphone as outlined pills with their word in Nunito, as
 * `V-SetFeedback` draws "Photo or video", and while recording the stop in the
 * ink disc with the timer beside it.
 *
 * The same names as the current sheet, for the reason `PostScreenV3.styles.ts`
 * gives: the picker's refusals and the recorder's ceiling are the bar's whole
 * point, and one component that picks a sheet by the flag cannot let them
 * drift. `V-Compose` draws its two buttons as tall tiles beside the previews,
 * which the bar draws when asked (`tile`, below); the pills stay the default,
 * because the bar also sits beside the Send of a correction, where a tile
 * would not fit.
 */
export const useAttachmentStylesV3 = makeStyles(({ v3 }) => ({
  // Wraps where the current row does not: the board's words are bigger, and
  // "Add a photo or video" beside "Voice note" no longer fits a phone's width.
  row: {
    alignItems: 'center',
    flexDirection: 'row',
    flexShrink: 1,
    flexWrap: 'wrap',
    gap: v3.space[8],
  },
  previewRow: {
    alignItems: 'center',
    flexDirection: 'row',
    gap: v3.space[10],
    marginBottom: v3.space[8],
  },
  thumb: { borderRadius: v3.radius.icon, height: 64, width: 64 },
  removeBadge: {
    alignItems: 'center',
    backgroundColor: v3.colors.fg,
    borderRadius: v3.radius.pill,
    height: 24,
    justifyContent: 'center',
    position: 'absolute',
    right: -6,
    top: -6,
    width: 24,
  },
  // The stop: the ink disc at the platform's minimum target.
  button: {
    alignItems: 'center',
    backgroundColor: v3.colors.pill,
    borderRadius: v3.radius.pill,
    height: 44,
    justifyContent: 'center',
    width: 44,
  },
  chip: {
    alignItems: 'center',
    borderColor: v3.colors.fg,
    borderRadius: v3.radius.pill,
    borderWidth: 2,
    flexDirection: 'row',
    gap: v3.space[8],
    height: 52,
    paddingEnd: v3.space[20],
    paddingStart: v3.space[16],
  },
  chipLabel: { ...v3.type.button, color: v3.colors.fg },
  chipDisabled: { opacity: 0.45 },
  pressed: { opacity: 0.7 },
  attached: { ...v3.type.caption, color: v3.colors.muted, flex: 1, minWidth: 0 },
  recording: { ...v3.type.button, color: v3.colors.fg, flex: 1, fontVariant: ['tabular-nums'] },
  recordingDot: {
    backgroundColor: v3.colors.danger,
    borderRadius: v3.radius.pill,
    height: 10,
    width: 10,
  },
  // A word, but a 44-tall target: the padding makes up the line's 20.
  cancel: {
    ...v3.type.buttonSmall,
    color: v3.colors.muted,
    paddingHorizontal: v3.space[8],
    paddingVertical: v3.space[12],
  },
}))

/**
 * The post composer's tiles (`V-Compose`): the picker as a dashed square, the
 * microphone as a grey one, in one line after the thumbnails. The dash is
 * `muted` rather than `line`: an empty square's edge is the whole control,
 * and `line` would leave it under the 3:1 a control's edge needs.
 */
export const useAttachmentTileStylesV3 = makeStyles(({ v3 }) => ({
  scroll: { flexGrow: 0 },
  line: { alignItems: 'center', flexDirection: 'row', gap: 11, paddingEnd: 8, paddingTop: 8 },
  tile: {
    alignItems: 'center',
    borderRadius: v3.radius.card,
    gap: v3.space[6],
    justifyContent: 'center',
    paddingHorizontal: v3.space[8],
    paddingVertical: v3.space[10],
  },
  add: { borderColor: v3.colors.muted, borderStyle: 'dashed', borderWidth: 2 },
  voice: { backgroundColor: v3.colors.surface },
  // A step under `buttonSmall`, as the board draws it: at 16 "Add a photo or
  // video" breaks onto a third line inside a 112 square.
  label: {
    ...v3.type.buttonSmall,
    color: v3.colors.fg,
    fontSize: 15,
    lineHeight: 18,
    textAlign: 'center',
  },
}))

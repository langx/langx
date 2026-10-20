import { makeStyles } from '../lib/theme'

/** The list's bottom padding; the comment focus measures from it, as in `PostScreen`. */
export const LIST_BOTTOM_PADDING_V3 = 24

/**
 * `PostScreen`'s drawing in the v3 look (`V-Post`), behind `flags.v3Home`.
 *
 * A second sheet with the same names rather than a second screen. The post
 * page is mostly behaviour — two recorders' worth of takes, the keyboard
 * clearance, the comment focus, Echo's keep buttons, three deletes — and a
 * copy of that to change its colours would be two places for a refusal or a
 * delete to drift apart. `PostScreen` picks this sheet or its own by the flag,
 * so the handlers, the requests and the screen-reader names cannot differ;
 * the type of `styles` there refuses a name one sheet has and the other
 * lacks.
 */
export const usePostStylesV3 = makeStyles(({ v3 }) => ({
  avoid: { flex: 1 },
  list: { gap: 0, paddingBottom: LIST_BOTTOM_PADDING_V3 },
  footer: { paddingVertical: v3.space[16] },
  more: {},
  who: {
    alignItems: 'center',
    flexDirection: 'row',
    gap: v3.space[10],
    minHeight: 48,
    paddingBottom: v3.space[12],
    paddingTop: v3.space[8],
  },
  whoText: { flex: 1, minWidth: 0 },
  name: { ...v3.type.button, color: v3.colors.fg },
  // The post's Top mark: an outlined pill, as the drawing has it, so the
  // correction row's filled Top below stays the louder of the two.
  topPost: {
    ...v3.type.label,
    borderColor: v3.colors.fg,
    borderRadius: v3.radius.pill,
    borderWidth: 2,
    color: v3.colors.fg,
    overflow: 'hidden',
    paddingHorizontal: v3.space[10],
    paddingVertical: v3.space[4],
  },
  meta: { ...v3.type.caption, color: v3.colors.muted },
  body: { ...v3.type.headline, color: v3.colors.fg, paddingBottom: v3.space[12] },
  media: { paddingBottom: v3.space[12] },
  actions: {
    alignItems: 'center',
    columnGap: v3.space[8],
    flexDirection: 'row',
    flexWrap: 'wrap',
    paddingBottom: v3.space[8],
    rowGap: v3.space[8],
  },
  likedBy: {
    alignItems: 'center',
    backgroundColor: v3.colors.surface,
    borderRadius: v3.radius.pill,
    justifyContent: 'center',
    minHeight: 44,
    paddingHorizontal: v3.space[16],
  },
  actionMuted: { ...v3.type.caption, color: v3.colors.muted, fontWeight: '700' },
  actionEnd: { marginStart: 'auto' },
  // Add to Echo and See the card: the Echo tint, as everywhere Echo is offered.
  echoRow: {
    alignItems: 'center',
    alignSelf: 'flex-start',
    backgroundColor: v3.colors.echoTint,
    borderRadius: v3.radius.pill,
    flexDirection: 'row',
    gap: v3.space[6],
    marginTop: v3.space[8],
    minHeight: 44,
    paddingHorizontal: v3.space[16],
  },
  sectionTitle: {
    ...v3.type.headline,
    color: v3.colors.fg,
    paddingBottom: v3.space[8],
    paddingHorizontal: v3.space[4],
    paddingTop: v3.space[24],
  },
  empty: {
    ...v3.type.callout,
    color: v3.colors.muted,
    paddingHorizontal: v3.space[4],
    paddingVertical: v3.space[16],
  },
  // A correction or a recording: one grey block each, a gap between them.
  reply: {
    backgroundColor: v3.colors.surface,
    borderRadius: v3.radius.tile,
    gap: v3.space[8],
    marginBottom: v3.space[8],
    paddingBottom: v3.space[14],
    paddingHorizontal: v3.space[14],
    paddingTop: v3.space[8],
  },
  replyWho: { alignItems: 'center', flexDirection: 'row', gap: v3.space[10], minHeight: 44 },
  replyName: { ...v3.type.button, color: v3.colors.fg, flex: 1 },
  topPill: {
    backgroundColor: v3.colors.pill,
    borderRadius: v3.radius.pill,
    paddingHorizontal: v3.space[10],
    paddingVertical: v3.space[4],
  },
  topPillLabel: { ...v3.type.label, color: v3.colors.pillText },
  // On the block's own grey: the green of the changed words carries the fix.
  card: { gap: v3.space[6] },
  corrected: { ...v3.type.body, color: v3.colors.fg },
  removed: { color: v3.colors.muted, fontWeight: '400', textDecorationLine: 'line-through' },
  added: { color: v3.colors.correction, fontWeight: '800' },
  note: { ...v3.type.caption, color: v3.colors.muted },
  takes: { gap: v3.space[10], paddingVertical: v3.space[8] },
  takeLabel: { ...v3.type.label, color: v3.colors.muted },
  likeRow: {
    alignItems: 'center',
    columnGap: v3.space[14],
    flexDirection: 'row',
    flexWrap: 'wrap',
    rowGap: v3.space[6],
  },
  deleteAction: { ...v3.type.caption, color: v3.colors.danger, fontWeight: '700' },
  keepAction: { ...v3.type.caption, color: v3.colors.echoText, fontWeight: '700' },
  keptLabel: { ...v3.type.caption, color: v3.colors.muted, fontWeight: '700' },
  done: {
    alignItems: 'center',
    alignSelf: 'center',
    backgroundColor: v3.colors.correctionTint,
    borderRadius: v3.radius.pill,
    flexDirection: 'row',
    gap: v3.space[8],
    marginTop: v3.space[16],
    minHeight: 44,
    paddingHorizontal: v3.space[16],
  },
  doneLabel: { ...v3.type.buttonSmall, color: v3.colors.correction },
  compose: { gap: v3.space[10], paddingTop: v3.space[20] },
  composeHead: {
    alignItems: 'center',
    flexDirection: 'row',
    gap: v3.space[8],
    justifyContent: 'space-between',
    paddingStart: v3.space[4],
  },
  composeTitle: { ...v3.type.headline, color: v3.colors.fg },
  accentAction: { ...v3.type.caption, color: v3.colors.echoText, fontWeight: '800' },
  reward: {
    ...v3.type.caption,
    color: v3.colors.correction,
    fontWeight: '600',
    textAlign: 'center',
  },
  comment: { gap: v3.space[6], paddingVertical: v3.space[12] },
  time: { ...v3.type.caption, color: v3.colors.muted, marginStart: 'auto' },
  commentBody: { ...v3.type.callout, color: v3.colors.fg },
  showMore: {
    ...v3.type.buttonSmall,
    color: v3.colors.echoText,
    paddingHorizontal: v3.space[4],
    paddingVertical: v3.space[12],
  },
  commentCompose: { gap: v3.space[10], paddingTop: v3.space[16] },
  replyStrip: {
    alignItems: 'center',
    backgroundColor: v3.colors.surface,
    borderRadius: v3.radius.pill,
    flexDirection: 'row',
    gap: v3.space[8],
    minHeight: 44,
    paddingEnd: v3.space[6],
    paddingStart: v3.space[16],
  },
  replyStripLabel: { ...v3.type.caption, color: v3.colors.muted, flex: 1, fontWeight: '700' },
  composeActions: { alignItems: 'center', flexDirection: 'row', gap: v3.space[8] },
  grow: { flex: 1, width: 'auto' },
  footerBar: { paddingBottom: v3.space[8], paddingTop: v3.space[8] },
  pressed: { opacity: 0.6 },
}))

import Feather from '@expo/vector-icons/Feather'
import { memo, useCallback, useEffect, useMemo, useRef, type ReactNode } from 'react'
import {
  Animated,
  PanResponder,
  Platform,
  Pressable,
  StyleSheet,
  Text,
  View,
  type ViewStyle,
} from 'react-native'
import type { MessageDto } from '../api/queries'
import { diffCorrection } from '../lib/correctionDiff'
import { attachmentsOf, type Media } from '@langx/shared'
import { isBigEmoji } from '../lib/singleEmoji'
import type { AnchorRect } from '../lib/messageMenu'
import {
  SWIPE_ACTIVATE_PX,
  shouldCaptureSwipe,
  swipeReleased,
  swipeToReplyEnabled,
  swipeTranslation,
} from '../lib/swipeToReply'
import { makeStyles, useTheme } from '../lib/theme'
import { MediaGallery } from './MediaBubble'
import { MessageMeta } from './MessageMeta'
import { useT } from '../i18n'

/**
 * Whether this device has a finger. Read once, at module scope: it cannot
 * change for the life of the page, and `navigator` is absent while the web
 * bundle is being exported — hence the `typeof` guard rather than a bare read.
 */
const HAS_TOUCH =
  Platform.OS !== 'web' || (typeof navigator !== 'undefined' && navigator.maxTouchPoints > 0)

export interface MessageBubbleProps {
  message: MessageDto
  mine: boolean
  /** Whether this bubble carries the tail corner — see `messageGroups`. */
  endsGroup: boolean
  /** For the header on a correction someone else wrote. */
  partnerName: string
  translation?: string | undefined
  translating: boolean
  /** Whether the *quoted* message is the reader's own, for the quote's byline. */
  replyToMine: boolean
  /** Briefly ringed after a jump, so the reader sees where they landed. */
  highlighted: boolean
  onLongPress: (message: MessageDto, alreadyTranslated: boolean, anchor?: AnchorRect) => void
  onReply: (message: MessageDto) => void
  onJumpTo: (messageId: string) => void
  /** Opens the full-screen viewer. The thread owns it, so paging can leave this bubble. */
  /** Opens the viewer on this message's attachments, at the one that was tapped. */
  onOpenMedia: (items: Media[], index: number) => void
}

/**
 * One row of the thread.
 *
 * Split out of the screen and memoised because it is the only way a translation
 * stops costing a re-render of every other bubble: the screen holds the
 * translations, but a bubble is given only its own string, so the rest compare
 * equal and stand still. That is also why `onLongPress` has to be referentially
 * stable at the call site — a fresh closure per render would defeat this
 * entirely, and silently.
 */
export const MessageBubble = memo(function MessageBubble({
  message,
  mine,
  endsGroup,
  partnerName,
  translation,
  translating,
  replyToMine,
  highlighted,
  onLongPress,
  onReply,
  onJumpTo,
  onOpenMedia,
}: MessageBubbleProps) {
  const { colors } = useTheme()
  const styles = useStyles()
  const t = useT()
  /**
   * The bubble reports where it is, so the menu can be drawn against it rather
   * than at the bottom of the screen. `measureInWindow` exists on
   * react-native-web's View too — it is `getBoundingClientRect` underneath — so
   * this is genuinely cross-platform despite being the app's first use of it.
   * If it never calls back, the menu falls back to the sheet.
   */
  const box = useRef<View>(null)
  const press = () => {
    const alreadyTranslated = Boolean(translation)
    if (!box.current) {
      onLongPress(message, alreadyTranslated)
      return
    }
    box.current.measureInWindow((x, y, width, height) =>
      onLongPress(message, alreadyTranslated, { x, y, width, height }),
    )
  }

  /**
   * Swipe right to reply — wherever there is a finger, which now includes a
   * phone browser.
   *
   * Still off for a mouse. react-native-web maps mouse events onto the
   * responder system, so a drag does reach this, but on a desktop that same
   * drag is the browser selecting text: which one wins depends on whether the
   * press landed on a word or on the padding, and a gesture that works from
   * half of a bubble is worse than one that is plainly absent. There the
   * menu's Reply row is the way in. `touchAction: 'pan-y'` below is the other
   * half of making it work on a touchscreen: without it the browser claims the
   * horizontal pan for its own scrolling before the responder ever sees it.
   */
  const translateX = useRef(new Animated.Value(0)).current
  const responder = useMemo(() => {
    const settle = () =>
      Animated.spring(translateX, { toValue: 0, useNativeDriver: true, bounciness: 0 }).start()
    return PanResponder.create({
      // Never on start: that would swallow the tap and the long press.
      onStartShouldSetPanResponder: () => false,
      onMoveShouldSetPanResponder: (_event, gesture) => shouldCaptureSwipe(gesture.dx, gesture.dy),
      onPanResponderMove: (_event, gesture) => translateX.setValue(swipeTranslation(gesture.dx)),
      onPanResponderRelease: (_event, gesture) => {
        if (swipeReleased(gesture.dx)) onReply(message)
        settle()
      },
      onPanResponderTerminate: settle,
      // The list asking for the responder back mid-scroll wins, always.
      onPanResponderTerminationRequest: () => true,
    })
  }, [message, onReply, translateX])

  const pan = swipeToReplyEnabled(Platform.OS, HAS_TOUCH) ? responder.panHandlers : {}
  const flash = highlighted ? styles.highlighted : null

  /**
   * What the correction actually changed, worked out once per message rather
   * than per render — the memo is the reason this bubble can stay `memo`'d at
   * all while the screen re-renders on every keystroke in the composer.
   */
  /**
   * A bounce on arrival that a tap can replay.
   *
   * RN's `Animated`, not Reanimated: Reanimated 4 is a dependency that nothing
   * imports, and pulling it in for one spring would put its worklets bundle
   * into the shipped web build. `Button` already does exactly this shape.
   *
   * A tap is free to take: every `Pressable` in this file has only
   * `onLongPress`, and the shell's `PanResponder` returns false from
   * `onStartShouldSetPanResponder` precisely so a tap and a long press survive.
   */
  const heroScale = useRef(new Animated.Value(1)).current
  const replay = useCallback(() => {
    heroScale.setValue(0.6)
    Animated.spring(heroScale, {
      toValue: 1,
      useNativeDriver: true,
      speed: 12,
      bounciness: 14,
    }).start()
  }, [heroScale])

  useEffect(() => {
    if (isBigEmoji(message.body)) replay()
    // Once, when the message appears. Re-running on every render would make the
    // thread jump every time the composer takes a keystroke.
  }, [message.body, replay])

  const correction = message.correction
  const diff = useMemo(
    () => (correction ? diffCorrection(correction.original, message.body) : null),
    [correction, message.body],
  )

  /**
   * The arrow WhatsApp shows under the bubble as it slides. Driven by the same
   * `Animated.Value` as the bubble, so it fades in exactly as far as the
   * gesture has travelled and reaches full strength at the point where letting
   * go actually replies.
   */
  const arrowOpacity = translateX.interpolate({
    inputRange: [0, SWIPE_ACTIVATE_PX],
    outputRange: [0, 1],
    extrapolate: 'clamp',
  })

  /**
   * Every branch below is the same shell: the arrow underneath, the bubble on
   * top of it, and the pan handlers on the part that moves.
   */
  const shell = (children: ReactNode): ReactNode => (
    <View style={styles.row}>
      <Animated.View style={[styles.arrow, { opacity: arrowOpacity }]} pointerEvents="none">
        <Feather name="corner-up-left" size={15} color={colors.textMuted} />
      </Animated.View>
      <Animated.View ref={box} style={styles.slider} {...pan}>
        <Animated.View style={{ transform: [{ translateX }] }}>{children}</Animated.View>
      </Animated.View>
    </View>
  )

  /**
   * Counts, not avatars: a 1-1 thread has at most two people on an emoji, so
   * a number is only ever "2" and the badge is mostly there to say which
   * emojis were used at all.
   */
  const reactions = Object.entries(message.reactions ?? {}).filter(([, users]) => users.length > 0)
  const badge =
    reactions.length > 0 ? (
      <View style={[styles.reactions, mine ? styles.reactionsMine : styles.reactionsTheirs]}>
        {reactions.map(([emoji, users]) => (
          <View key={emoji} style={styles.reaction}>
            <Text style={styles.reactionGlyph}>{emoji}</Text>
            {users.length > 1 ? <Text style={styles.reactionCount}>{users.length}</Text> : null}
          </View>
        ))}
      </View>
    ) : null
  const replyTo = message.replyTo

  const quote = replyTo ? (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel={t('chat.goToQuoted')}
      onPress={() => onJumpTo(replyTo.messageId)}
      style={[styles.quote, mine ? styles.quoteMine : styles.quoteTheirs]}
    >
      <Text style={[styles.quoteAuthor, mine && styles.quoteAuthorMine]} numberOfLines={1}>
        {replyToMine ? t('messageMeta.you') : partnerName}
      </Text>
      <Text style={[styles.quoteText, mine && styles.quoteTextMine]} numberOfLines={2}>
        {replyTo.preview || t('messageMeta.attachment')}
      </Text>
    </Pressable>
  ) : null

  /**
   * A withdrawal keeps its place in the thread rather than closing the gap.
   * The alternative — removing the row — rewrites the shape of a conversation
   * the other person remembers having, which is worse than an obvious hole.
   */
  if (message.deleted) {
    return shell(
      <Pressable
        onLongPress={press}
        style={[styles.bubble, mine ? styles.mine : styles.theirs, styles.tombstone, flash]}
      >
        <View style={styles.tombstoneRow}>
          <Feather name="slash" size={13} color={colors.textMuted} />
          <Text style={styles.tombstoneText}>{t('chat.deleted')}</Text>
        </View>
        <MessageMeta message={message} mine={mine} />
      </Pressable>,
    )
  }

  if (message.type === 'correction') {
    return shell(
      <Pressable
        onLongPress={press}
        style={[styles.correction, mine ? styles.correctionMine : null, flash]}
      >
        {/*
          The success pair, and only ever the success pair. A correction is
          another person changing your sentence; the info pair belongs to
          Copilot, which proposes one you have not sent. The two must never be
          confusable — see `Callout`.
        */}
        <View style={styles.correctionHead}>
          <Feather name="edit-3" size={14} color={colors.success} />
          <Text style={styles.correctionLabel}>
            {mine ? t('chat.yourCorrection') : t('chat.correctionFrom', { name: partnerName })}
          </Text>
        </View>
        <View style={styles.correctionBody}>
          {/*
              Only the part that changed carries a colour. Striking the whole
              sentence says "this was wrong" about one that was mostly right,
              and buries the one thing the reader opened it for.
            */}
          {diff ? (
            <Text style={styles.correctionOriginal}>
              {diff.original.map((segment, index) => (
                <Text key={index} style={segment.changed ? styles.removed : null}>
                  {segment.text}
                </Text>
              ))}
            </Text>
          ) : null}
          <Text style={styles.correctionText}>
            {diff
              ? diff.corrected.map((segment, index) => (
                  <Text key={index} style={segment.changed ? styles.added : null}>
                    {segment.text}
                  </Text>
                ))
              : message.body}
          </Text>
          {message.correction?.note ? (
            <Text style={styles.correctionNote}>{message.correction.note}</Text>
          ) : null}
          <MessageMeta message={message} mine={mine} />
        </View>
        {badge}
      </Pressable>,
    )
  }

  const tail = endsGroup ? (mine ? styles.tailMine : styles.tailTheirs) : null

  if (message.type === 'image' || message.type === 'audio' || message.type === 'video') {
    const attachments = attachmentsOf(message)
    const openable = message.type !== 'audio' && attachments.length > 0
    return shell(
      <Pressable
        onLongPress={press}
        /*
         * A picture in a thread is a thumbnail — 220 points of something worth
         * looking at. Tapping it was the one thing it did not do: the bubble
         * had a long press for the menu and a swipe for a reply, and nothing
         * for the obvious gesture.
         *
         * Not a voice note: its bubble is already a play button, and giving
         * the whole thing a second meaning would make the two overlap. Not a
         * gallery either — there the tile that was tapped decides which one
         * opens, so the press belongs to the tile.
         */
        onPress={
          openable && attachments.length === 1 ? () => onOpenMedia(attachments, 0) : undefined
        }
        style={[styles.bubble, mine ? styles.mine : styles.theirs, tail, flash]}
      >
        {quote}
        {attachments.length > 0 ? (
          <MediaGallery
            items={attachments}
            mine={mine}
            {...(attachments.length > 1
              ? { onOpen: (index: number) => onOpenMedia(attachments, index) }
              : {})}
          />
        ) : null}
        {message.body ? (
          <Text style={[styles.bubbleText, mine && styles.bubbleTextMine, styles.caption]}>
            {message.body}
          </Text>
        ) : null}
        <MessageMeta message={message} mine={mine} />
        {badge}
      </Pressable>,
    )
  }

  /**
   * A message that is nothing but a couple of emoji, drawn as itself.
   *
   * No bubble: chrome sized for a sentence around a single glyph is what made
   * these read as small rather than emphatic. It still goes through `shell`, so
   * swipe-to-reply and the long-press menu keep working, and it keeps its quote
   * and meta — a reaction to a specific message is still a reply, and the read
   * receipt is still the thing people check.
   */
  if (isBigEmoji(message.body) && !message.deleted) {
    return shell(
      <Pressable
        onPress={replay}
        onLongPress={press}
        style={[styles.hero, mine ? styles.heroMine : styles.heroTheirs]}
      >
        {quote}
        <Animated.Text style={[styles.heroText, { transform: [{ scale: heroScale }] }]}>
          {message.body}
        </Animated.Text>
        {translating ? <Text style={styles.translateLink}>{t('chat.translating')}</Text> : null}
        <MessageMeta message={message} mine={mine} />
        {badge}
      </Pressable>,
    )
  }

  return shell(
    <Pressable
      onLongPress={press}
      style={[styles.bubble, mine ? styles.mine : styles.theirs, tail, flash]}
    >
      {quote}
      <Text style={[styles.bubbleText, mine && styles.bubbleTextMine]}>{message.body}</Text>
      {translation ? (
        <Text style={[styles.translation, mine && styles.translationMine]}>{translation}</Text>
      ) : null}
      {/* The link is gone — translate is a menu row now. This only reports the
            request already in flight. */}
      {translating ? <Text style={styles.translateLink}>{t('chat.translating')}</Text> : null}
      {/* Beside the clock, not in place of it: "when" and "changed since" are
            two different facts and the reader wants both. */}
      {message.editedAt ? (
        <Text style={[styles.edited, mine && styles.editedMine]}>{t('messageMeta.edited')}</Text>
      ) : null}
      <MessageMeta message={message} mine={mine} />
      {badge}
    </Pressable>,
  )
})

/**
 * `touch-action` is a web-only style: react-native-web reads it, the native
 * platforms ignore it, and without it the browser claims a horizontal drag for
 * its own scrolling — on iOS Safari, for the back gesture — before the
 * responder system ever sees the move.
 *
 * The double assertion is doing real work. `ViewStyle` as react-native declares
 * it has no `touchAction`, so a plain object is not assignable; but the
 * type-aware lint rules run against a program where it resolves to
 * react-native-web's `ViewStyle`, which *does*, and there a single `as
 * ViewStyle` is reported as unnecessary. Going through `unknown` is the one
 * spelling both agree on.
 */
const WEB_PAN_Y = { touchAction: 'pan-y' } as unknown as ViewStyle

const useStyles = makeStyles(({ colors, font, spacing, radius, cardShadow }) => ({
  row: { justifyContent: 'center' },
  slider: Platform.OS === 'web' ? WEB_PAN_Y : {},
  /** Under the bubble, on the side it is dragged away from. */
  arrow: {
    alignItems: 'center',
    bottom: 0,
    justifyContent: 'center',
    position: 'absolute',
    start: 6,
    top: 0,
    width: 24,
  },
  bubble: {
    borderRadius: 20,
    maxWidth: '82%',
    paddingHorizontal: 16,
    paddingVertical: 13,
  },
  /**
   * v3 retires the yellow bubble: yellow is the committing action, once per
   * screen, and that is the send button. Your side is the soft blue tint,
   * theirs the fill grey — both carry ordinary `text`, which is also what
   * lets the meta and ticks share one palette across the two sides.
   */
  mine: { alignSelf: 'flex-end', backgroundColor: colors.accentBg },
  theirs: { alignSelf: 'flex-start', backgroundColor: colors.fill },
  /**
   * One square corner on the side the bubble comes from. It is the whole of
   * what makes a stack of bubbles read as a conversation rather than as a list
   * of cards, and it costs one radius each — but only on the last message of a
   * run, so five messages in a row read as one turn rather than five.
   */
  tailMine: { borderBottomEndRadius: 6 },
  tailTheirs: { borderBottomStartRadius: 6 },
  /**
   * The quote reads as a layer under the reply rather than as a message of its
   * own: one accent edge, a tint of whatever bubble it sits in, two lines at
   * most. Any longer and a reply to a long message looks like a reply *from* it.
   */
  quote: {
    // `start`, not `left`: the accent edge marks where the quote begins, which
    // is the right-hand side in Arabic. `left` would put it at the end of the
    // line, where it reads as a stray rule rather than as a quote bar.
    borderStartWidth: 3,
    borderRadius: radius.sm,
    marginBottom: spacing.sm,
    paddingHorizontal: spacing.sm,
    paddingVertical: 6,
  },
  quoteTheirs: { backgroundColor: colors.bg, borderStartColor: colors.accent },
  // Both bubbles are light tints now, so the same white layer works in each.
  quoteMine: { backgroundColor: colors.bg, borderStartColor: colors.accent },
  quoteAuthor: { ...font.caption, color: colors.accent, fontWeight: '700' },
  quoteAuthorMine: { color: colors.accent },
  quoteText: { ...font.caption, color: colors.textMuted },
  quoteTextMine: { color: colors.textMuted },
  /**
   * A ring rather than a fill: the bubble already carries meaning in its
   * colour — whose it is, and whether it is a correction — and a wash over
   * that would say the wrong thing for a second and a half.
   */
  highlighted: { borderColor: colors.accent, borderWidth: 2 },
  tombstone: { backgroundColor: colors.fill },
  edited: { ...font.caption, color: colors.textMuted, fontStyle: 'italic' },
  editedMine: { color: colors.textMuted },
  tombstoneRow: { alignItems: 'center', flexDirection: 'row', gap: 6 },
  tombstoneText: { ...font.body, color: colors.textMuted, fontStyle: 'italic' },
  /**
   * Inside the bubble, not overhanging it — one shape for all four message
   * kinds beats a special case that only looks right in three of them.
   */
  reactions: {
    ...cardShadow,
    alignSelf: 'flex-start',
    backgroundColor: colors.bg,
    borderColor: colors.border,
    borderRadius: radius.pill,
    borderWidth: 1,
    flexDirection: 'row',
    gap: 2,
    marginTop: 6,
    paddingHorizontal: 6,
    paddingVertical: 2,
  },
  reactionsMine: { alignSelf: 'flex-end' },
  reactionsTheirs: { alignSelf: 'flex-start' },
  reaction: { alignItems: 'center', flexDirection: 'row', gap: 2 },
  reactionGlyph: { fontSize: 13, lineHeight: 18 },
  reactionCount: { ...font.caption, color: colors.textMuted, fontWeight: '700' },
  /**
   * No background and no padding: the glyph is the message. `alignSelf` still
   * picks a side, because who sent it is the one thing the shape no longer says.
   */
  hero: { gap: spacing.xs, paddingVertical: 2 },
  heroMine: { alignSelf: 'flex-end', alignItems: 'flex-end' },
  heroTheirs: { alignSelf: 'flex-start', alignItems: 'flex-start' },
  // 48 is the house size for a hero glyph — `AppGate` uses it, `IntroCarousel`
  // 64. Bubble text is 16, so this reads as deliberate rather than as a font bug.
  heroText: { fontSize: 48, lineHeight: 58 },
  bubbleText: { ...font.body, color: colors.text, fontSize: 16, lineHeight: 24 },
  bubbleTextMine: { color: colors.text },
  caption: { marginTop: spacing.xs },
  translation: {
    ...font.caption,
    borderTopColor: colors.border,
    borderTopWidth: StyleSheet.hairlineWidth,
    color: colors.textMuted,
    marginTop: spacing.xs,
    paddingTop: spacing.xs,
  },
  translationMine: { borderTopColor: colors.border, color: colors.textMuted },
  translateLink: { ...font.caption, color: colors.accent, marginTop: spacing.xs },
  /**
   * v3 draws the card as a quiet green panel — no outline, no header rule.
   * The kicker and the diff carry the structure themselves.
   */
  correction: {
    backgroundColor: colors.successBg,
    borderRadius: radius.lg,
  },
  // A correction is about a sentence, not about who is winning, so it spans the
  // thread rather than taking a side. Only the alignment marks the author.
  correctionMine: { alignSelf: 'stretch' },
  correctionHead: {
    alignItems: 'center',
    flexDirection: 'row',
    gap: 7,
    paddingHorizontal: 16,
    paddingTop: 15,
  },
  correctionLabel: { ...font.heading, color: colors.success, fontSize: 13 },
  correctionBody: { paddingBottom: 13, paddingHorizontal: 16, paddingTop: 9 },
  correctionOriginal: {
    ...font.label,
    color: colors.textMuted,
    fontWeight: '400',
    lineHeight: 21,
  },
  /**
   * The pair that carries the whole meaning of the card. Both are marked by a
   * cue that survives colour-blindness — the strike and the weight — because
   * a correction that only differs by hue says nothing to a reader who cannot
   * separate the shades. v3 keeps the removal neutral: what went is history,
   * what came is the point, so only the addition takes the green.
   */
  removed: { color: colors.textMuted, textDecorationLine: 'line-through' },
  added: { color: colors.success, fontWeight: '700' },
  correctionText: {
    ...font.body,
    color: colors.text,
    fontSize: 16,
    fontWeight: '600',
    lineHeight: 25,
    marginTop: 6,
  },
  correctionNote: {
    ...font.label,
    color: colors.textMuted,
    fontSize: 14,
    fontWeight: '400',
    lineHeight: 21,
    marginTop: 9,
  },
}))

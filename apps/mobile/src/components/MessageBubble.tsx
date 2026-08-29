import Feather from '@expo/vector-icons/Feather'
import { memo, useMemo, useRef } from 'react'
import { Animated, PanResponder, Platform, Pressable, StyleSheet, Text, View } from 'react-native'
import type { MessageDto } from '../api/queries'
import type { AnchorRect } from '../lib/messageMenu'
import { shouldCaptureSwipe, swipeReleased, swipeTranslation } from '../lib/swipeToReply'
import { makeStyles, useTheme } from '../lib/theme'
import { AudioBubble, ImageBubble } from './MediaBubble'
import { MessageMeta } from './MessageMeta'

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
}: MessageBubbleProps) {
  const { colors } = useTheme()
  const styles = useStyles()
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
   * Swipe right to reply — native only.
   *
   * Off on web deliberately. react-native-web does map mouse events onto the
   * responder system, so a drag reaches this, but it fights the browser's own
   * text selection and a trackpad's horizontal gesture is a `wheel` event that
   * never arrives here at all. A gesture that works for some inputs and not
   * others is worse than one that is plainly absent; in a browser the menu's
   * Reply row is the way in.
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

  const pan = Platform.OS === 'web' ? {} : responder.panHandlers
  const flash = highlighted ? styles.highlighted : null

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
      accessibilityLabel="Go to the quoted message"
      onPress={() => onJumpTo(replyTo.messageId)}
      style={[styles.quote, mine ? styles.quoteMine : styles.quoteTheirs]}
    >
      <Text style={[styles.quoteAuthor, mine && styles.quoteAuthorMine]} numberOfLines={1}>
        {replyToMine ? 'You' : partnerName}
      </Text>
      <Text style={[styles.quoteText, mine && styles.quoteTextMine]} numberOfLines={2}>
        {replyTo.preview || 'Attachment'}
      </Text>
    </Pressable>
  ) : null

  /**
   * A withdrawal keeps its place in the thread rather than closing the gap.
   * The alternative — removing the row — rewrites the shape of a conversation
   * the other person remembers having, which is worse than an obvious hole.
   */
  if (message.deleted) {
    return (
      <Animated.View ref={box} style={{ transform: [{ translateX }] }} {...pan}>
        <Pressable
          onLongPress={press}
          style={[styles.bubble, mine ? styles.mine : styles.theirs, styles.tombstone, flash]}
        >
          <View style={styles.tombstoneRow}>
            <Feather name="slash" size={13} color={colors.textMuted} />
            <Text style={styles.tombstoneText}>This message was deleted</Text>
          </View>
          <MessageMeta message={message} mine={mine} />
        </Pressable>
      </Animated.View>
    )
  }

  if (message.type === 'correction') {
    return (
      <Animated.View ref={box} style={{ transform: [{ translateX }] }} {...pan}>
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
              {mine ? 'Your correction' : `Correction from ${partnerName}`}
            </Text>
          </View>
          <View style={styles.correctionBody}>
            {message.correction ? (
              <Text style={styles.correctionOriginal}>{message.correction.original}</Text>
            ) : null}
            <Text style={styles.correctionText}>{message.body}</Text>
            {message.correction?.note ? (
              <Text style={styles.correctionNote}>{message.correction.note}</Text>
            ) : null}
            <MessageMeta message={message} mine={mine} />
          </View>
          {badge}
        </Pressable>
      </Animated.View>
    )
  }

  const tail = endsGroup ? (mine ? styles.tailMine : styles.tailTheirs) : null

  if (message.type === 'image' || message.type === 'audio') {
    return (
      <Animated.View ref={box} style={{ transform: [{ translateX }] }} {...pan}>
        <Pressable
          onLongPress={press}
          style={[styles.bubble, mine ? styles.mine : styles.theirs, tail, flash]}
        >
          {quote}
          {message.type === 'image' ? (
            <ImageBubble message={message} />
          ) : (
            <AudioBubble message={message} mine={mine} />
          )}
          {message.body ? (
            <Text style={[styles.bubbleText, mine && styles.bubbleTextMine, styles.caption]}>
              {message.body}
            </Text>
          ) : null}
          <MessageMeta message={message} mine={mine} />
          {badge}
        </Pressable>
      </Animated.View>
    )
  }

  return (
    <Animated.View ref={box} style={{ transform: [{ translateX }] }} {...pan}>
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
        {translating ? <Text style={styles.translateLink}>Translating…</Text> : null}
        <MessageMeta message={message} mine={mine} />
        {badge}
      </Pressable>
    </Animated.View>
  )
})

const useStyles = makeStyles(({ colors, font, spacing, radius, cardShadow }) => ({
  bubble: {
    borderRadius: radius.lg,
    maxWidth: '82%',
    paddingHorizontal: 14,
    paddingVertical: spacing.md,
  },
  mine: { alignSelf: 'flex-end', backgroundColor: colors.primary },
  theirs: {
    alignSelf: 'flex-start',
    backgroundColor: colors.surface,
    borderColor: colors.border,
    borderWidth: 1,
  },
  /**
   * One square corner on the side the bubble comes from. It is the whole of
   * what makes a stack of bubbles read as a conversation rather than as a list
   * of cards, and it costs one radius each — but only on the last message of a
   * run, so five messages in a row read as one turn rather than five.
   */
  tailMine: { borderBottomRightRadius: radius.sm / 2 },
  tailTheirs: { borderBottomLeftRadius: radius.sm / 2 },
  /**
   * The quote reads as a layer under the reply rather than as a message of its
   * own: one accent edge, a tint of whatever bubble it sits in, two lines at
   * most. Any longer and a reply to a long message looks like a reply *from* it.
   */
  quote: {
    borderLeftWidth: 3,
    borderRadius: radius.sm,
    marginBottom: spacing.sm,
    paddingHorizontal: spacing.sm,
    paddingVertical: 6,
  },
  quoteTheirs: { backgroundColor: colors.bg, borderLeftColor: colors.accent },
  quoteMine: { backgroundColor: colors.primaryShade, borderLeftColor: colors.primaryText },
  quoteAuthor: { ...font.caption, color: colors.accent, fontWeight: '700' },
  quoteAuthorMine: { color: colors.primaryText },
  quoteText: { ...font.caption, color: colors.textMuted },
  quoteTextMine: { color: colors.primaryTextMuted },
  /**
   * A ring rather than a fill: the bubble already carries meaning in its
   * colour — whose it is, and whether it is a correction — and a wash over
   * that would say the wrong thing for a second and a half.
   */
  highlighted: { borderColor: colors.accent, borderWidth: 2 },
  tombstone: { backgroundColor: colors.surface, borderColor: colors.border, borderWidth: 1 },
  tombstoneRow: { alignItems: 'center', flexDirection: 'row', gap: 6 },
  tombstoneText: { ...font.body, color: colors.textMuted, fontStyle: 'italic' },
  /**
   * Inside the bubble, not overhanging it. An overhang reads better, but the
   * correction card clips to its rounded header (`overflow: 'hidden'`, which
   * the header border needs) and would cut the badge in half — one shape for
   * all four beats a special case that only looks right in three of them.
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
  bubbleText: { ...font.body, color: colors.text, lineHeight: 22 },
  bubbleTextMine: { color: colors.primaryText },
  caption: { marginTop: spacing.xs },
  translation: {
    ...font.caption,
    borderTopColor: colors.border,
    borderTopWidth: StyleSheet.hairlineWidth,
    color: colors.textMuted,
    marginTop: spacing.xs,
    paddingTop: spacing.xs,
  },
  translationMine: { borderTopColor: colors.primaryTextMuted, color: colors.primaryTextMuted },
  translateLink: { ...font.caption, color: colors.accent, marginTop: spacing.xs },
  correction: {
    backgroundColor: colors.successBg,
    borderColor: colors.success,
    borderRadius: radius.lg,
    borderWidth: 1,
    overflow: 'hidden',
  },
  // A correction is about a sentence, not about who is winning, so it spans the
  // thread rather than taking a side. Only the alignment marks the author.
  correctionMine: { alignSelf: 'stretch' },
  correctionHead: {
    alignItems: 'center',
    borderBottomColor: colors.success,
    borderBottomWidth: 1,
    flexDirection: 'row',
    gap: 7,
    paddingHorizontal: 14,
    paddingVertical: 10,
  },
  correctionLabel: { ...font.heading, color: colors.success, fontSize: 13 },
  correctionBody: { paddingHorizontal: 14, paddingVertical: 13 },
  correctionOriginal: {
    ...font.label,
    color: colors.textMuted,
    fontWeight: '400',
    lineHeight: 21,
    textDecorationLine: 'line-through',
  },
  correctionText: {
    ...font.body,
    color: colors.text,
    fontWeight: '600',
    lineHeight: 22,
    marginTop: 6,
  },
  correctionNote: {
    ...font.label,
    borderTopColor: colors.success,
    borderTopWidth: 1,
    color: colors.textMuted,
    fontWeight: '400',
    lineHeight: 20,
    marginTop: 11,
    paddingTop: 10,
  },
}))

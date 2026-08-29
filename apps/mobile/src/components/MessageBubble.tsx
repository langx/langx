import Feather from '@expo/vector-icons/Feather'
import { memo } from 'react'
import { Pressable, StyleSheet, Text, View } from 'react-native'
import type { MessageDto } from '../api/queries'
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
  onLongPress: (message: MessageDto, alreadyTranslated: boolean) => void
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
  onLongPress,
}: MessageBubbleProps) {
  const { colors } = useTheme()
  const styles = useStyles()
  const press = () => onLongPress(message, Boolean(translation))

  if (message.type === 'correction') {
    return (
      <Pressable
        onLongPress={press}
        style={[styles.correction, mine ? styles.correctionMine : null]}
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
      </Pressable>
    )
  }

  const tail = endsGroup ? (mine ? styles.tailMine : styles.tailTheirs) : null

  if (message.type === 'image' || message.type === 'audio') {
    return (
      <Pressable
        onLongPress={press}
        style={[styles.bubble, mine ? styles.mine : styles.theirs, tail]}
      >
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
      </Pressable>
    )
  }

  return (
    <Pressable
      onLongPress={press}
      style={[styles.bubble, mine ? styles.mine : styles.theirs, tail]}
    >
      <Text style={[styles.bubbleText, mine && styles.bubbleTextMine]}>{message.body}</Text>
      {translation ? (
        <Text style={[styles.translation, mine && styles.translationMine]}>{translation}</Text>
      ) : null}
      {/* The link is gone — translate is a menu row now. This only reports the
          request already in flight. */}
      {translating ? <Text style={styles.translateLink}>Translating…</Text> : null}
      <MessageMeta message={message} mine={mine} />
    </Pressable>
  )
})

const useStyles = makeStyles(({ colors, font, spacing, radius }) => ({
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

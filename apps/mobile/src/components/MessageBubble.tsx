import Feather from '@expo/vector-icons/Feather'
import { Ionicons } from '@expo/vector-icons'
import { memo, useCallback, useEffect, useRef, type ReactNode } from 'react'
import {
  Animated,
  Platform,
  Pressable,
  Text,
  View,
  type TextStyle,
  type ViewStyle,
} from 'react-native'
import { Gesture, GestureDetector } from 'react-native-gesture-handler'
import Reanimated, {
  interpolate,
  runOnJS,
  useAnimatedStyle,
  useSharedValue,
  withSpring,
} from 'react-native-reanimated'
import type { MessageDto } from '../api/queries'
import {
  attachmentsOf,
  type Media,
  type MeetingStatus,
  type MessageAsk,
  type MessageType,
} from '@langx/shared'
import { isBigEmoji } from '../lib/singleEmoji'
import type { AnchorRect } from '../lib/messageMenu'
import {
  SWIPE_ACTIVATE_PX,
  SWIPE_LOCK_PX,
  swipeReleased,
  swipeToReplyEnabled,
  swipeTranslation,
} from '../lib/swipeToReply'
import { makeStyles, useTheme } from '../lib/theme'
import { MediaGallery } from './MediaBubble'
import { MessageMeta } from './MessageMeta'
import { Image } from 'expo-image'
import { stickerAsset } from '../lib/stickerAssets'
import { useT, type MessageKey } from '../i18n'

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
  /** Briefly ringed after a jump, so the reader sees where they landed. */
  highlighted: boolean
  /** An optimistic stand-in for a send in flight; the meta says "Sending". */
  pending?: boolean
  /**
   * Whether the request this message carries has been answered.
   *
   * Worked out by the thread, not here: a correction stamps `corrected` on its
   * target, but a spoken answer is just a voice note quoting the message, and
   * only something holding the whole list can see it. The bubble stays dumb.
   */
  askAnswered?: boolean
  onLongPress: (message: MessageDto, alreadyTranslated: boolean, anchor?: AnchorRect) => void
  onReply: (message: MessageDto) => void
  /** Answers the request on somebody else's message — correct it, or say it. */
  onAnswerAsk: (message: MessageDto, ask: MessageAsk) => void
  /** Accepts, declines or withdraws a proposed time. */
  onRespondMeeting: (message: MessageDto, status: 'accepted' | 'declined' | 'cancelled') => void
  /** Answers a quiz. Once, and never your own. */
  onAnswerQuiz: (message: MessageDto, index: number) => void
  /** Hands an agreed meeting to the reader's calendar, as an `.ics`. */
  onAddToCalendar: (message: MessageDto) => void
  /**
   * The proposal in the reader's own zone, formatted by the thread — only it
   * has the profile the zone comes from. Empty for anything but a meeting.
   *
   * The other person's clock is deliberately *not* drawn. It would need
   * `timezone` on the public profile, and a timezone is about as coarse a
   * location as a city — which this app puts behind its own switch. Showing
   * the reader their own time is the arithmetic that was worth doing anyway.
   */
  meetingWhen?: string
  meetingLength?: string
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
  highlighted,
  pending = false,
  askAnswered = false,
  onLongPress,
  onReply,
  onAnswerAsk,
  onRespondMeeting,
  onAnswerQuiz,
  onAddToCalendar,
  meetingWhen = '',
  meetingLength = '',
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
   *
   * On the bubble itself, not on the column it slides in: the quote above and
   * the clock below are part of the row but not of the bubble, and the menu's
   * lifted copy has to land on the bubble.
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
  const translateX = useSharedValue(0)
  const pan = Gesture.Pan()
    .enabled(swipeToReplyEnabled(Platform.OS, HAS_TOUCH))
    /*
     * The same two thresholds `shouldCaptureSwipe` applied, now decided
     * natively — which is what stops the drag from competing with the list's
     * own scroll on the JS thread.
     *
     * A single positive number, not a pair: reply is a rightwards gesture
     * only, and leaving the other direction unclaimed keeps it free for a
     * later action, exactly as `shouldCaptureSwipe` said.
     */
    .activeOffsetX(SWIPE_LOCK_PX)
    .failOffsetY([-SWIPE_LOCK_PX, SWIPE_LOCK_PX])
    .onUpdate((event) => {
      translateX.value = swipeTranslation(event.translationX)
    })
    .onEnd((event) => {
      if (swipeReleased(event.translationX)) runOnJS(onReply)(message)
      translateX.value = withSpring(0, { damping: 20, stiffness: 220, overshootClamping: true })
    })
  const flash = highlighted ? styles.highlighted : null

  /**
   * A bounce on arrival that a tap can replay.
   *
   * RN's `Animated`, still, even though Reanimated is now imported a few lines
   * up for the swipe. This is a one-shot spring on a property nothing else
   * reads and no gesture drives — the case `Animated` handles perfectly well
   * with `useNativeDriver` — and moving it would buy nothing. `Button` does
   * exactly this shape.
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

  /**
   * The arrow WhatsApp shows under the bubble as it slides. Driven by the same
   * value as the bubble, so it fades in exactly as far as the gesture has
   * travelled and reaches full strength at the point where letting go actually
   * replies.
   *
   * This is where the old version had a real bug rather than only a slow one:
   * `translateX` was `setValue`-driven, spring-animated with
   * `useNativeDriver: true`, *and* read here by a JS-side `interpolate` — the
   * classic "this animated node has been moved to the native side" mismatch.
   * The arrow simply stopped following after the first swipe. On the UI thread
   * there is one value and one reader.
   */
  const arrowStyle = useAnimatedStyle(() => ({
    opacity: interpolate(translateX.value, [0, SWIPE_ACTIVATE_PX], [0, 1], 'clamp'),
  }))
  const sliderStyle = useAnimatedStyle(() => ({
    transform: [{ translateX: translateX.value }],
  }))

  /**
   * Every branch below is the same shell: the arrow underneath, the bubble on
   * top of it, and the pan handlers on the part that moves.
   */
  const shell = (children: ReactNode): ReactNode => (
    <View style={styles.row}>
      <Reanimated.View style={[styles.arrow, arrowStyle]} pointerEvents="none">
        <Feather name="corner-up-left" size={15} color={colors.textMuted} />
      </Reanimated.View>
      <GestureDetector gesture={pan}>
        <Animated.View style={styles.slider}>
          <Reanimated.View style={sliderStyle}>{children}</Reanimated.View>
        </Animated.View>
      </GestureDetector>
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
      <View style={styles.reactions}>
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
      style={styles.quote}
    >
      <Text style={styles.quoteText} numberOfLines={1}>
        {replyTo.preview || t('messageMeta.attachment')}
      </Text>
    </Pressable>
  ) : null

  /**
   * Every message is a short column on its side: the quote above, the bubble,
   * then what hangs under it — the translation, the clock. v3 moves the meta
   * out of the bubble so both sides carry the same faint line under the same
   * rounded shape, and the side is the only thing that says whose it is.
   */
  const column = [styles.column, mine ? styles.columnMine : styles.columnTheirs]
  const meta = <MessageMeta message={message} mine={mine} pending={pending} />

  /**
   * A withdrawal keeps its place in the thread rather than closing the gap.
   * The alternative — removing the row — rewrites the shape of a conversation
   * the other person remembers having, which is worse than an obvious hole.
   */
  if (message.deleted) {
    return shell(
      <Pressable onLongPress={press} style={column}>
        <View ref={box} style={[styles.bubble, styles.tombstone, flash]}>
          <View style={styles.tombstoneRow}>
            <Feather name="slash" size={13} color={colors.textMuted} />
            <Text style={styles.tombstoneText}>{t('chat.deleted')}</Text>
          </View>
        </View>
        {meta}
      </Pressable>,
    )
  }

  if (message.type === 'correction') {
    return shell(
      <Pressable ref={box} onLongPress={press} style={[styles.correction, flash]}>
        {/*
          The success pair, and only ever the success pair. A correction is
          another person changing your sentence; the info pair belongs to
          Copilot, which proposes one you have not sent. The two must never be
          confusable — see `Callout`.
        */}
        <Text style={styles.correctionLabel}>
          {mine ? t('chat.yourCorrection') : t('chat.correctionFrom', { name: partnerName })}
        </Text>
        {/*
          The whole original struck through, the whole rewrite in weight: two
          cues that survive colour-blindness, and no colour on the words
          themselves — the green is the card's, not the sentence's.
        */}
        {correction ? <Text style={styles.correctionOriginal}>{correction.original}</Text> : null}
        <Text style={styles.correctionText}>{message.body}</Text>
        {correction?.note ? <Text style={styles.correctionNote}>{correction.note}</Text> : null}
        {badge}
        <View style={styles.correctionMeta}>{meta}</View>
      </Pressable>,
    )
  }

  if (message.type === 'phrase' && message.phrase) {
    const { term, meaning, example } = message.phrase
    return shell(
      <Pressable onLongPress={press} style={column}>
        <View ref={box} style={[styles.card, flash]}>
          <Text style={styles.cardKicker}>{t('chat.phraseCard')}</Text>
          <Text style={styles.phraseTerm}>{term}</Text>
          <Text style={styles.phraseMeaning}>{meaning}</Text>
          {example ? <Text style={styles.phraseExample}>{example}</Text> : null}
        </View>
        {badge}
        <View style={styles.cardMeta}>{meta}</View>
      </Pressable>,
    )
  }

  if (message.type === 'meeting' && message.meeting) {
    const meeting = message.meeting
    const answered = meeting.status !== 'proposed'
    return shell(
      <Pressable onLongPress={press} style={column}>
        <View ref={box} style={[styles.card, flash]}>
          <Text style={styles.cardKicker}>{t('chat.meetingCard')}</Text>
          {/*
          In the reader's own zone, always. The two of them are in different
          ones by definition — it is what the app is for — so a raw time is a
          question rather than an answer.
        */}
          <Text style={styles.meetingWhen}>{meetingWhen}</Text>
          <Text style={styles.meetingTheirs}>{meetingLength}</Text>
          {meeting.note ? <Text style={styles.phraseExample}>{meeting.note}</Text> : null}
          {answered ? (
            <View style={styles.meetingAnswered}>
              <Text style={[styles.meetingStatus, statusStyle(meeting.status, styles)]}>
                {t(meetingStatusKey(meeting.status))}
              </Text>
              {/*
                Only once it is agreed. Offering this on a proposal would put
                something in somebody's calendar that the other person has not
                said yes to, which is worse than making them tap twice.
              */}
              {meeting.status === 'accepted' ? (
                <Pressable hitSlop={8} onPress={() => onAddToCalendar(message)}>
                  <Text style={styles.meetingAccept}>{t('chat.meetingAddToCalendar')}</Text>
                </Pressable>
              ) : null}
            </View>
          ) : (
            /*
            The proposer can only withdraw and the invitee can only answer —
            the same split the server enforces, drawn so neither is offered a
            button that would come back refused.
          */
            <View style={styles.meetingActions}>
              {mine ? (
                <Pressable hitSlop={8} onPress={() => onRespondMeeting(message, 'cancelled')}>
                  <Text style={styles.meetingDecline}>{t('chat.meetingCancel')}</Text>
                </Pressable>
              ) : (
                <>
                  <Pressable hitSlop={8} onPress={() => onRespondMeeting(message, 'accepted')}>
                    <Text style={styles.meetingAccept}>{t('chat.meetingAccept')}</Text>
                  </Pressable>
                  <Pressable hitSlop={8} onPress={() => onRespondMeeting(message, 'declined')}>
                    <Text style={styles.meetingDecline}>{t('chat.meetingDecline')}</Text>
                  </Pressable>
                </>
              )}
            </View>
          )}
        </View>
        {badge}
        <View style={styles.cardMeta}>{meta}</View>
      </Pressable>,
    )
  }

  if (message.type === 'sticker' && message.sticker) {
    const picture = stickerAsset(message.sticker.packId, message.sticker.stickerId)
    return shell(
      <Pressable onLongPress={press} style={column}>
        {/*
          No bubble behind it. A sticker is the whole message, and a chrome
          rectangle around one is what makes it look like a picture somebody
          attached rather than a thing they said.
        */}
        <View ref={box} style={flash}>
          {picture ? (
            <Image source={picture} style={styles.sticker} contentFit="contain" />
          ) : (
            // A pack this build does not carry — the same case as an unknown
            // message type, and answered the same way rather than with a gap.
            <Text style={styles.phraseMeaning}>{t('chat.unsupportedMessage')}</Text>
          )}
        </View>
        {badge}
        <View style={styles.cardMeta}>{meta}</View>
      </Pressable>,
    )
  }

  if (message.type === 'quiz' && message.quiz) {
    const quiz = message.quiz
    const answered = quiz.answer !== undefined
    return shell(
      <Pressable onLongPress={press} style={column}>
        <View ref={box} style={[styles.card, flash]}>
          <Text style={styles.cardKicker}>{t('chat.quizCard')}</Text>
          <Text style={styles.phraseMeaning}>{quiz.question}</Text>
          {quiz.options.map((option, index) => {
            const isRight = index === quiz.correctIndex
            const chosen = quiz.answer?.index === index
            return (
              <Pressable
                key={option}
                accessibilityRole="button"
                /*
                 * The asker never answers their own question, and an answered
                 * quiz is read-only — a second go would find the right option
                 * by elimination, which is not an answer to anything. Both
                 * rules are the server's; this only avoids offering a tap that
                 * would come back refused.
                 */
                disabled={mine || answered}
                onPress={() => onAnswerQuiz(message, index)}
                style={({ pressed }) => [
                  styles.quizOption,
                  answered && isRight && styles.quizRight,
                  answered && chosen && !isRight && styles.quizWrong,
                  pressed && !mine && !answered && styles.quizPressed,
                ]}
              >
                <Text style={styles.quizOptionText}>{option}</Text>
                {answered && isRight ? (
                  <Feather name="check" size={15} color={colors.success} />
                ) : null}
                {answered && chosen && !isRight ? (
                  <Feather name="x" size={15} color={colors.danger} />
                ) : null}
              </Pressable>
            )
          })}
        </View>
        {badge}
        <View style={styles.cardMeta}>{meta}</View>
      </Pressable>,
    )
  }

  /*
   * A type this build has never heard of.
   *
   * It happens by construction, not by accident: a new message type ships to
   * the server first and reaches phones over an OTA update afterwards, so for
   * a while somebody's copy of the app is older than the messages arriving in
   * it. Falling through to the text bubble would draw an empty one — these
   * types carry no `body` — and an empty bubble reads as a bug in the app
   * rather than a gap in it.
   */
  if (!isDrawableType(message.type)) {
    return shell(
      <Pressable onLongPress={press} style={column}>
        <View ref={box} style={[styles.card, flash]}>
          <Text style={styles.phraseMeaning}>{t('chat.unsupportedMessage')}</Text>
        </View>
        <View style={styles.cardMeta}>{meta}</View>
      </Pressable>,
    )
  }

  const tail = endsGroup ? (mine ? styles.tailMine : styles.tailTheirs) : null
  const bubble = [styles.bubble, mine ? styles.mine : styles.theirs, tail, flash]

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
        style={column}
      >
        {quote}
        <View ref={box} style={bubble}>
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
            <Text style={[styles.bubbleText, styles.caption]}>{message.body}</Text>
          ) : null}
        </View>
        {badge}
        {meta}
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
      <Pressable onPress={replay} onLongPress={press} style={column}>
        {quote}
        <View ref={box}>
          <Animated.Text style={[styles.heroText, { transform: [{ scale: heroScale }] }]}>
            {message.body}
          </Animated.Text>
        </View>
        {translating ? <Text style={styles.translateLink}>{t('chat.translating')}</Text> : null}
        {badge}
        {meta}
      </Pressable>,
    )
  }

  return shell(
    <Pressable onLongPress={press} style={column}>
      {quote}
      <View ref={box} style={bubble}>
        <Text style={styles.bubbleText}>{message.body}</Text>
      </View>
      {/*
        The request the sender attached, under their sentence rather than
        inside it: the sentence is what they wrote, and this is a note about
        it. Only the other person is offered the button — you cannot correct
        your own attempt, and being shown a control that does nothing is worse
        than being shown none.
      */}
      {message.ask ? (
        <View style={styles.askRow}>
          <Feather
            name={message.ask === 'correction' ? 'edit-3' : 'volume-2'}
            size={13}
            color={colors.textFaint}
          />
          <Text style={styles.askLabel}>
            {message.ask === 'correction'
              ? t('chat.askBadgeCorrection')
              : t('chat.askBadgePronunciation')}
          </Text>
          {!mine && !askAnswered ? (
            <Pressable
              accessibilityRole="button"
              hitSlop={8}
              onPress={() => onAnswerAsk(message, message.ask as MessageAsk)}
            >
              <Text style={styles.askAction}>
                {message.ask === 'correction' ? t('chat.askAnswerCorrect') : t('chat.askAnswerSay')}
              </Text>
            </Pressable>
          ) : null}
        </View>
      ) : null}
      {badge}
      {/*
        The translation the sender chose to send, not one this reader asked
        for: it is part of the message, so it is drawn under the bubble for
        both of them and survives a reload. The menu's own translation is the
        row below, and looks different on purpose — one is published, the
        other is private.
      */}
      {message.translation ? (
        <View style={styles.sentTranslationRow}>
          <Feather name="globe" size={13} color={colors.textFaint} />
          <Text style={styles.sentTranslation}>{message.translation.text}</Text>
        </View>
      ) : null}
      {translation ? (
        <View style={styles.translationRow}>
          <Ionicons
            name="language-outline"
            size={14}
            color={colors.accent}
            style={styles.translationIcon}
          />
          <Text style={styles.translation}>{translation}</Text>
        </View>
      ) : null}
      {/* The link is gone — translate is a menu row now. This only reports the
            request already in flight. */}
      {translating ? <Text style={styles.translateLink}>{t('chat.translating')}</Text> : null}
      {/* Beside the clock, not in place of it: "when" and "changed since" are
            two different facts and the reader wants both. */}
      {message.editedAt ? <Text style={styles.edited}>{t('messageMeta.edited')}</Text> : null}
      {meta}
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
  /**
   * The quote, the bubble and the meta stacked on one side. 78% is the
   * prototype's cap; the gap is what used to be the meta's own top margin.
   */
  column: { gap: 6, maxWidth: '78%' },
  columnMine: { alignItems: 'flex-end', alignSelf: 'flex-end' },
  columnTheirs: { alignItems: 'flex-start', alignSelf: 'flex-start' },
  bubble: {
    borderRadius: 20,
    paddingHorizontal: 16,
    paddingVertical: 13,
  },
  /**
   * v3 retires the yellow bubble: yellow is the committing action, once per
   * screen, and that is the send button. Your side is the soft blue tint,
   * theirs the fill grey — both carry ordinary `text`, which is also what
   * lets the meta share one palette across the two sides.
   */
  mine: { backgroundColor: colors.accentBg },
  theirs: { backgroundColor: colors.fill },
  /**
   * One square corner on the side the bubble comes from. It is the whole of
   * what makes a stack of bubbles read as a conversation rather than as a list
   * of cards, and it costs one radius each — but only on the last message of a
   * run, so five messages in a row read as one turn rather than five.
   */
  tailMine: { borderBottomEndRadius: 6 },
  tailTheirs: { borderBottomStartRadius: 6 },
  /**
   * The quote is one muted line behind an accent edge, above the bubble rather
   * than inside it — a layer under the reply, not a message of its own.
   *
   * `start`, not `left`: the accent edge marks where the quote begins, which
   * is the right-hand side in Arabic. `left` would put it at the end of the
   * line, where it reads as a stray rule rather than as a quote bar.
   */
  quote: {
    borderStartColor: colors.accent,
    borderStartWidth: 2,
    maxWidth: '100%',
    paddingHorizontal: 10,
    paddingVertical: 2,
  },
  quoteText: { ...font.caption, color: colors.textMuted, fontSize: 13 },
  /**
   * A ring rather than a fill: the bubble already carries meaning in its
   * colour — whose it is, and whether it is a correction — and a wash over
   * that would say the wrong thing for a second and a half.
   */
  highlighted: { borderColor: colors.accent, borderWidth: 2 },
  tombstone: { backgroundColor: colors.fill },
  edited: { ...font.caption, color: colors.textMuted, fontStyle: 'italic' },
  tombstoneRow: { alignItems: 'center', flexDirection: 'row', gap: 6 },
  tombstoneText: { ...font.body, color: colors.textMuted, fontStyle: 'italic' },
  /**
   * Under the bubble, hugging it: the column's gap places it and the column's
   * side aligns it, one shape for all four message kinds.
   */
  reactions: {
    ...cardShadow,
    backgroundColor: colors.bg,
    borderColor: colors.border,
    borderRadius: radius.pill,
    borderWidth: 1,
    flexDirection: 'row',
    gap: 2,
    paddingHorizontal: 6,
    paddingVertical: 2,
  },
  reaction: { alignItems: 'center', flexDirection: 'row', gap: 2 },
  reactionGlyph: { fontSize: 13, lineHeight: 18 },
  reactionCount: { ...font.caption, color: colors.textMuted, fontWeight: '700' },
  // 48 is the house size for a hero glyph — `AppGate` uses it, `IntroCarousel`
  // 64. Bubble text is 16, so this reads as deliberate rather than as a font bug.
  heroText: { fontSize: 48, lineHeight: 58 },
  // 16 on 23: the prototype's 16px/1.45.
  bubbleText: { ...font.body, color: colors.text, fontSize: 16, lineHeight: 23 },
  caption: { marginTop: spacing.xs },
  /**
   * Under the bubble in the accent, the translate glyph leading it: the
   * machine's voice, kept apart from what the person actually wrote.
   */
  translationRow: {
    alignItems: 'flex-start',
    flexDirection: 'row',
    gap: spacing.sm,
    paddingHorizontal: 6,
  },
  // Sits on the first line of the translation rather than centred on the block.
  card: {
    backgroundColor: colors.fill,
    borderRadius: radius.lg,
    gap: 3,
    maxWidth: 300,
    padding: 12,
  },
  cardKicker: {
    color: colors.textFaint,
    fontSize: 11,
    fontWeight: '700',
    letterSpacing: 0.5,
    textTransform: 'uppercase',
  },
  cardMeta: { marginTop: 4 },
  phraseTerm: { color: colors.text, fontSize: 17, fontWeight: '700' },
  phraseMeaning: { color: colors.text, fontSize: 15, lineHeight: 21 },
  phraseExample: { color: colors.textMuted, fontSize: 14, fontStyle: 'italic', lineHeight: 20 },
  meetingWhen: { color: colors.text, fontSize: 16, fontWeight: '700' },
  sticker: { height: 112, width: 112 },
  quizOption: {
    alignItems: 'center',
    backgroundColor: colors.bg,
    borderRadius: radius.md,
    flexDirection: 'row',
    gap: 8,
    marginTop: 6,
    paddingHorizontal: 12,
    paddingVertical: 10,
  },
  quizOptionText: { color: colors.text, flex: 1, fontSize: 15 },
  quizRight: { borderColor: colors.success, borderWidth: 1 },
  quizWrong: { borderColor: colors.danger, borderWidth: 1 },
  quizPressed: { opacity: 0.6 },
  meetingTheirs: { color: colors.textMuted, fontSize: 13 },
  meetingActions: { flexDirection: 'row', gap: 18, marginTop: 8 },
  meetingAnswered: { alignItems: 'center', flexDirection: 'row', gap: 14, marginTop: 2 },
  meetingAccept: { color: colors.success, fontSize: 14, fontWeight: '700' },
  meetingDecline: { color: colors.danger, fontSize: 14, fontWeight: '700' },
  meetingStatus: { fontSize: 14, fontWeight: '700', marginTop: 6 },
  meetingAccepted: { color: colors.success },
  meetingRefused: { color: colors.textMuted },
  sentTranslationRow: { alignItems: 'flex-start', flexDirection: 'row', gap: 5, marginTop: 4 },
  sentTranslation: { color: colors.textMuted, flexShrink: 1, fontSize: 13, lineHeight: 18 },
  askRow: { alignItems: 'center', flexDirection: 'row', gap: 5, marginTop: 4 },
  askLabel: { color: colors.textFaint, fontSize: 12 },
  askAction: { color: colors.accent, fontSize: 12, fontWeight: '700' },
  translationIcon: { marginTop: 3 },
  translation: { ...font.body, color: colors.accent, flexShrink: 1, fontSize: 14, lineHeight: 20 },
  translateLink: { ...font.caption, color: colors.accent },
  /**
   * v3 draws the card as a quiet green panel — no outline, no header rule —
   * spanning the thread: a correction is about a sentence, not about who is
   * winning, so it takes no side.
   */
  correction: {
    alignSelf: 'stretch',
    backgroundColor: colors.successBg,
    borderRadius: radius.lg,
    gap: 6,
    paddingHorizontal: 16,
    paddingVertical: 14,
  },
  correctionLabel: {
    color: colors.success,
    fontSize: 12,
    fontWeight: '700',
    letterSpacing: 0.5,
    textTransform: 'uppercase',
  },
  correctionOriginal: {
    ...font.body,
    color: colors.textMuted,
    lineHeight: 22,
    textDecorationLine: 'line-through',
  },
  correctionText: {
    ...font.body,
    color: colors.text,
    fontSize: 16,
    fontWeight: '600',
    lineHeight: 23,
  },
  correctionNote: {
    ...font.body,
    // A fifth of the success green, as the prototype rules it: the line has
    // to read as part of the card, and the palette has no token between the
    // tint and the full colour. Tokens are six-digit hex, so `33` is 20%.
    borderTopColor: `${colors.success}33`,
    borderTopWidth: 1,
    color: colors.textMuted,
    fontSize: 14,
    lineHeight: 20,
    marginTop: 2,
    paddingTop: spacing.sm,
  },
  // The clock on the card sits at its end, whichever side wrote it.
  correctionMeta: { alignSelf: 'flex-end' },
}))

/** Every type this build knows how to draw. Anything else gets the fallback. */
function isDrawableType(type: MessageType): boolean {
  return (
    type === 'text' ||
    type === 'correction' ||
    type === 'image' ||
    type === 'audio' ||
    type === 'video'
  )
}

function meetingStatusKey(status: MeetingStatus): MessageKey {
  if (status === 'accepted') return 'chat.meetingAccepted'
  if (status === 'declined') return 'chat.meetingDeclined'
  return 'chat.meetingCancelled'
}

/** Accepted is the one that reads as good news; the other two are just facts. */
function statusStyle(
  status: MeetingStatus,
  styles: { meetingAccepted: TextStyle; meetingRefused: TextStyle },
): TextStyle {
  return status === 'accepted' ? styles.meetingAccepted : styles.meetingRefused
}

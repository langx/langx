import Feather from '@expo/vector-icons/Feather'
import { Nunito_900Black } from '@expo-google-fonts/nunito/900Black'
import { applyEmoticon, emoticonAt } from '@langx/shared'
import * as Device from 'expo-device'
import { useFonts } from 'expo-font'
import { router } from 'expo-router'
import { useEffect, useRef, useState, type ReactNode } from 'react'
import {
  ActivityIndicator,
  Platform,
  Pressable,
  ScrollView,
  Text,
  TextInput,
  View,
  type NativeSyntheticEvent,
  type StyleProp,
  type TextInputKeyPressEventData,
  type ViewStyle,
} from 'react-native'
import Animated, {
  cancelAnimation,
  Easing,
  useAnimatedStyle,
  useSharedValue,
  withRepeat,
  withTiming,
} from 'react-native-reanimated'
import { useReduceMotion } from '../../hooks/useReduceMotion'
import { useT } from '../../i18n'
import { composerShowsMic } from '../../lib/composerRow'
import type { CopilotGate } from '../../lib/copilotGate'
import { pickStarters } from '../../lib/conversationStarters'
import { enterSendsOnNative, shouldSubmitOnEnter } from '../../lib/submitOnEnter'
import { makeStyles, useTheme } from '../../lib/theme'
import { EASE_OUT, unlessReduced } from '../../lib/theme/motion'
import { CopilotButton, CopilotMenu } from '../copilot/CopilotButton'
import { ICON_BUTTON_TARGET, IconButton } from '../ui/IconButton'
import { PressableScale } from '../ui/PressableScale'

/** See `ChatComposer`: a Mac reports itself as a desktop, and that never changes. */
const IS_DESKTOP = Device.deviceType === Device.DeviceType.DESKTOP

/** The mic, the send and the field's resting height: the drawing's 56. */
const BIG = 56
/** How tall the field grows before its text scrolls: about four lines. */
const FIELD_MAX = 140

/**
 * What Correct, Translate and Echo do to the other person's newest message
 * (`latestToActOn`). Each is absent when it does not apply — Translate once
 * the translation is showing, Echo once the sentence is kept.
 */
export interface LatestActions {
  correct: () => void
  translate?: (() => void) | undefined
  translating: boolean
  echo?: (() => void) | undefined
}

/**
 * Everything that needs a conversation to exist: the tray, the mic, the
 * banner and the actions on their newest message. Absent on the screen that
 * starts one (`chat/new`), which draws the field and the send alone — the
 * thread has the rest the moment the first send creates it.
 */
interface ConversationParts {
  /** A picked file or a voice draft is waiting, so the send is live with an empty field. */
  hasAttachment: boolean
  /** The reply / edit / correct banner, as the thread works it out. */
  mode: { label: string; preview: string; clear: () => void } | null
  /** The picked files, above the field they will be sent with. */
  attachments: ReactNode
  /** A voice note being recorded, or null. The field gives way to its clock while it runs. */
  recording: { seconds: number; cancel: () => void } | null
  onMic: () => void
  conversationId: string
  onCamera: () => void
  cameraDisabled: boolean
  /** The full sheet: every way to attach or ask that the tray has no room for. */
  onAttach: () => void
  attachDisabled: boolean
  /** A location fix in flight; the sheet's control turns into a spinner, as the "+" does today. */
  locating: boolean
  /** Null when the other person's newest message is nothing these can act on. */
  latest: LatestActions | null
}

type ComposerV3Props = ComposerV3Common &
  (ConversationParts | { [K in keyof ConversationParts]?: never })

interface ComposerV3Common {
  value: string
  onChangeText: (text: string) => void
  placeholder: string
  onSend: () => void
  /** "Send later". Absent while the composer holds anything that cannot be scheduled. */
  onSendLongPress?: () => void
  /** Media on its way up; the next send waits for it. */
  busy: boolean
  /** As `ChatComposer`'s: set when the thread has nothing to answer, and the seed to shuffle from. */
  topicSeed?: string | undefined
  topicInterests?: readonly string[] | undefined
  partnerName: string
  /**
   * A soft keyboard is up (`useKeyboardUp`). The chips give their row back to
   * the thread: on a small phone the band, the tray, the chips and the field
   * left only a sliver of the conversation above the keyboard. Correct is
   * still in the message's own menu, and the chips return with the keyboard.
   */
  compact?: boolean
  /** The field took or lost focus — what tells a phone browser the keyboard is up. */
  onFocusChange?: (focused: boolean) => void
  /** The field takes the keyboard on mount — the screen that starts a conversation. */
  autoFocus?: boolean
  /**
   * Copilot's button beside send and the menu it opens. Absent, the composer
   * draws exactly what it drew before Copilot: the thread passes it only on
   * the v3 path, and only the handlers for the questions this draft can be
   * asked (`copilotOffers`).
   */
  copilot?: ComposerCopilot | undefined
}

export interface ComposerCopilot {
  gate: CopilotGate
  /** The language Say it answers in, in the reader's app language. */
  targetLanguageName?: string | undefined
  onCheck?: (() => void) | undefined
  onSayIt?: (() => void) | undefined
  /** An answer is on its way: the button waits for it. */
  loading: boolean
}

/**
 * The v3 thread's composer: the tray, the actions on their newest message
 * with Correct as the hero, and a row that is the field, a big mic and a
 * big send.
 *
 * Its own component rather than a look for `ChatComposer`, which the screen
 * that starts a conversation shares and which keeps the current look until
 * that screen moves. The field's behaviour is `ChatComposer`'s, line for line
 * — the return key's two platforms, the emoticon chips, the starters and the
 * iOS height reset — because each of those fixed something people hit, and
 * the comments that say what are kept there rather than copied here.
 *
 * Sits where `ChatComposer` sits, inside the view the thread pads for the
 * keyboard (`useKeyboardInset` on iOS, `KeyboardResizeHost` on Android) and
 * above the home-indicator inset `Screen` pays — so it adds no inset of its
 * own, and the keyboard never covers it.
 */
export function ComposerV3({
  value,
  onChangeText,
  placeholder,
  onSend,
  onSendLongPress,
  hasAttachment = false,
  busy,
  mode = null,
  attachments,
  topicSeed,
  topicInterests,
  recording = null,
  onMic,
  conversationId,
  onCamera,
  cameraDisabled = false,
  onAttach,
  attachDisabled = false,
  locating = false,
  latest = null,
  partnerName,
  compact = false,
  onFocusChange,
  autoFocus = false,
  copilot,
}: ComposerV3Props) {
  const styles = useStyles()
  const { v3 } = useTheme()
  const t = useT()
  // Correct's label is Nunito Black, which the root does not load yet.
  useFonts({ Nunito_900Black })
  const input = useRef<TextInput>(null)
  const [selection, setSelection] = useState<{ start: number; end: number } | null>(null)
  const [topicRound, setTopicRound] = useState(0)
  /*
   * The text's height on the web, where a textarea does not grow with what is
   * typed the way the native field does. react-native-web reports it; the box
   * follows up to the native field's ceiling, and goes back to one row the
   * moment the field empties — a send, or the last letter deleted.
   */
  const [webHeight, setWebHeight] = useState<number | null>(null)
  const canSend = value.trim().length > 0 || hasAttachment
  const cursor = Math.min(selection?.end ?? value.length, value.length)
  const emoticon = selection && selection.start !== selection.end ? null : emoticonAt(value, cursor)
  const topics =
    topicSeed !== undefined && value === ''
      ? pickStarters(topicSeed, topicRound, undefined, topicInterests)
      : []
  /*
   * Only while there is nothing else on the go. Correct writes their sentence
   * into the field, so offering it over a half-typed reply would offer to
   * throw that reply away; and a banner or a picked file already says what
   * the next send is. The starters win when both are due: a thread that has
   * gone quiet is asking for a new topic, not a correction of a stale line.
   */
  const showLatest =
    !compact &&
    latest !== null &&
    value === '' &&
    mode === null &&
    !hasAttachment &&
    recording === null &&
    topics.length === 0
  // The mic records only from an empty composer, as it always has: a note
  // travels alone, so text or a picked file has to go first.
  const micLive = !busy && (recording !== null || !canSend)
  // Beside a typed draft the mic could not record anyway; its slot is the field's.
  const showMic = composerShowsMic({ value, recording: recording !== null })
  const sendLive = canSend && !busy
  /*
   * Only for a typed draft, and only when this person has Copilot at all — an
   * account off the allow-list or on a deployment with no key sees
   * no trace of it. The menu folds when the draft empties, and when a row is
   * picked.
   */
  const [copilotMenu, setCopilotMenu] = useState(false)
  const showCopilot =
    copilot !== undefined &&
    copilot.gate !== 'off' &&
    recording === null &&
    value.trim().length > 0 &&
    (copilot.onCheck !== undefined || copilot.onSayIt !== undefined)
  const copilotCheck = copilot?.onCheck
  const copilotSayIt = copilot?.onSayIt
  const pickCopilot = (run: () => void) => {
    setCopilotMenu(false)
    run()
  }
  useEffect(() => {
    if (!showCopilot) setCopilotMenu(false)
  }, [showCopilot])

  const pickEmoji = (emoji: string) => {
    if (!emoticon) return
    const next = applyEmoticon(value, emoticon, emoji)
    setSelection({ start: next.cursor, end: next.cursor })
    onChangeText(next.text)
    input.current?.focus()
  }

  const pickTopic = (text: string) => {
    setSelection({ start: text.length, end: text.length })
    onChangeText(text)
    input.current?.focus()
  }

  /*
   * The tray is the attach sheet's hint, as the drawing puts it: the camera
   * first (the way into a view-once photo, which must not sit two taps down),
   * then the sheet itself, then the rows of the sheet and the ⋯ menu people
   * reach for most. Each keeps its long name for a screen reader; the word
   * under the glyph is the short one.
   */
  const tray: TrayItem[] =
    conversationId === undefined || !onCamera || !onAttach
      ? []
      : [
          {
            key: 'camera',
            icon: 'camera',
            label: t('composer.trayCamera'),
            accessibilityLabel: t('composer.attachCamera'),
            onPress: onCamera,
            disabled: cameraDisabled,
          },
          {
            key: 'attach',
            icon: 'plus',
            label: t('composer.attachMenu'),
            accessibilityLabel: t('composer.attachMenu'),
            onPress: onAttach,
            disabled: attachDisabled,
            busy: locating,
          },
          {
            key: 'time',
            icon: 'calendar',
            label: t('composer.trayTime'),
            accessibilityLabel: t('chat.sendMeeting'),
            onPress: () =>
              router.push({ pathname: '/(app)/propose-time', params: { id: conversationId } }),
          },
          {
            key: 'quiz',
            icon: 'help-circle',
            label: t('composer.trayQuiz'),
            accessibilityLabel: t('chat.sendQuiz'),
            onPress: () => router.push({ pathname: '/(app)/quiz', params: { id: conversationId } }),
          },
          {
            key: 'stickers',
            icon: 'smile',
            label: t('chat.stickers'),
            accessibilityLabel: t('chat.stickers'),
            onPress: () =>
              router.push({ pathname: '/(app)/stickers', params: { id: conversationId } }),
          },
          {
            key: 'phrases',
            icon: 'bookmark',
            label: t('composer.trayPhrases'),
            accessibilityLabel: t('chat.phraseDeck'),
            onPress: () =>
              router.push({ pathname: '/(app)/phrases', params: { id: conversationId } }),
          },
          {
            key: 'starred',
            icon: 'star',
            label: t('composer.trayStarred'),
            accessibilityLabel: t('chats.starredMessages'),
            onPress: () => router.push('/(app)/starred'),
          },
        ]
  const latestHint = t('composer.onLatest', { name: partnerName })

  return (
    <View style={styles.composer}>
      {/*
        One scrolling line rather than a fixed grid: seven short words fit a
        phone in English, and a language whose words run longer scrolls
        rather than cutting them off.
      */}
      {tray.length > 0 ? (
        <ScrollView
          horizontal
          showsHorizontalScrollIndicator={false}
          keyboardShouldPersistTaps="handled"
          contentContainerStyle={styles.tray}
        >
          {tray.map((item) => (
            <PressableScale
              key={item.key}
              accessibilityRole="button"
              accessibilityLabel={item.accessibilityLabel}
              accessibilityState={{ disabled: item.disabled === true, busy: item.busy === true }}
              onPress={item.onPress}
              disabled={item.disabled === true || item.busy === true}
              style={[styles.trayItem, item.disabled && styles.disabled]}
            >
              <View style={styles.trayDisc}>
                {item.busy ? (
                  <ActivityIndicator size="small" color={v3.colors.muted} />
                ) : (
                  <Feather name={item.icon} size={v3.icon.md} color={v3.colors.fg} />
                )}
              </View>
              <Text style={styles.trayLabel} numberOfLines={1}>
                {item.label}
              </Text>
            </PressableScale>
          ))}
        </ScrollView>
      ) : null}

      {showLatest && latest ? (
        <View style={styles.chips}>
          {/* The hero: outlined in the text colour, where the other two are grey. */}
          <Chip
            hero
            icon="edit-2"
            label={t('messageActions.correct')}
            hint={latestHint}
            onPress={latest.correct}
          />
          {latest.translate ? (
            <Chip
              icon="globe"
              label={t('messageActions.translate')}
              hint={latestHint}
              onPress={latest.translate}
              busy={latest.translating}
            />
          ) : null}
          {latest.echo ? (
            <Chip
              icon="plus"
              label={t('tabs.echo')}
              accessibilityLabel={t('messageActions.echo')}
              hint={latestHint}
              onPress={latest.echo}
            />
          ) : null}
        </View>
      ) : null}

      {topics.length > 0 ? (
        <View style={styles.topicRow}>
          <IconButton
            icon="shuffle"
            look="surface"
            iconSize={v3.icon.sm}
            accessibilityLabel={t('chat.topicsShuffle')}
            onPress={() => setTopicRound((round) => round + 1)}
          />
          <ScrollView
            horizontal
            showsHorizontalScrollIndicator={false}
            keyboardShouldPersistTaps="handled"
            style={styles.grow}
            contentContainerStyle={styles.chipList}
          >
            {topics.map((topic) => {
              const text = t(`chat.topics.${topic}`)
              return (
                <PressableScale
                  key={topic}
                  accessibilityRole="button"
                  accessibilityLabel={t('chat.topicChip', { topic: text })}
                  onPress={() => pickTopic(text)}
                  style={styles.softChip}
                >
                  <Text style={styles.softChipText} numberOfLines={1}>
                    {text}
                  </Text>
                </PressableScale>
              )
            })}
          </ScrollView>
        </View>
      ) : null}

      {mode ? (
        <ModeBanner style={styles.mode}>
          <View style={styles.grow}>
            <Text style={styles.modeLabel} numberOfLines={1}>
              {mode.label}
            </Text>
            <Text style={styles.modePreview} numberOfLines={1}>
              {mode.preview}
            </Text>
          </View>
          <IconButton
            icon="x"
            iconSize={v3.icon.md}
            color={v3.colors.muted}
            accessibilityLabel={t('common.cancel')}
            onPress={mode.clear}
          />
        </ModeBanner>
      ) : null}

      {attachments}

      {showCopilot && copilotMenu && !copilot.loading ? (
        <CopilotMenu
          {...(copilotCheck ? { onCheck: () => pickCopilot(copilotCheck) } : {})}
          {...(copilotSayIt ? { onSayIt: () => pickCopilot(copilotSayIt) } : {})}
          targetLanguageName={copilot.targetLanguageName}
        />
      ) : null}

      {emoticon ? (
        <View style={styles.emojiRow}>
          {emoticon.suggestions.map((item) => (
            <PressableScale
              key={item.name ?? item.emoji}
              accessibilityRole="button"
              accessibilityLabel={t('composer.emojiSuggestion', { emoji: item.emoji })}
              onPress={() => pickEmoji(item.emoji)}
              style={styles.softChip}
            >
              <Text style={styles.emoji}>{item.emoji}</Text>
              {item.name ? <Text style={styles.emojiName}>:{item.name}:</Text> : null}
            </PressableScale>
          ))}
        </View>
      ) : null}

      <View style={styles.row}>
        {recording ? (
          <View style={styles.recording}>
            <RecordingDot style={styles.recordingDot} />
            <Text style={styles.recordingTime}>
              {Math.floor(recording.seconds / 60)}:{String(recording.seconds % 60).padStart(2, '0')}
            </Text>
            <Pressable
              accessibilityRole="button"
              onPress={recording.cancel}
              hitSlop={12}
              style={styles.recordingCancel}
            >
              <Text style={styles.recordingCancelText}>{t('common.cancel')}</Text>
            </Pressable>
          </View>
        ) : (
          <TextInput
            ref={input}
            value={value}
            onChangeText={onChangeText}
            onSelectionChange={(event) => setSelection(event.nativeEvent.selection)}
            {...(onFocusChange
              ? { onFocus: () => onFocusChange(true), onBlur: () => onFocusChange(false) }
              : {})}
            placeholder={placeholder}
            placeholderTextColor={v3.colors.muted}
            autoFocus={autoFocus}
            style={[
              styles.field,
              value === '' && Platform.OS === 'ios' && styles.fieldEmpty,
              Platform.OS === 'web' && value !== '' && webHeight !== null
                ? { height: Math.min(Math.max(webHeight, BIG), FIELD_MAX) }
                : null,
            ]}
            multiline
            {...(Platform.OS === 'web'
              ? {
                  // One row, so the box rests at the mic's height: a textarea
                  // with no `rows` is two, and react-native-web sets none.
                  rows: 1,
                  onContentSizeChange: (event: {
                    nativeEvent: { contentSize: { height: number } }
                  }) => setWebHeight(event.nativeEvent.contentSize.height),
                  onKeyPress: (event: NativeSyntheticEvent<TextInputKeyPressEventData>) => {
                    const { key, shiftKey } = event.nativeEvent as TextInputKeyPressEventData & {
                      shiftKey?: boolean
                    }
                    if (!shouldSubmitOnEnter(key, shiftKey === true)) return
                    event.preventDefault()
                    onSend()
                  },
                }
              : enterSendsOnNative(Platform.OS, IS_DESKTOP)
                ? { submitBehavior: 'submit' as const, onSubmitEditing: onSend }
                : {})}
          />
        )}
        {/*
          Only one live at a time: the mic while there is nothing to send, the
          send once there is. The send never moves, so the thumb learns one
          place for it; the mic steps aside for a typed draft and the field
          takes its slot (`composerShowsMic`).
        */}
        {onMic && showMic ? (
          <PressableScale
            accessibilityRole="button"
            accessibilityLabel={t('chat.voiceMessage')}
            accessibilityState={{ disabled: !micLive }}
            onPress={onMic}
            disabled={!micLive}
            style={[styles.big, styles.mic, !micLive && styles.disabled]}
          >
            <Feather
              name={recording ? 'square' : 'mic'}
              size={v3.icon.xxl}
              color={v3.colors.pillText}
            />
          </PressableScale>
        ) : null}
        {showCopilot ? (
          <View style={styles.copilot}>
            <CopilotButton
              loading={copilot.loading}
              onPress={() => setCopilotMenu((open) => !open)}
            />
          </View>
        ) : null}
        <PressableScale
          accessibilityRole="button"
          accessibilityLabel={t('common.send')}
          accessibilityState={{ disabled: !sendLive, busy }}
          onPress={onSend}
          {...(onSendLongPress ? { onLongPress: onSendLongPress } : {})}
          disabled={!sendLive}
          // Grey until there is something to send: a faded yellow reads as a
          // stain in the dark scheme, and the yellow is the committing action's.
          style={[styles.big, canSend ? styles.send : styles.sendIdle, busy && styles.disabled]}
        >
          <Feather
            name={busy ? 'more-horizontal' : 'arrow-up'}
            size={v3.icon.xxl}
            color={canSend ? v3.colors.onYellow : v3.colors.muted}
          />
        </PressableScale>
      </View>
    </View>
  )
}

interface TrayItem {
  key: string
  icon: keyof typeof Feather.glyphMap
  label: string
  accessibilityLabel: string
  onPress: () => void
  disabled?: boolean
  busy?: boolean
}

/** A pill over the field. `hero` is Correct's: outlined, where the rest are grey. */
function Chip({
  icon,
  label,
  accessibilityLabel,
  hint,
  onPress,
  hero = false,
  busy = false,
}: {
  icon: keyof typeof Feather.glyphMap
  label: string
  accessibilityLabel?: string
  hint: string
  onPress: () => void
  hero?: boolean
  busy?: boolean
}) {
  const styles = useStyles()
  const { v3 } = useTheme()
  return (
    <PressableScale
      accessibilityRole="button"
      accessibilityLabel={accessibilityLabel ?? label}
      accessibilityHint={hint}
      accessibilityState={{ busy }}
      onPress={onPress}
      disabled={busy}
      style={[styles.chip, hero ? styles.chipHero : styles.chipSoft]}
    >
      {busy ? (
        <ActivityIndicator size="small" color={v3.colors.fg} />
      ) : (
        <Feather name={icon} size={v3.icon.sm} color={v3.colors.fg} />
      )}
      <Text style={hero ? styles.chipLabelHero : styles.chipLabel} numberOfLines={1}>
        {label}
      </Text>
    </PressableScale>
  )
}

/** How far the reply banner rises as it arrives, in points. */
const BANNER_RISE = 6
/** The banner's arrival: quick, because the swipe or the tap that asked for it already landed. */
const BANNER_IN = { duration: 180, easing: EASE_OUT }

/**
 * The reply / edit / correct banner, rising a few points into place as it
 * appears, so the thing the swipe asked for is seen arriving rather than
 * cut in. Once, on mount: switching from a reply to an edit is the same
 * banner changing its words. Simply there under reduced motion.
 */
function ModeBanner({ style, children }: { style: StyleProp<ViewStyle>; children: ReactNode }) {
  const reduce = useReduceMotion()
  const shown = useSharedValue(0)
  useEffect(() => {
    shown.set(unlessReduced(reduce, 1, (to) => withTiming(to, BANNER_IN)))
    // `reduce` can arrive after the first render; a banner already in place
    // then has nothing to replay.
  }, [reduce, shown])
  const motion = useAnimatedStyle(() => ({
    opacity: shown.get(),
    transform: [{ translateY: (1 - shown.get()) * BANNER_RISE }],
  }))
  return <Animated.View style={[style, motion]}>{children}</Animated.View>
}

/** A breath, not a blink: symmetric, so the dim and the return read as one motion. */
const EASE_IN_OUT = Easing.inOut(Easing.sin)

/** Each half of the recording light's swell: dim, then lit again. */
const RECORDING_PULSE_MS = 600
/** How far the light dims at the bottom of a pulse. */
const RECORDING_DIM = 0.35

/**
 * The recording light, breathing while the microphone is live — the sign
 * every recorder gives that it is still listening. Steady under reduced
 * motion: a red dot beside a running clock already says so.
 */
function RecordingDot({ style }: { style: StyleProp<ViewStyle> }) {
  const reduce = useReduceMotion()
  const lit = useSharedValue(1)
  useEffect(() => {
    lit.set(
      unlessReduced(reduce, 1, () =>
        withRepeat(
          withTiming(RECORDING_DIM, { duration: RECORDING_PULSE_MS, easing: EASE_IN_OUT }),
          -1,
          true,
        ),
      ),
    )
    return () => cancelAnimation(lit)
  }, [reduce, lit])
  const motion = useAnimatedStyle(() => ({ opacity: lit.get() }))
  return <Animated.View style={[style, motion]} />
}

const useStyles = makeStyles(({ v3 }) => ({
  composer: {
    backgroundColor: v3.colors.bg,
    borderTopColor: v3.colors.line,
    borderTopWidth: 1,
    gap: v3.space[8],
    paddingBottom: v3.space[10],
    paddingHorizontal: v3.space[12],
    paddingTop: v3.space[6],
  },
  grow: { flex: 1, minWidth: 0 },
  disabled: { opacity: 0.4 },
  tray: { flexGrow: 1, gap: v3.space[2], justifyContent: 'space-between' },
  trayItem: {
    alignItems: 'center',
    gap: v3.space[2],
    minHeight: 52,
    minWidth: ICON_BUTTON_TARGET,
    paddingHorizontal: v3.space[2],
  },
  trayDisc: {
    alignItems: 'center',
    backgroundColor: v3.colors.surface,
    borderRadius: v3.radius.pill,
    height: 36,
    justifyContent: 'center',
    width: 36,
  },
  trayLabel: { ...v3.type.label, color: v3.colors.fg },
  chips: { flexDirection: 'row', flexWrap: 'wrap', gap: v3.space[8] },
  chip: {
    alignItems: 'center',
    borderRadius: v3.radius.pill,
    borderWidth: 2,
    flexDirection: 'row',
    gap: v3.space[6],
    minHeight: ICON_BUTTON_TARGET,
    paddingHorizontal: v3.space[16],
  },
  chipHero: { backgroundColor: 'transparent', borderColor: v3.colors.fg },
  // The same border, clear, so the hero and the rest are one height.
  chipSoft: { backgroundColor: v3.colors.surface, borderColor: 'transparent' },
  chipLabelHero: {
    ...v3.type.buttonSmall,
    color: v3.colors.fg,
    fontFamily: v3.type.title.fontFamily,
  },
  chipLabel: { ...v3.type.buttonSmall, color: v3.colors.fg },
  topicRow: { alignItems: 'center', flexDirection: 'row', gap: v3.space[8] },
  chipList: { gap: v3.space[8] },
  softChip: {
    alignItems: 'center',
    backgroundColor: v3.colors.surface,
    borderRadius: v3.radius.pill,
    flexDirection: 'row',
    gap: v3.space[6],
    justifyContent: 'center',
    minHeight: ICON_BUTTON_TARGET,
    paddingHorizontal: v3.space[14],
  },
  softChipText: { ...v3.type.caption, color: v3.colors.fg },
  emojiRow: { flexDirection: 'row', flexWrap: 'wrap', gap: v3.space[8] },
  emoji: v3.type.headline,
  emojiName: { ...v3.type.caption, color: v3.colors.muted },
  mode: {
    alignItems: 'center',
    backgroundColor: v3.colors.surface,
    borderRadius: v3.radius.row,
    flexDirection: 'row',
    gap: v3.space[8],
    paddingStart: v3.space[16],
    paddingVertical: v3.space[4],
  },
  modeLabel: { ...v3.type.label, color: v3.colors.echoText },
  modePreview: { ...v3.type.caption, color: v3.colors.muted },
  row: { alignItems: 'flex-end', flexDirection: 'row', gap: v3.space[8] },
  field: {
    ...v3.type.body,
    backgroundColor: v3.colors.surface,
    borderRadius: v3.radius.block,
    color: v3.colors.fg,
    flex: 1,
    maxHeight: FIELD_MAX,
    minHeight: BIG,
    // A textarea's intrinsic width is its `cols`; without this a flex item on
    // the web cannot shrink below it.
    minWidth: 0,
    paddingHorizontal: v3.space[20],
    paddingVertical: v3.space[16],
  },
  // `ChatComposer`'s `inputEmpty`, at this field's height.
  fieldEmpty: { height: BIG },
  // The field's box, holding the clock instead of the text while a note records.
  recording: {
    alignItems: 'center',
    backgroundColor: v3.colors.surface,
    borderRadius: v3.radius.block,
    flex: 1,
    flexDirection: 'row',
    gap: v3.space[10],
    minHeight: BIG,
    paddingHorizontal: v3.space[20],
  },
  recordingDot: {
    backgroundColor: v3.colors.danger,
    borderRadius: v3.radius.pill,
    height: 10,
    width: 10,
  },
  recordingTime: { ...v3.type.body, color: v3.colors.fg, flex: 1, fontVariant: ['tabular-nums'] },
  recordingCancel: { justifyContent: 'center', minHeight: ICON_BUTTON_TARGET },
  recordingCancelText: { ...v3.type.buttonSmall, color: v3.colors.muted },
  big: {
    alignItems: 'center',
    borderRadius: v3.radius.pill,
    height: BIG,
    justifyContent: 'center',
    width: BIG,
  },
  // Centred on the 56 the mic and the send stand at, where the row aligns to its foot.
  copilot: { height: BIG, justifyContent: 'center' },
  // Ink, not yellow: the yellow is the send's, once a screen.
  mic: { backgroundColor: v3.colors.pill },
  send: { backgroundColor: v3.colors.yellow },
  sendIdle: { backgroundColor: v3.colors.surface },
}))

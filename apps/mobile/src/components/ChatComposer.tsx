import Feather from '@expo/vector-icons/Feather'
import { TOKEN_RULES, applyEmoticon, emoticonAt } from '@langx/shared'
import * as Device from 'expo-device'
import { useRef, useState, type ReactNode } from 'react'
import {
  Platform,
  Pressable,
  Text,
  TextInput,
  View,
  type NativeSyntheticEvent,
  type TextInputKeyPressEventData,
} from 'react-native'
import { useT } from '../i18n'
import { enterSendsOnNative, shouldSubmitOnEnter } from '../lib/submitOnEnter'
import { makeStyles, useTheme } from '../lib/theme'
import { ComposerHint } from './ComposerHint'

/**
 * A Mac, either as a Catalyst app or as the iPad binary running on Apple
 * Silicon — `expo-device` reports both as `DESKTOP`, which is the only signal
 * that tells one of those apart from a real iPad. Read once: it cannot change
 * while the app is running.
 */
const IS_DESKTOP = Device.deviceType === Device.DeviceType.DESKTOP

interface ChatComposerProps {
  value: string
  onChangeText: (text: string) => void
  placeholder: string
  onSend: () => void
  /**
   * Something other than the text is ready to go — a picked photo — so the
   * send button stays up with an empty field.
   */
  hasAttachment?: boolean
  /**
   * A send the next one has to wait for: media uploading, or the conversation
   * itself being created. Text sends never set this; they go optimistically.
   */
  busy?: boolean
  autoFocus?: boolean
  /** Left of the field — the attach control, or the recording readout in its place. */
  leading?: ReactNode
  /** Right of the field when there is nothing to send — the microphone. Nothing when omitted. */
  idleAction?: ReactNode
  /** Above the row, under the hairline — the mode banner and the picked attachments. */
  above?: ReactNode
}

/**
 * The block under the hairline at the foot of a thread: whatever sits above
 * the row, the row itself — leading control, fill-pill field, yellow send —
 * and the two-part hint under it.
 *
 * Shared by the thread and by the screen that starts one, so "Send a message"
 * on a profile lands on the same composer the conversation will have. Only
 * the field and the send button live here; the attach, record and microphone
 * controls need a conversation and are passed in by the thread.
 */
export function ChatComposer({
  value,
  onChangeText,
  placeholder,
  onSend,
  hasAttachment = false,
  busy = false,
  autoFocus = false,
  leading,
  idleAction,
  above,
}: ChatComposerProps) {
  const styles = useStyles()
  const { colors } = useTheme()
  const t = useT()
  const [focused, setFocused] = useState(false)
  const input = useRef<TextInput>(null)
  /**
   * The caret, from `onSelectionChange`. Null until the field reports one, and
   * then the end of the text is the best guess. Clamped because the caller can
   * replace the text (a send clears it) before the field reports the move.
   */
  const [selection, setSelection] = useState<{ start: number; end: number } | null>(null)
  const canSend = value.trim().length > 0 || hasAttachment
  const cursor = Math.min(selection?.end ?? value.length, value.length)
  /*
   * Suggested, never swapped in as you type: a learner quoting `:P` from a
   * textbook, or somebody who meant `xD` as written, would otherwise have to
   * fight the box to keep their own text. Typing on past the shortcut, or a
   * space, makes the chip go away and leaves the text exactly as it was.
   */
  const emoticon = selection && selection.start !== selection.end ? null : emoticonAt(value, cursor)

  const pickEmoji = (emoji: string) => {
    if (!emoticon) return
    const next = applyEmoticon(value, emoticon, emoji)
    setSelection({ start: next.cursor, end: next.cursor })
    onChangeText(next.text)
    // A tap on the web moves focus to the chip; give it back so the next
    // letter lands in the message.
    input.current?.focus()
  }

  return (
    <View style={styles.composer}>
      {above}
      {/* Straight above the field it edits, and only while there is a
        shortcut under the caret — so it never sits beside the reply banner or
        the attachments for longer than one word. */}
      {emoticon ? (
        <View style={styles.emojiRow}>
          {emoticon.suggestions.map((item) => (
            <Pressable
              key={item.name ?? item.emoji}
              accessibilityRole="button"
              accessibilityLabel={t('composer.emojiSuggestion', { emoji: item.emoji })}
              onPress={() => pickEmoji(item.emoji)}
              style={({ pressed }) => [styles.emojiChip, pressed && styles.emojiChipPressed]}
            >
              <Text style={styles.emoji}>{item.emoji}</Text>
              {item.name ? <Text style={styles.emojiName}>:{item.name}:</Text> : null}
            </Pressable>
          ))}
        </View>
      ) : null}
      <View style={styles.row}>
        {leading}
        <TextInput
          ref={input}
          value={value}
          onChangeText={onChangeText}
          onSelectionChange={(event) => setSelection(event.nativeEvent.selection)}
          placeholder={placeholder}
          placeholderTextColor={colors.textFaint}
          style={[styles.input, focused && styles.inputFocused]}
          onFocus={() => setFocused(true)}
          onBlur={() => setFocused(false)}
          autoFocus={autoFocus}
          multiline
          /**
           * Two ways to send with the return key, because the two platforms
           * offer different handles on it.
           *
           * On the web it has to be a key handler: `multiline` is a
           * `<textarea>` in the browser, where `onSubmitEditing` never fires.
           *
           * On a native desktop it has to be `submitBehavior`, because that is
           * the only thing that stops the newline — a key handler cannot, there
           * being nothing to `preventDefault` on. `'submit'` rather than
           * `'blurAndSubmit'` keeps the field focused for the next sentence.
           *
           * On a phone or a tablet neither is set and the return key inserts a
           * newline, which is what people expect with a keyboard on the glass.
           */
          {...(Platform.OS === 'web'
            ? {
                onKeyPress: (event: NativeSyntheticEvent<TextInputKeyPressEventData>) => {
                  const { key, shiftKey } = event.nativeEvent as TextInputKeyPressEventData & {
                    shiftKey?: boolean
                  }
                  if (!shouldSubmitOnEnter(key, shiftKey === true)) return
                  // Otherwise the newline lands in the box behind the send.
                  event.preventDefault()
                  onSend()
                },
              }
            : enterSendsOnNative(Platform.OS, IS_DESKTOP)
              ? { submitBehavior: 'submit' as const, onSubmitEditing: onSend }
              : {})}
        />
        {/* The send button appears only when there is something to send; the
          resting state to its right (a microphone, in a thread) is the
          caller's. An attachment with no caption is something to send. */}
        {canSend ? (
          <View style={[styles.sendShell, busy && styles.sendDisabled]}>
            <Pressable
              accessibilityRole="button"
              accessibilityLabel={t('common.send')}
              onPress={onSend}
              disabled={busy}
              style={({ pressed }) => [styles.send, pressed && !busy && styles.sendPressed]}
            >
              <Feather
                name={busy ? 'more-horizontal' : 'send'}
                size={20}
                color={colors.primaryText}
              />
            </Pressable>
          </View>
        ) : (
          idleAction
        )}
      </View>
      {/*
        The two facts a first-time user cannot discover: that a long press
        corrects, and that a message pays. Both come from `TOKEN_RULES`
        rather than being written into the copy.
      */}
      <View style={styles.hint}>
        <ComposerHint style={styles.hintLeft} />
        <Text style={styles.hintRight}>
          {t('chat.tokensPerMessage', { count: TOKEN_RULES.award.message })}
        </Text>
      </View>
    </View>
  )
}

const useStyles = makeStyles(({ colors, font, spacing, radius }) => ({
  /**
   * Everything under the hairline: banner, attachments, the row, the hint.
   * The bottom is `spacing.md` on top of the safe-area inset `Screen` already
   * adds — the prototype's 28 is that inset, drawn in a frame that has none.
   */
  composer: {
    backgroundColor: colors.surface,
    borderTopColor: colors.border,
    borderTopWidth: 1,
    gap: 10,
    paddingBottom: spacing.md,
    paddingHorizontal: spacing.lg,
    paddingTop: 10,
  },
  row: { alignItems: 'flex-end', flexDirection: 'row', gap: spacing.sm },
  emojiRow: { flexDirection: 'row', flexWrap: 'wrap', gap: spacing.sm },
  emojiChip: {
    alignItems: 'center',
    backgroundColor: colors.fill,
    borderRadius: radius.pill,
    flexDirection: 'row',
    gap: 6,
    paddingHorizontal: 12,
    paddingVertical: 4,
  },
  emojiChipPressed: { opacity: 0.6 },
  emoji: { fontSize: 22, lineHeight: 28 },
  emojiName: { ...font.caption, color: colors.textMuted },
  hint: { alignItems: 'center', flexDirection: 'row', justifyContent: 'space-between' },
  hintLeft: { ...font.caption, color: colors.textFaint },
  // The green pair marks earning, same as "Earned" rows elsewhere.
  hintRight: { ...font.caption, color: colors.success, fontWeight: '600' },
  /**
   * A fill pill — v3's one grey allowed to be a shape. The border is there
   * only to say something: transparent at rest, accent while focused, so the
   * box does not grow by a pixel when it takes focus.
   */
  input: {
    ...font.body,
    backgroundColor: colors.fill,
    borderColor: 'transparent',
    borderRadius: radius.xl,
    borderWidth: 1,
    color: colors.text,
    flex: 1,
    fontSize: 16,
    lineHeight: 22,
    maxHeight: 120,
    minHeight: 48,
    paddingHorizontal: 18,
    paddingVertical: 13,
  },
  inputFocused: { backgroundColor: colors.bg, borderColor: colors.accent },
  /**
   * The one yellow on the screen, standing on the same hard shadow `ui/Button`
   * does: a shell in the shade, a face on it that drops on press. The negative
   * margin lets the shade hang below the row the way `box-shadow` does, so it
   * is the face — not the shade — that lines up with the input's bottom.
   */
  sendShell: {
    backgroundColor: colors.primaryShade,
    borderRadius: 14,
    marginBottom: -3,
    paddingBottom: 3,
  },
  send: {
    alignItems: 'center',
    backgroundColor: colors.primary,
    borderRadius: 14,
    height: 48,
    justifyContent: 'center',
    width: 48,
  },
  sendPressed: { transform: [{ translateY: 3 }] },
  sendDisabled: { opacity: 0.35 },
}))

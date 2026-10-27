import type { CopilotResult, CopilotStatus } from '@langx/shared'
import { router } from 'expo-router'
import { useMemo } from 'react'
import { Pressable, Text, View } from 'react-native'
import { useLocale, useT } from '../../i18n'
import type { CopilotErrorKey } from '../../lib/copilotErrors'
import { diffCorrection } from '../../lib/correctionDiff'
import { makeStyles, useTheme } from '../../lib/theme'
import { CopilotLabel } from '../CopilotLabel'
import { Button } from '../ui/Button'
import { IconButton } from '../ui/IconButton'
import { PressableScale } from '../ui/PressableScale'
import { Skeleton } from '../ui/Skeleton'
import { CopilotAllowance, copilotTime } from './CopilotAllowance'
import { CopilotReportButton } from './CopilotReport'

/** A line the card can show for a refusal: everything but the two that are steps. */
export type CopilotErrorLine = Exclude<CopilotErrorKey, 'off' | 'consent'>

/**
 * What one Copilot question has come to, for the card above the composer and
 * the Explain sheet alike. `asked` is the text the answer is about — the
 * draft as it was when the question went, so the changed words are marked
 * against what was checked rather than against whatever is typed since.
 */
export type CopilotAnswerState =
  | { kind: 'loading' }
  | { kind: 'answer'; result: CopilotResult; asked: string }
  | { kind: 'error'; key: CopilotErrorLine; retryAt?: string | undefined }

/**
 * Copilot's answer to Check or Say it: a blue card above the composer, never
 * in the message list — it is a note to the person writing, not something
 * anybody said, and drawing it among the messages would make the machine look
 * like a third person in the chat.
 *
 * Nothing on it sends. "Use this" and an option both only replace the draft;
 * the person still reads it and presses send themselves. The two answers to
 * Check are the same size: taking the machine's word must not be easier than
 * keeping your own.
 *
 * Its foot carries the allowance and a quiet "What is this?" to the Copilot
 * page: one line of link-coloured words, for whoever meets the card before
 * they have met Copilot, and no louder than the allowance beside it.
 */
export function CopilotCard({
  state,
  quota,
  onUse,
  onClose,
  onReport,
}: {
  state: CopilotAnswerState
  quota: CopilotStatus['quota'] | undefined
  /** Replaces the draft. Never sends. */
  onUse: (text: string) => void
  onClose: () => void
  /** Opens the confirm sheet for this answer. Offered only once there is an answer. */
  onReport?: (() => void) | undefined
}) {
  const styles = useStyles()
  const t = useT()
  const { v3 } = useTheme()

  return (
    <View style={styles.card} accessibilityLiveRegion="polite">
      <View style={styles.header}>
        <CopilotLabel />
        <View style={styles.grow} />
        {state.kind === 'answer' && onReport ? <CopilotReportButton onPress={onReport} /> : null}
        <IconButton
          icon="x"
          iconSize={v3.icon.md}
          color={v3.colors.muted}
          accessibilityLabel={t('copilot.close')}
          onPress={onClose}
        />
      </View>
      <CopilotAnswerBody state={state} onUse={onUse} onKeep={onClose} />
      <View style={styles.foot}>
        {showsAllowance(state) ? <CopilotAllowance quota={quota} /> : null}
        <Pressable
          accessibilityRole="link"
          onPress={() => router.push('/(app)/copilot')}
          // The words are a caption; the slop makes them a whole target.
          hitSlop={12}
          style={({ pressed }) => [styles.about, pressed && styles.pressed]}
        >
          <Text style={styles.aboutText}>{t('copilot.whatIsThis')}</Text>
        </Pressable>
      </View>
    </View>
  )
}

/**
 * Whether the allowance line goes under this state: not while the answer is
 * being written, and not under the quota's own sentence, which already says
 * when more come.
 */
export function showsAllowance(state: CopilotAnswerState): boolean {
  if (state.kind === 'loading') return false
  return !(
    state.kind === 'error' &&
    (state.key === 'copilot.errQuota' || state.key === 'copilot.errQuotaNoTime')
  )
}

/**
 * The middle of a card or a sheet: the skeleton, the answer, or the one line
 * a refusal gets. Shared so both surfaces word an error the same way.
 */
export function CopilotAnswerBody({
  state,
  onUse,
  onKeep,
}: {
  state: CopilotAnswerState
  onUse?: (text: string) => void
  onKeep?: () => void
}) {
  const styles = useStyles()
  const t = useT()
  const { locale } = useLocale()

  if (state.kind === 'loading') {
    return (
      <View
        style={styles.skeleton}
        accessible
        accessibilityLabel={t('copilot.loading')}
        accessibilityState={{ busy: true }}
      >
        <Skeleton width="90%" height={16} />
        <Skeleton width="60%" height={16} />
      </View>
    )
  }

  if (state.kind === 'error') {
    const time = copilotTime(state.retryAt, locale)
    const key = state.key === 'copilot.errQuota' && !time ? 'copilot.errQuotaNoTime' : state.key
    return <Text style={styles.body}>{t(key, { time })}</Text>
  }

  const { result } = state
  if (result.action === 'check') {
    if (!result.changed) return <Text style={styles.body}>{t('copilot.looksGood')}</Text>
    return (
      <CheckAnswer
        asked={state.asked}
        corrected={result.corrected}
        reason={result.reason}
        onUse={onUse}
        onKeep={onKeep}
      />
    )
  }
  if (result.action === 'sayIt') {
    return (
      <View style={styles.options}>
        <Text style={styles.title} accessibilityRole="header">
          {t('copilot.sayItTitle')}
        </Text>
        {result.options.map((option, index) => (
          <PressableScale
            key={`${index}-${option.text}`}
            accessibilityRole="button"
            accessibilityLabel={`${option.text}. ${option.gloss}`}
            onPress={() => onUse?.(option.text)}
            disabled={onUse === undefined}
            style={styles.option}
          >
            <Text style={styles.optionText}>{option.text}</Text>
            {option.gloss ? <Text style={styles.gloss}>{option.gloss}</Text> : null}
          </PressableScale>
        ))}
      </View>
    )
  }
  if (result.action === 'explain') {
    return <Text style={styles.body}>{result.explanation}</Text>
  }
  if (result.action === 'replyIdeas') {
    // Say it's rows, without a gloss: an idea is already in the language of
    // the chat. A tap puts it in the draft, and the person sends it or not.
    return (
      <View style={styles.options}>
        <Text
          style={styles.title}
          accessibilityRole="header"
          accessibilityLabel={t('copilot.replyIdeasCount', { count: result.ideas.length })}
        >
          {t('copilot.replyIdeas')}
        </Text>
        {result.ideas.map((idea, index) => (
          <PressableScale
            key={`${index}-${idea}`}
            accessibilityRole="button"
            accessibilityLabel={idea}
            accessibilityHint={t('copilot.replyIdeaHint')}
            onPress={() => onUse?.(idea)}
            disabled={onUse === undefined}
            style={styles.option}
          >
            <Text style={styles.optionText}>{idea}</Text>
          </PressableScale>
        ))}
      </View>
    )
  }
  return null
}

function CheckAnswer({
  asked,
  corrected,
  reason,
  onUse,
  onKeep,
}: {
  asked: string
  corrected: string
  reason: string | null
  onUse?: ((text: string) => void) | undefined
  onKeep?: (() => void) | undefined
}) {
  const styles = useStyles()
  const t = useT()
  // The tokens a person's correction marks, recoloured: Copilot's change is
  // blue, never the green that means a person corrected you.
  const segments = useMemo(() => diffCorrection(asked, corrected).corrected, [asked, corrected])
  return (
    <View style={styles.check}>
      <Text style={styles.corrected}>
        {segments.map((segment, index) => (
          <Text key={index} style={segment.changed ? styles.changed : null}>
            {segment.text}
          </Text>
        ))}
      </Text>
      {reason ? <Text style={styles.reason}>{reason}</Text> : null}
      {onUse && onKeep ? (
        <View style={styles.actions}>
          <Button
            label={t('copilot.useThis')}
            variant="secondary"
            size="small"
            onPress={() => onUse(corrected)}
            style={styles.action}
          />
          <Button
            label={t('copilot.keepMine')}
            variant="secondary"
            size="small"
            onPress={onKeep}
            style={styles.action}
          />
        </View>
      ) : null}
    </View>
  )
}

const useStyles = makeStyles(({ colors, v3 }) => ({
  /*
   * Copilot's own tint, `infoBg`, in both schemes — the blue a person never
   * wears. The text on it is v3's: `fg`, and `echoText` for the changed
   * words, since the blue glyph colour (`info`) is under 4.5:1 as text on its
   * own tint in the light scheme.
   */
  card: {
    backgroundColor: colors.infoBg,
    borderRadius: v3.radius.block,
    gap: v3.space[8],
    paddingBottom: v3.space[14],
    paddingHorizontal: v3.space[16],
    paddingTop: v3.space[4],
  },
  header: { alignItems: 'center', flexDirection: 'row', marginEnd: -v3.space[10] },
  // The allowance at the start and the link at the end, as the label and the
  // close sit in the header; wrapped, the link keeps to the end on its own line.
  foot: {
    alignItems: 'center',
    columnGap: v3.space[12],
    flexDirection: 'row',
    flexWrap: 'wrap',
    rowGap: v3.space[2],
  },
  about: { marginStart: 'auto' },
  // `echoText`, the palette's blue for words, as the changed words above are.
  aboutText: { ...v3.type.caption, color: v3.colors.echoText, fontWeight: '700' },
  pressed: { opacity: 0.6 },
  grow: { flex: 1 },
  skeleton: { gap: v3.space[8], paddingVertical: v3.space[4] },
  title: { ...v3.type.label, color: v3.colors.muted },
  body: { ...v3.type.body, color: v3.colors.fg },
  check: { gap: v3.space[8] },
  corrected: { ...v3.type.body, color: v3.colors.fg },
  changed: { color: v3.colors.echoText, fontWeight: '700' },
  reason: { ...v3.type.caption, color: v3.colors.muted },
  actions: { flexDirection: 'row', gap: v3.space[8] },
  action: { flex: 1, width: 'auto' },
  options: { gap: v3.space[8] },
  option: {
    backgroundColor: v3.colors.bg,
    borderRadius: v3.radius.row,
    gap: v3.space[2],
    justifyContent: 'center',
    minHeight: 48,
    paddingHorizontal: v3.space[14],
    paddingVertical: v3.space[10],
  },
  optionText: { ...v3.type.body, color: v3.colors.fg },
  gloss: { ...v3.type.caption, color: v3.colors.muted },
}))

import Feather from '@expo/vector-icons/Feather'
import type { CopilotResult } from '@langx/shared'
import { useState } from 'react'
import { Modal, Pressable, ScrollView, Text, View } from 'react-native'
import { useReportCopilotAnswer } from '../../api/copilot'
import { useReduceMotion } from '../../hooks/useReduceMotion'
import { useT } from '../../i18n'
import { copilotReportOffersQuestion, copilotReportRequest } from '../../lib/copilotReport'
import { makeStyles, useTheme } from '../../lib/theme'
import { showToast } from '../../lib/toast'
import { CopilotLabel } from '../CopilotLabel'
import { Button } from '../ui/Button'
import { Toggle } from '../ui/Toggle'

/** One answer somebody may report: what it said, and the draft it was about. */
export interface CopilotReportTarget {
  result: CopilotResult
  /** The draft as it was asked; empty for Explain and Reply ideas. */
  asked: string
}

/**
 * "Report", small and in the corner of an answer: there for the answer that
 * was wrong or worse, and quiet enough that it does not read as a verdict on
 * every answer that was fine.
 */
export function CopilotReportButton({ onPress }: { onPress: () => void }) {
  const styles = useStyles()
  const { v3 } = useTheme()
  const t = useT()
  return (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel={t('copilot.reportA11y')}
      onPress={onPress}
      hitSlop={12}
      style={({ pressed }) => [styles.reportButton, pressed && styles.pressed]}
    >
      <Feather name="flag" size={v3.icon.xs} color={v3.colors.muted} />
      <Text style={styles.reportLabel}>{t('copilot.report')}</Text>
    </Pressable>
  )
}

/**
 * The confirm step before a report goes: what is sent, said before it is.
 *
 * The answer always goes — it is what is being reported. The person's own
 * draft goes only if they turn the switch on, and the switch starts off and
 * shows the words it would send. Explain and Reply ideas have no switch:
 * what they were asked about is the other person's message, which is not
 * this person's to pass on.
 */
export function CopilotReportPanel({
  target,
  onDone,
  onSent = onDone,
}: {
  target: CopilotReportTarget
  /** Cancelled — and sent, unless `onSent` says otherwise. */
  onDone: () => void
  /** After the report went. Defaults to `onDone`. */
  onSent?: () => void
}) {
  const styles = useStyles()
  const t = useT()
  const report = useReportCopilotAnswer()
  const [includeQuestion, setIncludeQuestion] = useState(false)
  const offersQuestion = copilotReportOffersQuestion(target.result, target.asked)

  const send = (): void => {
    report.mutate(copilotReportRequest(target.result, target.asked, includeQuestion), {
      onSuccess: () => {
        showToast(t('copilot.reportSent'))
        onSent()
      },
    })
  }

  return (
    <>
      <ScrollView contentContainerStyle={styles.content}>
        <CopilotLabel />
        <Text style={styles.title} accessibilityRole="header">
          {t('copilot.reportTitle')}
        </Text>
        <Text style={styles.body}>{t('copilot.reportBody')}</Text>
        {offersQuestion ? (
          <View style={styles.question}>
            <View style={styles.questionRow}>
              <Text style={styles.questionLabel}>{t('copilot.reportIncludeQuestion')}</Text>
              <Toggle
                accessibilityLabel={t('copilot.reportIncludeQuestion')}
                value={includeQuestion}
                onValueChange={setIncludeQuestion}
              />
            </View>
            <Text style={styles.quote} numberOfLines={4}>
              {target.asked.trim()}
            </Text>
          </View>
        ) : (
          <Text style={styles.body}>{t('copilot.reportChatNotSent')}</Text>
        )}
        {report.isError ? <Text style={styles.error}>{t('common.retry')}</Text> : null}
      </ScrollView>
      <View style={styles.footer}>
        <Button
          label={t('copilot.reportSend')}
          variant="blue"
          onPress={send}
          loading={report.isPending}
        />
        <Button label={t('common.cancel')} variant="secondary" onPress={onDone} />
      </View>
    </>
  )
}

/** The panel as a sheet of its own, for the card above the composer. */
export function CopilotReportSheet({
  target,
  onClose,
}: {
  /** Null when closed. */
  target: CopilotReportTarget | null
  onClose: () => void
}) {
  const styles = useStyles()
  const t = useT()
  const reduceMotion = useReduceMotion()
  return (
    <Modal
      visible={target !== null}
      transparent
      animationType={reduceMotion ? 'none' : 'slide'}
      onRequestClose={onClose}
      accessibilityViewIsModal
    >
      <Pressable style={styles.backdrop} accessibilityLabel={t('common.cancel')} onPress={onClose}>
        {/* Swallows the press so tapping the sheet does not close it. */}
        <Pressable style={styles.sheet} onPress={() => undefined}>
          {target ? <CopilotReportPanel target={target} onDone={onClose} /> : null}
        </Pressable>
      </Pressable>
    </Modal>
  )
}

const useStyles = makeStyles(({ v3 }) => ({
  reportButton: {
    alignItems: 'center',
    flexDirection: 'row',
    gap: v3.space[4],
    minHeight: 32,
    paddingHorizontal: v3.space[4],
  },
  reportLabel: { ...v3.type.caption, color: v3.colors.muted, fontWeight: '700' },
  pressed: { opacity: 0.6 },
  backdrop: { backgroundColor: v3.colors.scrim, flex: 1, justifyContent: 'flex-end' },
  // `CopilotExplainSheet`'s column: phone-width and centred on a wide window.
  sheet: {
    alignSelf: 'center',
    backgroundColor: v3.colors.bg,
    borderTopEndRadius: v3.radius.block,
    borderTopStartRadius: v3.radius.block,
    maxHeight: '80%',
    maxWidth: 480,
    width: '100%',
  },
  content: {
    gap: v3.space[12],
    paddingBottom: v3.space[16],
    paddingHorizontal: v3.space[24],
    paddingTop: v3.space[24],
  },
  title: { ...v3.type.headline, color: v3.colors.fg },
  body: { ...v3.type.body, color: v3.colors.muted },
  question: {
    backgroundColor: v3.colors.surface,
    borderRadius: v3.radius.row,
    gap: v3.space[8],
    padding: v3.space[14],
  },
  questionRow: { alignItems: 'center', flexDirection: 'row', gap: v3.space[12] },
  questionLabel: { ...v3.type.button, color: v3.colors.fg, flex: 1 },
  quote: { ...v3.type.callout, color: v3.colors.muted },
  error: { ...v3.type.caption, color: v3.colors.danger },
  footer: {
    gap: v3.space[8],
    paddingBottom: v3.space[24],
    paddingHorizontal: v3.space[24],
    paddingTop: v3.space[8],
  },
}))

import type { CopilotStatus } from '@langx/shared'
import { Modal, Pressable, ScrollView, Text, View } from 'react-native'
import { useReduceMotion } from '../../hooks/useReduceMotion'
import { useT } from '../../i18n'
import { makeStyles } from '../../lib/theme'
import { CopilotLabel } from '../CopilotLabel'
import { Button } from '../ui/Button'
import { CopilotAllowance } from './CopilotAllowance'
import { CopilotAnswerBody, type CopilotAnswerState } from './CopilotCard'

/**
 * Explain's answer: what one message means, or what a correction changed
 * and why, in a sheet over the thread — never a row in it.
 *
 * For a correction it explains the person's change and offers none of its
 * own; the server's prompt is what holds that, and this sheet has nowhere to
 * put a sentence of Copilot's even if one came back. Tapping outside closes
 * it, as Close does.
 */
export function CopilotExplainSheet({
  state,
  quota,
  onClose,
}: {
  /** Null when closed. */
  state: CopilotAnswerState | null
  quota: CopilotStatus['quota'] | undefined
  onClose: () => void
}) {
  const styles = useStyles()
  const t = useT()
  const reduceMotion = useReduceMotion()

  return (
    <Modal
      visible={state !== null}
      transparent
      animationType={reduceMotion ? 'none' : 'slide'}
      onRequestClose={onClose}
      accessibilityViewIsModal
    >
      <Pressable style={styles.backdrop} accessibilityLabel={t('copilot.close')} onPress={onClose}>
        {/* Swallows the press so tapping the sheet does not close it. */}
        <Pressable style={styles.sheet} onPress={() => undefined}>
          <ScrollView contentContainerStyle={styles.content} accessibilityLiveRegion="polite">
            <CopilotLabel />
            <Text style={styles.title} accessibilityRole="header">
              {t('copilot.explainTitle')}
            </Text>
            {state ? <CopilotAnswerBody state={state} /> : null}
            {state && state.kind !== 'loading' ? <CopilotAllowance quota={quota} /> : null}
          </ScrollView>
          <View style={styles.footer}>
            <Button label={t('copilot.close')} variant="secondary" onPress={onClose} />
          </View>
        </Pressable>
      </Pressable>
    </Modal>
  )
}

const useStyles = makeStyles(({ v3 }) => ({
  backdrop: { backgroundColor: v3.colors.scrim, flex: 1, justifyContent: 'flex-end' },
  // `CopilotConsentSheet`'s column: phone-width and centred on a wide window.
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
  footer: {
    paddingBottom: v3.space[24],
    paddingHorizontal: v3.space[24],
    paddingTop: v3.space[8],
  },
}))

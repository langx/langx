import Feather from '@expo/vector-icons/Feather'
import { ActivityIndicator, Modal, Pressable, ScrollView, Text, View } from 'react-native'
import { useCopilotStatus, useGiveCopilotConsent } from '../api/copilot'
import { useAppConfig } from '../hooks/useAppConfig'
import { useReduceMotion } from '../hooks/useReduceMotion'
import { useT, type MessageKey } from '../i18n'
import { authClient } from '../lib/auth-client'
import { copilotGate } from '../lib/copilotGate'
import { shouldGateGuest } from '../lib/guestGate'
import { PRIVACY_URL } from '../lib/externalLinks'
import { openExternal } from '../lib/openExternal'
import { makeStyles, useTheme } from '../lib/theme'
import { CopilotLabel } from './CopilotLabel'
import { Button } from './ui/Button'

/** What is sent, what never is, and that it can be wrong — one line each. */
const POINTS: { icon: 'send' | 'slash' | 'alert-circle'; key: MessageKey }[] = [
  { icon: 'send', key: 'copilot.consentSends' },
  { icon: 'slash', key: 'copilot.consentNever' },
  { icon: 'alert-circle', key: 'copilot.consentWrong' },
]

/**
 * The one-time question before anybody's text goes to the AI provider.
 *
 * App Review 5.1.2(i) asks for exactly this when personal data goes to a
 * third-party AI service: say what is sent, to whom, and get permission first.
 * So the sheet names the provider and what it receives, and the agreement is
 * recorded on the server — the server, not this sheet, is what refuses to
 * call the model without it (`COPILOT_CONSENT_REQUIRED`).
 *
 * "Turn on" and "Not now" are the same size, side by side in weight: a
 * consent that is easier to give than to decline is not one. Blue rather than
 * the yellow, because every Copilot surface is blue. Tapping outside is "Not
 * now", and nothing is recorded.
 *
 * When Copilot is off — no key, the operator's switch, the account's age, or
 * an API that predates it — the sheet says so and offers nothing to agree to.
 * The caller gates guests with `requireAccount` before opening it.
 */
export function CopilotConsentSheet({
  visible,
  onClose,
  onConsented,
}: {
  visible: boolean
  onClose: () => void
  /** After the agreement is recorded — the caller goes on to ask. */
  onConsented?: () => void
}) {
  const styles = useStyles()
  const { colors } = useTheme()
  const t = useT()
  const reduceMotion = useReduceMotion()
  const service = useAppConfig().data?.copilotService
  // A guest is never asked about: `GET /copilot` would answer GUEST_ACCOUNT,
  // and the transport would take them to sign-up from inside a sheet.
  const session = authClient.useSession().data
  const member = session !== null && session !== undefined && !shouldGateGuest(session.user)
  const status = useCopilotStatus(visible && member && service === true)
  const consent = useGiveCopilotConsent()
  const gate = copilotGate(service, status.data)
  // Until `GET /copilot` answers, the gate reads "off" — which is not true yet,
  // so the sheet waits rather than saying it.
  const loading = member && service === true && status.isPending

  const accept = (): void => {
    consent.mutate(undefined, {
      onSuccess: () => {
        onClose()
        onConsented?.()
      },
    })
  }

  return (
    <Modal
      visible={visible}
      transparent
      animationType={reduceMotion ? 'none' : 'slide'}
      onRequestClose={onClose}
      accessibilityViewIsModal
    >
      <Pressable
        style={styles.backdrop}
        accessibilityLabel={t('copilot.consentDecline')}
        onPress={onClose}
      >
        {/* Swallows the press so tapping the sheet does not close it. */}
        <Pressable style={styles.sheet} onPress={() => undefined}>
          {loading ? (
            <View style={styles.content}>
              <ActivityIndicator color={colors.info} />
            </View>
          ) : gate === 'off' ? (
            <View style={styles.content}>
              <Text style={styles.body}>{t('copilot.off')}</Text>
            </View>
          ) : (
            <ScrollView contentContainerStyle={styles.content}>
              <CopilotLabel />
              <Text style={styles.title} accessibilityRole="header">
                {t('copilot.consentTitle')}
              </Text>
              <Text style={styles.body}>{t('copilot.consentBody')}</Text>
              {POINTS.map((point) => (
                <View key={point.key} style={styles.point}>
                  <Feather
                    name={point.icon}
                    size={16}
                    color={colors.info}
                    style={styles.pointIcon}
                  />
                  <Text style={styles.body}>{t(point.key)}</Text>
                </View>
              ))}
              <Pressable
                accessibilityRole="link"
                onPress={() => void openExternal(PRIVACY_URL)}
                style={({ pressed }) => pressed && styles.pressed}
              >
                <Text style={styles.link}>{t('legal.privacy')}</Text>
              </Pressable>
              {consent.isError ? <Text style={styles.error}>{t('common.retry')}</Text> : null}
            </ScrollView>
          )}

          {/* Outside the scroller: the way out of a sheet must never be the one thing you have to scroll to find. */}
          <View style={styles.footer}>
            {gate === 'off' ? (
              <Button label={t('common.ok')} variant="secondary" onPress={onClose} />
            ) : (
              <>
                <Button
                  label={t('copilot.consentAccept')}
                  variant="blue"
                  onPress={accept}
                  loading={consent.isPending}
                />
                <Button label={t('copilot.consentDecline')} variant="secondary" onPress={onClose} />
              </>
            )}
          </View>
        </Pressable>
      </Pressable>
    </Modal>
  )
}

const useStyles = makeStyles(({ colors, font, radius, spacing }) => ({
  backdrop: { backgroundColor: colors.scrim, flex: 1, justifyContent: 'flex-end' },
  // `EchoAboutSheet`'s column: phone-width and centred on a wide window.
  sheet: {
    alignSelf: 'center',
    backgroundColor: colors.bg,
    borderTopEndRadius: radius.xxl,
    borderTopStartRadius: radius.xxl,
    maxHeight: '88%',
    maxWidth: 480,
    width: '100%',
  },
  content: {
    gap: spacing.md,
    paddingBottom: spacing.lg,
    paddingHorizontal: spacing.lg,
    paddingTop: spacing.xl,
  },
  title: { ...font.heading, color: colors.text },
  body: { ...font.body, color: colors.textMuted, flex: 1, lineHeight: 22 },
  point: { alignItems: 'flex-start', flexDirection: 'row', gap: spacing.sm },
  // The glyph sits on the first line of text, not in the middle of the block.
  pointIcon: { paddingTop: 3 },
  link: { ...font.label, color: colors.accent },
  pressed: { opacity: 0.6 },
  error: { ...font.caption, color: colors.danger },
  footer: {
    borderTopColor: colors.border,
    borderTopWidth: 1,
    gap: spacing.sm,
    paddingBottom: spacing.xxl,
    paddingHorizontal: spacing.lg,
    paddingTop: spacing.md,
  },
}))

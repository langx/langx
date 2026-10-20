import Feather from '@expo/vector-icons/Feather'
import { APPEAL_MAX_LENGTH, APPEAL_MIN_LENGTH, type SuspensionStatus } from '@langx/shared'
import { Text, View } from 'react-native'
import { reportReasonLabel, useLocale, useT } from '../../i18n'
import { makeStyles, useTheme } from '../../lib/theme'
import { FieldV3 } from '../onboarding/WizardV3'
import { Button } from '../ui/Button'
import { AuthScreenV3, AuthTitleV3 } from './AuthKitV3'

/**
 * What a suspended account sees, in the redesign's look (`V-Suspended`),
 * behind `flags.v3Home`. `app/suspended.tsx` keeps the status, the one
 * appeal, the check and the sign-out.
 *
 * Moderation's words are today's, every one of them, in today's order: when
 * it ends, why, the one appeal, the way to write to a person. Nothing here
 * says who reported the account, because nothing anywhere does.
 *
 * The appeal is the yellow — the one thing on the screen that commits to
 * something — and the sign-out is the red outline, the way out that cannot
 * be taken back from here.
 */
export function SuspendedV3({
  data,
  draft,
  onChangeDraft,
  ready,
  sent,
  sending,
  supportAddress,
  onSend,
  onCheckAgain,
  onSignOut,
}: {
  data: SuspensionStatus | undefined
  draft: string
  onChangeDraft: (value: string) => void
  /** Long enough to send. */
  ready: boolean
  /** The appeal has been made. */
  sent: boolean
  sending: boolean
  supportAddress: string
  onSend: () => void
  onCheckAgain: () => void
  onSignOut: () => void
}) {
  const styles = useStyles()
  const t = useT()
  const { v3 } = useTheme()
  const { locale } = useLocale()

  return (
    <AuthScreenV3
      footer={
        <>
          <View style={styles.rule} />
          <Text style={styles.contact}>{t('suspended.contact', { email: supportAddress })}</Text>
          <Button
            variant="danger"
            icon="log-out"
            label={t('suspended.signOut')}
            onPress={onSignOut}
          />
        </>
      }
    >
      <AuthTitleV3
        title={t('suspended.title')}
        body={
          data?.permanent || !data?.until
            ? t('suspended.permanentBody')
            : t('suspended.untilBody', { until: new Date(data.until).toLocaleString(locale) })
        }
      />

      {data?.reason ? (
        <View style={[styles.reason, { backgroundColor: v3.hues.tangerine }]}>
          <Feather name="alert-triangle" size={v3.icon.lg} color={v3.colors.ink} />
          <Text style={styles.reasonLabel}>{t('suspended.reasonLabel')}</Text>
          <View style={styles.reasonChip}>
            <Text style={styles.reasonText}>{reportReasonLabel(t, data.reason)}</Text>
          </View>
        </View>
      ) : null}

      <View style={styles.section}>
        <Text accessibilityRole="header" style={styles.heading}>
          {sent ? t('suspended.sent') : t('suspended.appealTitle')}
        </Text>
        {sent ? (
          <Text style={styles.muted}>{t('suspended.sentBody')}</Text>
        ) : (
          <>
            <Text style={styles.muted}>{t('suspended.appealBody')}</Text>
            <FieldV3
              value={draft}
              onChangeText={onChangeDraft}
              placeholder={t('suspended.appealPlaceholder')}
              multiline
              autoCapitalize="sentences"
              maxLength={APPEAL_MAX_LENGTH}
              // Only once they have started, as today: an empty field with a
              // warning under it is a form that scolds first.
              error={
                draft.trim().length > 0 && !ready
                  ? t('suspended.appealTooShort', { count: APPEAL_MIN_LENGTH })
                  : undefined
              }
            />
            <Button
              icon="send"
              label={sending ? t('suspended.sending') : t('suspended.send')}
              disabled={!ready || sending}
              onPress={onSend}
            />
          </>
        )}
        <Button
          variant="secondary"
          icon="refresh-cw"
          label={t('suspended.checkAgain')}
          onPress={onCheckAgain}
        />
      </View>
    </AuthScreenV3>
  )
}

const useStyles = makeStyles(({ v3 }) => ({
  reason: {
    alignItems: 'center',
    borderRadius: v3.radius.tile,
    flexDirection: 'row',
    gap: v3.space[10],
    minHeight: 56,
    paddingEnd: v3.space[8],
    paddingStart: v3.space[14],
    paddingVertical: v3.space[8],
  },
  reasonLabel: { ...v3.type.button, color: v3.colors.ink, flex: 1 },
  // The reason in a chip of the ground's colour, so it reads as the answer.
  reasonChip: {
    backgroundColor: v3.colors.bg,
    borderRadius: v3.radius.pill,
    flexShrink: 1,
    justifyContent: 'center',
    minHeight: 40,
    paddingHorizontal: v3.space[16],
  },
  reasonText: { ...v3.type.callout, color: v3.colors.fg, fontWeight: '700' },
  section: { gap: v3.space[10], marginTop: v3.space[8] },
  heading: { ...v3.type.headline, color: v3.colors.fg },
  muted: { ...v3.type.callout, color: v3.colors.muted },
  rule: { backgroundColor: v3.colors.line, height: 2 },
  contact: { ...v3.type.caption, color: v3.colors.muted, textAlign: 'center' },
}))

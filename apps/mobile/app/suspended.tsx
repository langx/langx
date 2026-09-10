import { APPEAL_MAX_LENGTH, APPEAL_MIN_LENGTH } from '@langx/shared'
import { router } from 'expo-router'
import { useState } from 'react'
import { ScrollView, Text, View } from 'react-native'
import { ApiRequestError } from '../src/api/client'
import { useSubmitAppeal, useSuspension } from '../src/api/queries'
import { Button } from '../src/components/ui/Button'
import { Callout } from '../src/components/ui/Callout'
import { FormField } from '../src/components/ui/FormField'
import { Screen } from '../src/components/ui/Screen'
import { useSignalAppReady } from '../src/hooks/useAppReady'
import { useScreenInteractive } from '../src/hooks/useScreenInteractive'
import { reportReasonLabel, useLocale, useT } from '../src/i18n'
import { authClient } from '../src/lib/auth-client'
import { authLandingHref } from '../src/lib/authLanding'
import { FLAG_KEYS, readBoolFlag } from '../src/lib/localFlags'
import { makeStyles } from '../src/lib/theme'
import { showToast } from '../src/lib/toast'

const SUPPORT_ADDRESS = 'hi@langx.io'

/**
 * What a suspended account sees instead of the app.
 *
 * At the root and outside both `Stack.Protected` groups, like `magic-link`:
 * the session is still perfectly good — that is the whole point of a
 * suspension rather than a ban — so the guard that decides which group mounts
 * has nothing to say about this screen, and the transport `replace`s here
 * from wherever the 403 was met.
 *
 * It says three things and offers three: when it ends, why, and that there is
 * one appeal. It never says who reported them, because nothing anywhere does
 * — see `docs/community-guidelines.md`.
 */
export default function SuspendedScreen() {
  useScreenInteractive()
  const styles = useStyles()
  const t = useT()
  const { locale } = useLocale()
  const status = useSuspension()
  const appeal = useSubmitAppeal()
  const [draft, setDraft] = useState('')

  // The same reason `AppGate` signals: nothing downstream of a screen that
  // replaces the app will ever say the opening animation is over.
  useSignalAppReady(!status.isPending)

  const data = status.data
  const ready = draft.trim().length >= APPEAL_MIN_LENGTH
  const sent = Boolean(data?.appealedAt)

  async function signOut(): Promise<void> {
    /*
     * No push unregister here, unlike Settings: that call goes through the
     * API, which refuses this account. Leaving the token registered costs
     * nothing — a suspended account is sent no notifications.
     */
    await authClient.signOut()
    router.replace(authLandingHref(await readBoolFlag(FLAG_KEYS.introSeen)))
  }

  function send(): void {
    if (!ready || appeal.isPending) return
    appeal.mutate(draft.trim(), {
      onSuccess: () => setDraft(''),
      onError: (caught: unknown) => {
        // One appeal per suspension, so the second is refused rather than
        // failing — and "already sent" is a different sentence from "failed".
        const code = caught instanceof ApiRequestError ? caught.code : undefined
        showToast(
          code === 'VALIDATION_FAILED' ? t('suspended.alreadyAppealed') : t('suspended.failed'),
        )
      },
    })
  }

  return (
    <Screen fluid>
      <ScrollView
        contentContainerStyle={styles.body}
        keyboardShouldPersistTaps="handled"
        keyboardDismissMode="on-drag"
        automaticallyAdjustKeyboardInsets
      >
        <Text style={styles.title}>{t('suspended.title')}</Text>
        <Text style={styles.lead}>
          {data?.permanent || !data?.until
            ? t('suspended.permanentBody')
            : t('suspended.untilBody', { until: new Date(data.until).toLocaleString(locale) })}
        </Text>

        {data?.reason ? (
          <Callout tone="warning" icon="alert-triangle" title={t('suspended.reasonLabel')}>
            <Text style={styles.reason}>{reportReasonLabel(t, data.reason)}</Text>
          </Callout>
        ) : null}

        <View style={styles.section}>
          <Text style={styles.heading}>
            {sent ? t('suspended.sent') : t('suspended.appealTitle')}
          </Text>
          {sent ? (
            <Text style={styles.muted}>{t('suspended.sentBody')}</Text>
          ) : (
            <>
              <Text style={styles.muted}>{t('suspended.appealBody')}</Text>
              <FormField
                value={draft}
                onChangeText={setDraft}
                placeholder={t('suspended.appealPlaceholder')}
                multiline
                autoCapitalize="sentences"
                maxLength={APPEAL_MAX_LENGTH}
                // Only once they have started: an empty field with a warning
                // under it is a form that scolds first.
                error={
                  draft.trim().length > 0 && !ready
                    ? t('suspended.appealTooShort', { count: APPEAL_MIN_LENGTH })
                    : undefined
                }
                style={styles.field}
              />
              <Button
                label={appeal.isPending ? t('suspended.sending') : t('suspended.send')}
                disabled={!ready || appeal.isPending}
                onPress={send}
              />
            </>
          )}
        </View>

        <Button
          variant="secondary"
          label={t('suspended.checkAgain')}
          onPress={() => {
            void status.refetch().then((result) => {
              // The one way out that is not a sign-out: the date passed, or
              // an appeal was answered while this screen sat open.
              if (result.data && !result.data.suspended) router.replace('/')
            })
          }}
        />
        <Text style={styles.contact}>{t('suspended.contact', { email: SUPPORT_ADDRESS })}</Text>
        <Button variant="neutral" label={t('suspended.signOut')} onPress={() => void signOut()} />
      </ScrollView>
    </Screen>
  )
}

const useStyles = makeStyles(({ colors, font, spacing }) => ({
  body: { gap: spacing.lg, paddingBottom: spacing.xxl, paddingTop: spacing.xl },
  title: { ...font.title, color: colors.text },
  lead: { ...font.body, color: colors.text, fontSize: 16, lineHeight: 25 },
  reason: { color: colors.text, fontSize: 15, fontWeight: '600' },
  section: { gap: spacing.md },
  heading: { ...font.heading, color: colors.text },
  muted: { ...font.body, color: colors.textMuted, lineHeight: 22 },
  field: { minHeight: 120 },
  contact: { color: colors.textMuted, fontSize: 13, textAlign: 'center' },
}))

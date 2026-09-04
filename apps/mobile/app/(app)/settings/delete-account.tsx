import { ACCOUNT_DELETION_GRACE_DAYS, handlesMatch } from '@langx/shared'
import { router } from 'expo-router'
import { useState } from 'react'
import { Text, TextInput, View } from 'react-native'
import { api } from '../../../src/api/client'
import { useMe } from '../../../src/api/queries'
import { Button } from '../../../src/components/ui/Button'
import { Screen } from '../../../src/components/ui/Screen'
import { ScreenHeader } from '../../../src/components/ui/ScreenHeader'
import { useT } from '../../../src/i18n'
import { showAlert } from '../../../src/lib/alert'
import { authClient } from '../../../src/lib/auth-client'
import { authLandingHref } from '../../../src/lib/authLanding'
import { syncIconBadge } from '../../../src/lib/iconBadge'
import { FLAG_KEYS, readBoolFlag } from '../../../src/lib/localFlags'
import { goBackTo } from '../../../src/lib/navigation'
import { makeStyles, useTheme } from '../../../src/lib/theme'
import { showToast } from '../../../src/lib/toast'

/**
 * The front door to deleting an account, which used to be one tap behind a
 * plain two-button dialog that posted `{ confirm: 'DELETE' }` — a literal in
 * client code that nobody ever typed.
 *
 * A screen rather than a dialog because `AlertHost` renders buttons and no
 * text field, and because this is not a question you answer in passing.
 * `link-device.tsx` is the precedent: the same shape, for the same reason —
 * something irreversible needs a page, not a popup.
 *
 * Two steps, not one. Typing your own handle proves it is you at the keyboard;
 * the emailed link proves it is you at the mailbox. A borrowed unlocked phone
 * gets through neither, and a mis-tap gets through the first.
 *
 * **The link starts the existing 30-day grace period rather than wiping
 * anything**, so `DeletionBanner`, "Keep it" and the purge scheduler all still
 * apply and the promise in `docs/legal/promise-change.md` stays true.
 */
export default function DeleteAccountScreen() {
  const styles = useStyles()
  const { colors } = useTheme()
  const t = useT()
  const me = useMe()
  const session = authClient.useSession().data

  const handle = me.data?.handle ?? ''
  const [typed, setTyped] = useState('')
  const [busy, setBusy] = useState(false)
  const [sentTo, setSentTo] = useState<string | null>(null)
  const matches = handlesMatch(typed, handle)

  /**
   * The direct path, for a deployment that cannot send mail at all.
   *
   * App Store 5.1.1(v) requires deletion to be reachable in the app, and it
   * does not care that `RESEND_API_KEY` is unset — with no key the sender is
   * `ConsoleEmailSender` and the link only ever reaches a log. The server says
   * which case it is (`deliverable`), rather than the client guessing.
   */
  async function deleteWithoutEmail(): Promise<void> {
    await api.post('/me/delete', { confirm: 'DELETE' })
    await syncIconBadge(0)
    await authClient.signOut()
    router.replace(authLandingHref(await readBoolFlag(FLAG_KEYS.introSeen)))
    showToast(t('settings.deleted', { days: ACCOUNT_DELETION_GRACE_DAYS }))
  }

  async function submit(): Promise<void> {
    setBusy(true)
    try {
      const result = await api.post<{ sent: boolean; deliverable: boolean }>('/me/delete/request', {
        handle: typed,
      })
      if (result.sent) {
        // The session's address, not the profile's: the profile has never
        // carried one, and the mail went to the verified address Better Auth
        // holds.
        setSentTo(session?.user.email ?? '')
        return
      }
      await deleteWithoutEmail()
    } catch (error) {
      // The API's message is English and written for a developer.
      void error
      await showAlert(t('settings.deleteFailed'), t('common.retry'))
    } finally {
      setBusy(false)
    }
  }

  return (
    <Screen scroll>
      <ScreenHeader
        title={t('settings.deleteAccount')}
        onBack={() => goBackTo('/(app)/settings')}
      />

      {sentTo === null ? (
        <>
          <Text style={styles.body}>
            {t('settings.deleteExplain', { days: ACCOUNT_DELETION_GRACE_DAYS })}
          </Text>
          <Text style={styles.warning}>{t('settings.deleteTypeHandle', { handle })}</Text>

          <TextInput
            value={typed}
            onChangeText={setTyped}
            placeholder={handle}
            placeholderTextColor={colors.textFaint}
            autoCapitalize="none"
            autoCorrect={false}
            autoComplete="off"
            maxLength={64}
            style={styles.input}
            accessibilityLabel={t('settings.deleteTypeHandle', { handle })}
          />

          <View style={styles.actions}>
            <Button
              label={t('settings.deleteAccount')}
              loading={busy}
              disabled={busy || !matches}
              onPress={() => void submit()}
            />
          </View>
        </>
      ) : (
        /*
         * Nothing has happened to the account yet, and the copy says so: the
         * link in the mail is what schedules it, and a page that implied
         * otherwise would have people believe they had deleted an account they
         * had not.
         */
        <>
          <Text style={styles.body}>{t('settings.deleteCheckEmail', { email: sentTo })}</Text>
          <Text style={styles.warning}>{t('settings.deleteNothingYet')}</Text>
        </>
      )}
    </Screen>
  )
}

const useStyles = makeStyles(({ colors, font, radius, spacing }) => ({
  body: { ...font.body, color: colors.text, marginTop: spacing.lg },
  warning: { ...font.caption, color: colors.textMuted, marginTop: spacing.md },
  input: {
    ...font.body,
    backgroundColor: colors.fill,
    borderRadius: radius.md,
    color: colors.text,
    marginTop: spacing.lg,
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.md,
  },
  actions: { gap: spacing.sm, marginTop: spacing.lg },
}))

import { ACCOUNT_DELETION_GRACE_DAYS, handlesMatch } from '@langx/shared'
import { router } from 'expo-router'
import { useState } from 'react'
import { KeyboardAvoidingView, Platform, Pressable, Text, View } from 'react-native'
import { api } from '../../../src/api/client'
import { useMe } from '../../../src/api/queries'
import { Button } from '../../../src/components/ui/Button'
import { FormField } from '../../../src/components/ui/FormField'
import { Screen } from '../../../src/components/ui/Screen'
import { ScreenHeader } from '../../../src/components/ui/ScreenHeader'
import { useT } from '../../../src/i18n'
import { showAlert } from '../../../src/lib/alert'
import { authClient } from '../../../src/lib/auth-client'
import { authLandingHref } from '../../../src/lib/authLanding'
import { syncIconBadge } from '../../../src/lib/iconBadge'
import { goBackTo } from '../../../src/lib/navigation'
import { makeStyles } from '../../../src/lib/theme'
import { showToast } from '../../../src/lib/toast'
import { useScreenInteractive } from '../../../src/hooks/useScreenInteractive'

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
  useScreenInteractive()
  const styles = useStyles()
  const t = useT()
  const me = useMe()
  const session = authClient.useSession().data

  const handle = me.data?.handle ?? ''
  const [typed, setTyped] = useState('')
  const [busy, setBusy] = useState(false)
  const [sentTo, setSentTo] = useState<string | null>(null)
  const matches = handlesMatch(typed, handle)
  const back = () => goBackTo('/(app)/settings')

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
    router.replace(authLandingHref())
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
    // Not a scroll: the red button and the way out sit at the foot, and the
    // keyboard pushes them up rather than covering them.
    <Screen style={styles.screen}>
      <KeyboardAvoidingView
        style={styles.screen}
        behavior={Platform.OS === 'ios' ? 'padding' : undefined}
      >
        <ScreenHeader title={t('settings.deleteConfirmTitle')} onBack={back} />

        <View style={styles.column}>
          {sentTo === null ? (
            <>
              <Text style={styles.body}>
                {t('settings.deleteExplain', { days: ACCOUNT_DELETION_GRACE_DAYS })}
              </Text>
              {/*
                Said before anything is typed, in the danger tint: the page is
                about deletion, and the box is what says none has happened.
              */}
              <View style={styles.notice}>
                <Text style={styles.noticeText}>{t('settings.deleteNothingYet')}</Text>
              </View>

              <FormField
                label={t('settings.deleteTypeHandle', { handle })}
                value={typed}
                onChangeText={setTyped}
                placeholder={handle}
                autoComplete="off"
                maxLength={64}
                accessibilityLabel={t('settings.deleteTypeHandle', { handle })}
              />

              <View style={styles.spacer} />
              <Button
                label={t('settings.deleteAccount')}
                variant="danger"
                loading={busy}
                disabled={busy || !matches}
                onPress={() => void submit()}
              />
              <Pressable
                accessibilityRole="button"
                onPress={back}
                style={({ pressed }) => [styles.keep, pressed && styles.pressed]}
              >
                <Text style={styles.keepText}>{t('deletion.keepIt')}</Text>
              </Pressable>
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
              <View style={styles.notice}>
                <Text style={styles.noticeText}>{t('settings.deleteNothingYet')}</Text>
              </View>
            </>
          )}
        </View>
      </KeyboardAvoidingView>
    </Screen>
  )
}

const useStyles = makeStyles(({ colors, radius, spacing }) => ({
  screen: { flex: 1 },
  // 18 between blocks; the header keeps its own 10 below, so 8 on top makes
  // the same 18 to the first one.
  column: { flex: 1, gap: 18, marginTop: spacing.sm },
  body: { color: colors.textMuted, fontSize: 16, lineHeight: 25 },
  notice: {
    backgroundColor: colors.dangerBg,
    borderRadius: radius.lg,
    paddingHorizontal: 18,
    paddingVertical: spacing.lg,
  },
  noticeText: { color: colors.text, fontSize: 14, lineHeight: 21 },
  spacer: { flex: 1 },
  /** The plain text button under the red one: the way out, drawn quietly. */
  keep: { alignItems: 'center', height: 44, justifyContent: 'center' },
  pressed: { opacity: 0.6 },
  keepText: { color: colors.accent, fontSize: 15, fontWeight: '600' },
}))

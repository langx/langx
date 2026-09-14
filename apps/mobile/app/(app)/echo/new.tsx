import { ECHO_BACK_MAX_LENGTH, ECHO_FRONT_MAX_LENGTH, PLAN_LIMITS } from '@langx/shared'
import { useMemo, useRef, useState } from 'react'
import { Text, View } from 'react-native'
import { useCaptureEcho, useMe } from '../../../src/api/queries'
import { Button } from '../../../src/components/ui/Button'
import { FormField } from '../../../src/components/ui/FormField'
import { Screen } from '../../../src/components/ui/Screen'
import { ScreenHeader } from '../../../src/components/ui/ScreenHeader'
import { SegmentedControl } from '../../../src/components/ui/SegmentedControl'
import { useDisplayNames, useT } from '../../../src/i18n'
import { authClient } from '../../../src/lib/auth-client'
import { showAlert } from '../../../src/lib/alert'
import { errorCodeOf } from '../../../src/lib/errors'
import { goBackTo } from '../../../src/lib/navigation'
import { postLanguages, resolvePostLanguage } from '../../../src/lib/postLanguage'
import { requireAccount } from '../../../src/lib/requireAccount'
import { makeStyles } from '../../../src/lib/theme'
import { showToast } from '../../../src/lib/toast'
import { newClientId } from '../../../src/lib/unsentMessages'

/**
 * A card written by hand.
 *
 * Every other card in Echo is kept from something — a message, a post, a pack
 * — and this is the one you write. A word heard out loud or read on a sign has
 * nothing to be captured from, and until this screen there was no way to keep
 * it at all.
 *
 * Three fields, because a card is three things. The language is here and not
 * on the capture paths for the reason those do not need it: they read it off
 * the message. Here it is a choice, which is also why the edit screen now lets
 * it be corrected.
 */
export default function NewEchoCardScreen() {
  const styles = useStyles()
  const t = useT()
  const names = useDisplayNames()
  const { data: session } = authClient.useSession()

  const me = useMe()
  const capture = useCaptureEcho()

  const [front, setFront] = useState('')
  const [back, setBack] = useState('')
  const [chosenLanguage, setChosenLanguage] = useState<string | null>(null)

  // The same pair the feed composer uses: the languages you are learning, most
  // important first, with the wish resolved on every render rather than kept.
  const languages = useMemo(() => postLanguages(me.data?.learning), [me.data])
  const language = resolvePostLanguage(languages, chosenLanguage)

  /*
   * Minted once for this screen, not per attempt. It becomes the card's
   * `sourceKey`, so a save that times out and is tried again writes the card
   * the first one may already have written — rather than a duplicate of it.
   */
  const clientId = useRef(newClientId(Date.now(), Math.random()))

  const close = (): void => goBackTo('/(app)/echo/cards')

  async function save(): Promise<void> {
    if (!requireAccount(session?.user, { action: 'echo' })) return
    if (!language || !front.trim()) return
    try {
      await capture.mutateAsync({
        source: {
          kind: 'manual',
          clientId: clientId.current,
          front: front.trim(),
          // Omitted, never empty: an absent back asks the server for the
          // translation, an empty one would ask for a card without a back.
          ...(back.trim() ? { back: back.trim() } : {}),
          lang: language,
        },
      })
      close()
      showToast(t('echo.added'))
    } catch (error) {
      // A hand-written card spends a capture like any other, so it meets the
      // same ceiling — and the same alert, which offers nothing to buy.
      if (errorCodeOf(error) === 'QUOTA_EXCEEDED') {
        await showAlert(
          t('echo.limitTitle'),
          t('echo.limitBody', { count: PLAN_LIMITS.free.echoCapturesPerDay ?? 0 }),
        )
      } else {
        await showAlert(t('echo.addFailedTitle'), t('common.retry'))
      }
    }
  }

  return (
    <Screen scroll>
      <ScreenHeader title={t('echo.newTitle')} onBack={close} />
      <View style={styles.form}>
        {languages.length > 1 ? (
          <View style={styles.languageBlock}>
            <Text style={styles.label}>{t('echo.cardLanguage')}</Text>
            <SegmentedControl
              options={languages.map((code) => ({ value: code, label: names.language(code) }))}
              selected={language ? [language] : []}
              onToggle={setChosenLanguage}
              accessibilityLabel={t('echo.cardLanguage')}
            />
          </View>
        ) : null}

        <FormField
          label={t('echo.editFront')}
          value={front}
          onChangeText={setFront}
          maxLength={ECHO_FRONT_MAX_LENGTH}
          multiline
          autoFocus
        />
        <FormField
          label={t('echo.editBack')}
          value={back}
          onChangeText={setBack}
          maxLength={ECHO_BACK_MAX_LENGTH}
          multiline
        />
        {/* Said out loud, because an empty field that fills itself is a
            surprise unless it was offered. */}
        <Text style={styles.hint}>{t('echo.backHint')}</Text>

        <Button
          label={t('common.save')}
          onPress={() => void save()}
          loading={capture.isPending}
          disabled={!front.trim() || !language}
        />
      </View>
    </Screen>
  )
}

const useStyles = makeStyles(({ colors, spacing }) => ({
  form: { gap: spacing.md, paddingTop: spacing.md },
  languageBlock: { gap: spacing.sm },
  label: { color: colors.textMuted, fontSize: 14, fontWeight: '600' },
  hint: { color: colors.textMuted, fontSize: 14, lineHeight: 21 },
}))

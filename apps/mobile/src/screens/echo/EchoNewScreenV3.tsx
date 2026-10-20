import Feather from '@expo/vector-icons/Feather'
import { ECHO_BACK_MAX_LENGTH, ECHO_FRONT_MAX_LENGTH, PLAN_LIMITS } from '@langx/shared'
import { useMemo, useRef, useState } from 'react'
import { Text, View } from 'react-native'
import { useCaptureEcho, useMe } from '../../api/queries'
import { FieldV3 } from '../../components/onboarding/WizardV3'
import { SettingsFormScreenV3 } from '../../components/settings/v3/SettingsFormV3'
import { Button } from '../../components/ui/Button'
import { SegmentedControl } from '../../components/ui/SegmentedControl'
import { useDisplayNames, useT } from '../../i18n'
import { showAlert } from '../../lib/alert'
import { track } from '../../lib/analytics'
import { authClient } from '../../lib/auth-client'
import { errorCodeOf } from '../../lib/errors'
import { goBackTo } from '../../lib/navigation'
import { postLanguages, resolvePostLanguage } from '../../lib/postLanguage'
import { requireAccount } from '../../lib/requireAccount'
import { makeStyles, useTheme } from '../../lib/theme'
import { showToast } from '../../lib/toast'
import { newClientId } from '../../lib/unsentMessages'

/**
 * A card written by hand, in the redesign's look (`V-EchoNew`), behind
 * `flags.v3Home`.
 *
 * `echo/new.tsx`'s three fields and its one request, with the same idempotent
 * client id, the same account check and the same ceiling alert. The block
 * under the fields says what becomes of the card, which the drawing adds;
 * the yellow Save sits at the foot.
 */
export function EchoNewScreenV3() {
  const styles = useStyles()
  const { v3 } = useTheme()
  const t = useT()
  const names = useDisplayNames()
  const { data: session } = authClient.useSession()

  const me = useMe()
  const capture = useCaptureEcho()

  const [front, setFront] = useState('')
  const [back, setBack] = useState('')
  const [chosenLanguage, setChosenLanguage] = useState<string | null>(null)

  const languages = useMemo(() => postLanguages(me.data?.learning), [me.data])
  const language = resolvePostLanguage(languages, chosenLanguage)

  // Minted once for this screen, not per attempt: a retried save writes the
  // card the first attempt may already have written.
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
      track({ name: 'echo_card_captured', properties: { source: 'manual' } })
      close()
      showToast(t('echo.added'))
    } catch (error) {
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
    <SettingsFormScreenV3
      title={t('echo.newTitle')}
      onBack={close}
      footer={
        <Button
          label={t('common.save')}
          icon="check"
          onPress={() => void save()}
          loading={capture.isPending}
          disabled={!front.trim() || !language}
        />
      }
    >
      {languages.length > 1 ? (
        <View style={styles.block}>
          <Text style={styles.label}>{t('echo.cardLanguage')}</Text>
          <SegmentedControl
            options={languages.map((code) => ({ value: code, label: names.language(code) }))}
            selected={language ? [language] : []}
            onToggle={setChosenLanguage}
            accessibilityLabel={t('echo.cardLanguage')}
          />
        </View>
      ) : null}

      <FieldV3
        label={t('echo.editFront')}
        value={front}
        onChangeText={setFront}
        maxLength={ECHO_FRONT_MAX_LENGTH}
        multiline
        autoFocus
        autoCorrect
      />
      {/* Said out loud, because an empty field that fills itself is a
          surprise unless it was offered. */}
      <FieldV3
        label={t('echo.editBack')}
        hint={t('echo.backHint')}
        value={back}
        onChangeText={setBack}
        maxLength={ECHO_BACK_MAX_LENGTH}
        multiline
        autoCorrect
      />

      <View style={styles.note}>
        <View style={styles.noteMark}>
          <Feather name="edit-2" size={v3.icon.lg} color={v3.colors.echoText} />
        </View>
        <View style={styles.noteText}>
          <Text style={styles.noteTitle}>{t('echo.fromYourself')}</Text>
          <Text style={styles.noteBody}>{t('echo.newNote')}</Text>
        </View>
      </View>
    </SettingsFormScreenV3>
  )
}

const useStyles = makeStyles(({ v3 }) => ({
  block: { gap: v3.space[8] },
  label: { ...v3.type.buttonSmall, color: v3.colors.fg, paddingStart: v3.space[4] },
  note: {
    alignItems: 'flex-start',
    backgroundColor: v3.colors.surface,
    borderRadius: v3.radius.tile,
    flexDirection: 'row',
    gap: v3.space[12],
    paddingHorizontal: v3.space[16],
    paddingVertical: v3.space[14],
  },
  noteMark: {
    alignItems: 'center',
    backgroundColor: v3.colors.echoTint,
    borderRadius: v3.radius.icon,
    height: 40,
    justifyContent: 'center',
    width: 40,
  },
  noteText: { flex: 1, gap: v3.space[2], minWidth: 0 },
  noteTitle: { ...v3.type.button, color: v3.colors.fg },
  noteBody: { ...v3.type.callout, color: v3.colors.muted },
}))

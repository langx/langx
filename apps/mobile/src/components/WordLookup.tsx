import { ECHO_BACK_MAX_LENGTH, PLAN_LIMITS, type LanguageCode } from '@langx/shared'
import { useEffect, useState } from 'react'
import { ActivityIndicator, Text, View } from 'react-native'
import { useCaptureEcho, useTranslate } from '../api/queries'
import { Button } from './ui/Button'
import { useT } from '../i18n'
import { track } from '../lib/analytics'
import { errorCodeOf } from '../lib/errors'
import { makeStyles, useTheme } from '../lib/theme'
import { wordCardClientId } from '../lib/wordLookup'

type Translation =
  | { status: 'loading' }
  | { status: 'done'; text: string }
  | { status: 'quota' }
  | { status: 'failed' }

type Keeping = 'idle' | 'saving' | 'added' | 'already' | 'limit' | 'failed'

/**
 * One word of a message: what it means, and a card for it.
 *
 * Drawn inside `MessagePartsSheet`, which is a `Modal`, so every outcome is
 * said here rather than in an alert or a toast: a toast draws under an open
 * `Modal`, an alert would stack a second one on top of it, and a refusal
 * nobody sees reads as a tap that did nothing. Keyed by message and word at
 * the call site, so picking another word starts from a clean slate.
 *
 * The translation is the same `POST /translate` a whole message uses, so a
 * word looked up twice is served from the server's cache and costs one
 * translation from `translationsPer24h`, not two.
 */
export function WordLookup({
  word,
  messageId,
  targetLang,
  cardLang,
  onSeePlans,
}: {
  word: string
  messageId: string
  /** The reader's language, the same one Translate writes into. */
  targetLang: string
  /** What the card is filed under; `undefined` leaves the button out. */
  cardLang: LanguageCode | undefined
  onSeePlans: () => void
}) {
  const styles = useStyles()
  const { colors } = useTheme()
  const t = useT()
  const { mutateAsync: translate } = useTranslate()
  const capture = useCaptureEcho()
  const [translation, setTranslation] = useState<Translation>({ status: 'loading' })
  const [keeping, setKeeping] = useState<Keeping>('idle')

  useEffect(() => {
    // An answer for a word no longer on screen is dropped rather than shown
    // under the next one.
    let live = true
    translate({ text: word, targetLang }).then(
      (result) => {
        if (live) setTranslation({ status: 'done', text: result.translatedText.trim() })
      },
      (error: unknown) => {
        if (!live) return
        setTranslation({ status: errorCodeOf(error) === 'QUOTA_EXCEEDED' ? 'quota' : 'failed' })
      },
    )
    return () => {
      live = false
    }
  }, [word, targetLang, translate])

  async function keep(back: string): Promise<void> {
    if (!cardLang || keeping === 'saving') return
    setKeeping('saving')
    try {
      const result = await capture.mutateAsync({
        source: {
          kind: 'manual',
          // Derived from the message and the word, so a second tap — now or
          // after the sheet was closed — lands on the card the first one made.
          clientId: wordCardClientId(messageId, word),
          front: word,
          // Omitted rather than cut when it does not fit: an absent back asks
          // the server for a translation of its own.
          ...(back && back.length <= ECHO_BACK_MAX_LENGTH ? { back } : {}),
          lang: cardLang,
        },
      })
      if (result.created) track({ name: 'echo_card_captured', properties: { source: 'manual' } })
      setKeeping(result.created ? 'added' : 'already')
    } catch (error) {
      // A ceiling, the same on every plan, so it is explained and not sold —
      // as the whole-message capture does.
      setKeeping(errorCodeOf(error) === 'QUOTA_EXCEEDED' ? 'limit' : 'failed')
    }
  }

  return (
    <View style={styles.root} accessibilityLiveRegion="polite">
      <Text style={styles.word}>{word}</Text>

      {translation.status === 'loading' ? (
        <View style={styles.row}>
          <ActivityIndicator size="small" color={colors.textMuted} />
          <Text style={styles.muted}>{t('chat.translating')}</Text>
        </View>
      ) : translation.status === 'quota' ? (
        <>
          <Text style={styles.muted}>{t('chat.translationQuota')}</Text>
          <Button label={t('chat.wordSeePlans')} variant="secondary" onPress={onSeePlans} />
        </>
      ) : translation.status === 'failed' ? (
        <Text style={styles.muted}>{t('chat.wordTranslationFailed')}</Text>
      ) : (
        <>
          <Text style={styles.translation}>{translation.text}</Text>
          {cardLang ? (
            keeping === 'added' || keeping === 'already' ? (
              <Text style={styles.done}>
                {t(keeping === 'added' ? 'echo.added' : 'echo.alreadyAdded')}
              </Text>
            ) : (
              <>
                {keeping === 'limit' || keeping === 'failed' ? (
                  <Text style={styles.muted}>
                    {keeping === 'limit'
                      ? t('echo.limitBody', { count: PLAN_LIMITS.free.echoCapturesPerDay ?? 0 })
                      : t('echo.addFailedTitle')}
                  </Text>
                ) : null}
                <Button
                  label={t('messageActions.echo')}
                  variant="secondary"
                  loading={keeping === 'saving'}
                  onPress={() => void keep(translation.text)}
                />
              </>
            )
          ) : null}
        </>
      )}
    </View>
  )
}

const useStyles = makeStyles(({ colors, font, spacing }) => ({
  root: { gap: spacing.sm },
  row: { alignItems: 'center', flexDirection: 'row', gap: spacing.sm },
  word: { ...font.label, color: colors.textMuted },
  translation: { ...font.body, color: colors.text, fontSize: 17, lineHeight: 24 },
  muted: { ...font.body, color: colors.textMuted },
  done: { ...font.label, color: colors.success },
}))

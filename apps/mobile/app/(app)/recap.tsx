import Feather from '@expo/vector-icons/Feather'
import { useLocalSearchParams } from 'expo-router'
import { useState } from 'react'
import { Text, View } from 'react-native'
import { useMe, useMonthlyRecap } from '../../src/api/queries'
import { ShareCardSheet, type ShareCardRequest } from '../../src/components/ShareCardSheet'
import { Button } from '../../src/components/ui/Button'
import { Screen } from '../../src/components/ui/Screen'
import { ScreenHeader } from '../../src/components/ui/ScreenHeader'
import { Skeleton } from '../../src/components/ui/Skeleton'
import { useLocale, useT } from '../../src/i18n'
import { goBackTo } from '../../src/lib/navigation'
import { monthName } from '../../src/lib/recapMonth'
import { recapShareText } from '../../src/lib/shareText'
import { makeStyles, useTheme } from '../../src/lib/theme'
import { useScreenInteractive } from '../../src/hooks/useScreenInteractive'

/**
 * A finished month, in the numbers the server counted.
 *
 * Every figure comes from `GET /me/recap`; nothing is summed on the device, so
 * the screen, the card and the monthly email agree. The streak is labelled as
 * the current one because that is all the server stores — a month's streak
 * would be a number nobody recorded.
 */
export default function RecapScreen() {
  useScreenInteractive()
  const t = useT()
  const styles = useStyles()
  const { colors } = useTheme()
  const { locale } = useLocale()
  const params = useLocalSearchParams<{ month: string }>()
  const month = typeof params.month === 'string' ? params.month : ''
  const recap = useMonthlyRecap(month)
  const me = useMe()
  const [card, setCard] = useState<ShareCardRequest | null>(null)
  const name = month ? monthName(month, locale) : ''

  const data = recap.data
  const quiet = data ? data.messages + data.corrections + data.echoReviews === 0 : false

  return (
    <Screen scroll>
      <ScreenHeader
        title={t('recap.title', { month: name })}
        onBack={() => goBackTo('/(app)/(tabs)/me')}
      />
      {recap.isPending ? (
        <View style={styles.list}>
          <Skeleton height={28} />
          <Skeleton height={28} />
          <Skeleton height={28} />
        </View>
      ) : !data ? (
        <Text style={styles.muted}>{t('recap.failed')}</Text>
      ) : (
        <>
          <View style={styles.list}>
            <Text style={styles.line}>{t('recap.messages', { count: data.messages })}</Text>
            <Text style={styles.line}>{t('recap.corrections', { count: data.corrections })}</Text>
            <Text style={styles.line}>{t('recap.echoReviews', { count: data.echoReviews })}</Text>
            <Text style={styles.line}>{t('recap.tokens', { count: data.tokens })}</Text>
            <Text style={styles.muted}>
              {t('recap.currentStreak', { count: data.currentStreak })}
            </Text>
          </View>
          {quiet ? <Text style={styles.muted}>{t('recap.quiet')}</Text> : null}
          {/* Nothing to share from an empty month — same rule as the streak. */}
          {!quiet && me.data ? (
            <Button
              label={t('recap.share')}
              variant="secondary"
              icon={<Feather name="share" size={18} color={colors.accent} />}
              onPress={() =>
                setCard({
                  kind: 'recap',
                  headline: name,
                  caption: t('recap.cardCaption'),
                  fallback: recapShareText(t, {
                    month: name,
                    messages: data.messages,
                    reviews: data.echoReviews,
                    handle: me.data.handle,
                  }),
                })
              }
            />
          ) : null}
        </>
      )}
      <ShareCardSheet request={card} onClose={() => setCard(null)} />
    </Screen>
  )
}

const useStyles = makeStyles(({ colors, font, spacing }) => ({
  list: { gap: spacing.md, paddingBottom: spacing.lg, paddingTop: spacing.md },
  line: { ...font.heading, color: colors.text, fontSize: 20 },
  muted: { color: colors.textMuted, fontSize: 15, lineHeight: 22, paddingBottom: spacing.md },
}))

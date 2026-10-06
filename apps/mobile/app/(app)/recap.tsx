import Feather from '@expo/vector-icons/Feather'
import { Nunito_900Black } from '@expo-google-fonts/nunito/900Black'
import { useFonts } from 'expo-font'
import { useLocalSearchParams } from 'expo-router'
import { StatusBar } from 'expo-status-bar'
import { useState, type ReactNode } from 'react'
import { ActivityIndicator, Pressable, Text, View } from 'react-native'
import { useSafeAreaInsets } from 'react-native-safe-area-context'
import { useMe, useMonthlyRecap, useYearlyRecap } from '../../src/api/queries'
import { RecapStory } from '../../src/components/recap/RecapStory'
import { ShareCardSheet, type ShareCardRequest } from '../../src/components/ShareCardSheet'
import { useDisplayNames, useLocale, useT } from '../../src/i18n'
import { track } from '../../src/lib/analytics'
import { goBackTo } from '../../src/lib/navigation'
import { monthName, recapMonthParam, recapYearParam } from '../../src/lib/recapMonth'
import { isQuietRecap, recapCardInput, type RecapSlide } from '../../src/lib/recapStory'
import { shareLink } from '../../src/lib/share'
import { recapShareText } from '../../src/lib/shareText'
import { DISPLAY_FONT, palettes } from '../../src/lib/theme'
import { useScreenInteractive } from '../../src/hooks/useScreenInteractive'

/**
 * A finished month, told as a story: "Your Month" — or, with `?year=`, the
 * same story over twelve of them: "Your Year".
 *
 * Every figure comes from `GET /me/recap`; nothing is summed on the device, so
 * the story, the card and the monthly email agree. The streak is labelled as
 * the current one because that is all the server stores — a month's streak
 * would be a number nobody recorded.
 *
 * The slides are `RecapStory`; this screen is what surrounds them — loading,
 * a month that failed to load, a quiet month that gets one sentence rather
 * than six slides of zeroes — and the share that the last slide asks for.
 */
export default function RecapScreen() {
  const t = useT()
  const { locale } = useLocale()
  const names = useDisplayNames()
  const params = useLocalSearchParams<{ month: string; year: string }>()
  // `?year=2026` is "Your Year"; anything else is a month's recap. Both
  // queries are always declared — hooks cannot be conditional — and the one
  // not asked for is disabled by the empty key it is given.
  const yearKey = recapYearParam(params.year)
  const month = yearKey ? '' : recapMonthParam(params.month, new Date())
  const monthly = useMonthlyRecap(month)
  const yearly = useYearlyRecap(yearKey ?? '')
  const recap = yearKey ? yearly : monthly
  const me = useMe()
  const [card, setCard] = useState<ShareCardRequest | null>(null)
  // Only the story's numerals and month name want the heaviest weight, so it
  // is loaded here rather than at launch; until it arrives they are set in the
  // display face, one step lighter.
  const [blackLoaded] = useFonts({ Nunito_900Black })
  useScreenInteractive(!recap.isPending)

  // A year's headline is the year itself, so it is not said again beside it.
  const headlineYear = (key: string): string =>
    Number(key.slice(0, 4)).toLocaleString(locale, { useGrouping: false })
  const name = yearKey
    ? headlineYear(yearKey)
    : month
      ? capitalise(monthName(month, locale), locale)
      : ''
  const year = !yearKey && month ? headlineYear(month) : ''
  const close = (): void => goBackTo('/(app)/(tabs)/me')

  const profile = me.data
  const native = profile?.nativeLanguages[0]?.code
  const learning = [...(profile?.learning ?? [])].sort((a, b) => a.priority - b.priority)[0]?.code
  const languages =
    native && learning
      ? { native: names.language(native), learning: names.language(learning) }
      : undefined

  const data = recap.data
  if (recap.isPending) {
    return (
      <Plain>
        <ActivityIndicator color={palettes.light.colors.primaryText} />
      </Plain>
    )
  }
  if (!data) {
    return (
      <Plain onClose={close} closeLabel={t('recap.story.close')}>
        <Text style={plainText}>{t('recap.failed')}</Text>
      </Plain>
    )
  }
  if (isQuietRecap(data)) {
    return (
      <Plain onClose={close} closeLabel={t('recap.story.close')}>
        <Text style={[plainText, { fontSize: 44, lineHeight: 48 }]}>{name}</Text>
        <Text style={plainText}>{yearKey ? t('recap.year.quiet') : t('recap.quiet')}</Text>
      </Plain>
    )
  }

  const fallback = profile
    ? recapShareText(t, {
        month: name,
        messages: data.messages,
        reviews: data.echoReviews,
        handle: profile.handle,
      })
    : null

  // Every slide shares through the same sheet; only the summary is the
  // poster, and any other slide asks the server for a card of itself.
  const share = (slide?: RecapSlide): void => {
    if (!fallback) return
    setCard({
      kind: 'recap',
      headline: name,
      caption: yearKey ? t('recap.year.cardCaption') : t('recap.cardCaption'),
      fallback,
      recap: recapCardInput(t, data, locale, languages, slide),
    })
  }

  return (
    <>
      <RecapStory
        recap={data}
        month={name}
        year={year}
        me={profile}
        {...(languages ? { languages: t('recap.card.languages', languages) } : {})}
        {...(blackLoaded ? { blackFont: 'Nunito_900Black' } : {})}
        onClose={close}
        onShare={() => share()}
        onShareSlide={share}
        paused={card !== null}
        onJustLink={() => {
          if (fallback) void shareLink(fallback)
        }}
        onViewed={({ slides, completed }) =>
          track({
            name: 'recap_story_viewed',
            properties: { slides_seen: slides, completed, period: yearKey ? 'year' : 'month' },
          })
        }
      />
      <ShareCardSheet request={card} onClose={() => setCard(null)} />
    </>
  )
}

/** "septembre" → "Septembre": on the story the month is a headline. */
function capitalise(text: string, locale: string): string {
  const [first = '', ...rest] = [...text]
  return first.toLocaleUpperCase(locale) + rest.join('')
}

const plainText = {
  color: palettes.light.colors.primaryText,
  fontFamily: DISPLAY_FONT,
  fontSize: 22,
  lineHeight: 28,
} as const

/**
 * The intro slide's yellow, with nothing on it but what the state needs: a
 * spinner, the failure, or a quiet month's one sentence.
 */
function Plain({
  children,
  onClose,
  closeLabel,
}: {
  children: ReactNode
  onClose?: () => void
  closeLabel?: string
}) {
  const insets = useSafeAreaInsets()
  const ink = palettes.light.colors.primaryText
  return (
    <View
      style={{
        backgroundColor: palettes.light.colors.primary,
        flex: 1,
        gap: 16,
        justifyContent: 'center',
        paddingBottom: insets.bottom + 32,
        paddingHorizontal: 28,
        paddingTop: insets.top + 32,
      }}
    >
      <StatusBar style="dark" />
      {onClose ? (
        <Pressable
          accessibilityRole="button"
          accessibilityLabel={closeLabel}
          hitSlop={8}
          onPress={onClose}
          style={{
            alignItems: 'center',
            backgroundColor: 'rgba(23, 25, 28, 0.08)',
            borderRadius: 18,
            end: 20,
            height: 36,
            justifyContent: 'center',
            position: 'absolute',
            top: insets.top + 24,
            width: 36,
          }}
        >
          <Feather name="x" size={18} color={ink} />
        </Pressable>
      ) : null}
      {children}
    </View>
  )
}

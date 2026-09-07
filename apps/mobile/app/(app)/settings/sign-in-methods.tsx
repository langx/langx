import { Ionicons } from '@expo/vector-icons'
import Feather from '@expo/vector-icons/Feather'
import type { LinkedProvider } from '@langx/shared'
import { router } from 'expo-router'
import { Text, View } from 'react-native'
import { Button } from '../../../src/components/ui/Button'
import { ListRow } from '../../../src/components/ui/ListRow'
import { Screen } from '../../../src/components/ui/Screen'
import { ScreenHeader } from '../../../src/components/ui/ScreenHeader'
import { Skeleton } from '../../../src/components/ui/Skeleton'
import { useSignInMethods } from '../../../src/hooks/useSignInMethods'
import { useScreenInteractive } from '../../../src/hooks/useScreenInteractive'
import { useT } from '../../../src/i18n'
import { goBackTo } from '../../../src/lib/navigation'
import { makeStyles, useTheme } from '../../../src/lib/theme'

/** Providers keep their own names — neither Google's nor Apple's is translated. */
const PROVIDER_NAMES: Record<LinkedProvider, string> = { google: 'Google', apple: 'Apple' }

/**
 * What this account can be signed in with, and the one thing that can be
 * added from here.
 *
 * The screen exists for a specific person: somebody who tapped "Continue with
 * Apple" once and has no password. Nothing else in the app tells them that,
 * and they find out at the worst possible moment — on a device where the Apple
 * sheet is not available, or after losing access to the Apple ID. So the
 * password row is the first thing, and when it is the *only* way in the screen
 * says so in words rather than leaving them to infer it from a list.
 *
 * The password row opens its own screen rather than unfolding a form here.
 * It looks like every other settings row, so it gets tapped like one — and for
 * a while it answered that tap with nothing, which read as broken on both
 * sides of `hasPassword`.
 *
 * Linking and unlinking are deliberately not here. Unlinking needs a rule
 * about the last remaining method before it can be offered safely, and a row
 * that can lock somebody out is worse than a row that is missing.
 */
export default function SignInMethodsScreen() {
  useScreenInteractive()
  const styles = useStyles()
  const { colors } = useTheme()
  const t = useT()
  const methods = useSignInMethods()
  const data = methods.data

  return (
    <Screen scroll>
      <ScreenHeader
        title={t('settings.signInMethods')}
        onBack={() => goBackTo('/(app)/settings/account')}
      />

      {data ? (
        <>
          <Text style={styles.intro}>{t('settings.signInIdentifiers')}</Text>
          <ListRow title={t('auth.email')} value={data.email} />
          <ListRow title={t('onboarding.username')} value={`@${data.handle}`} />
          <ListRow
            title={t('settings.signInPasswordTitle')}
            value={data.hasPassword ? undefined : t('settings.signInPasswordNotSet')}
            accessory={
              data.hasPassword ? (
                <View style={styles.set}>
                  <Feather name="check" size={16} color={colors.success} />
                  <Text style={styles.setText}>{t('settings.signInPasswordSet')}</Text>
                </View>
              ) : undefined
            }
            onPress={() => router.push('/(app)/settings/password')}
          />
          {!data.hasPassword && data.linked.length > 0 ? (
            <Text style={styles.warning}>{t('settings.signInOnlyProvider')}</Text>
          ) : null}

          <Text style={styles.kicker}>{t('settings.signInConnected')}</Text>
          {data.linked.length === 0 ? (
            <ListRow title={t('settings.signInNoneConnected')} last />
          ) : (
            data.linked.map((account, index) => (
              /*
               * Local rather than a `ListRow`: the provider's mark leads the
               * row, and `ListRow` has no slot before the title. Same metrics.
               */
              <View
                key={account.provider}
                style={[styles.provider, index < data.linked.length - 1 && styles.divided]}
              >
                <ProviderMark provider={account.provider} />
                <View style={styles.providerText}>
                  <Text style={styles.providerName}>{PROVIDER_NAMES[account.provider]}</Text>
                  <Text style={styles.providerMeta}>
                    {t('settings.signInConnectedSince', {
                      date: new Date(account.linkedAt).toLocaleDateString(),
                    })}
                  </Text>
                </View>
              </View>
            ))
          )}
        </>
      ) : methods.isError ? (
        /*
         * Said out loud rather than left blank. This is the screen somebody
         * opens when they are worried about getting locked out; a header over
         * empty space tells them nothing and offers nothing to tap.
         */
        <View style={styles.retry}>
          <Text style={styles.intro}>{t('common.retry')}</Text>
          <Button label={t('common.tryAgain')} onPress={() => void methods.refetch()} />
        </View>
      ) : (
        <View style={styles.loading}>
          <Skeleton width="55%" />
          <Skeleton height={52} />
          <Skeleton height={52} />
          <Skeleton width="30%" style={styles.loadingGap} />
          <Skeleton height={52} />
        </View>
      )}
    </Screen>
  )
}

/**
 * The provider's own mark, 20px. Apple's is a glyph; Google's is its
 * four-colour disc, drawn as quadrants in a clipped circle. The four are
 * Google's brand colours, not palette tokens — the mark is theirs and does not
 * change with the scheme, which is also why the quadrants are placed with
 * `left`/`right` and never mirror.
 */
function ProviderMark({ provider }: { provider: LinkedProvider }) {
  const styles = useStyles()
  const { colors } = useTheme()
  if (provider === 'apple') return <Ionicons name="logo-apple" size={20} color={colors.text} />
  return (
    <View style={styles.googleMark} accessibilityElementsHidden>
      <View style={[styles.quadrant, styles.quadrantBlue]} />
      <View style={[styles.quadrant, styles.quadrantRed]} />
      <View style={[styles.quadrant, styles.quadrantGreen]} />
      <View style={[styles.quadrant, styles.quadrantYellow]} />
    </View>
  )
}

const useStyles = makeStyles(({ colors, font, spacing, radius }) => ({
  intro: {
    color: colors.textMuted,
    fontSize: 15,
    lineHeight: 23,
    paddingBottom: 10,
    paddingTop: 6,
  },
  /** "Set", with its check, in the success pair: the one reassuring readout here. */
  set: { alignItems: 'center', flexDirection: 'row', gap: 6 },
  setText: { color: colors.success, fontSize: 14, fontWeight: '600' },
  warning: { ...font.body, color: colors.text, marginTop: spacing.md },
  kicker: {
    color: colors.textFaint,
    fontSize: 12,
    fontWeight: '700',
    letterSpacing: 0.5,
    paddingBottom: spacing.xs,
    paddingTop: 22,
    textTransform: 'uppercase',
  },
  provider: { alignItems: 'center', flexDirection: 'row', gap: 14, paddingVertical: spacing.lg },
  divided: { borderBottomColor: colors.border, borderBottomWidth: 1 },
  providerText: { flex: 1, gap: 2 },
  providerName: { color: colors.text, fontSize: 17, fontWeight: '600' },
  providerMeta: { color: colors.textMuted, fontSize: 14 },
  googleMark: { borderRadius: radius.pill, height: 20, overflow: 'hidden', width: 20 },
  quadrant: { height: 10, position: 'absolute', width: 10 },
  quadrantBlue: { backgroundColor: '#4285f4', left: 0, top: 0 },
  quadrantRed: { backgroundColor: '#ea4335', right: 0, top: 0 },
  quadrantGreen: { backgroundColor: '#34a853', bottom: 0, left: 0 },
  quadrantYellow: { backgroundColor: '#fbbc05', bottom: 0, right: 0 },
  retry: { gap: spacing.md, marginTop: spacing.md },
  loading: { gap: spacing.sm, marginTop: spacing.md },
  loadingGap: { marginTop: spacing.lg },
}))

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
import { makeStyles } from '../../../src/lib/theme'

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
          <ListRow title={data.email} />
          <ListRow title={`@${data.handle}`} last />

          <Text style={styles.heading}>{t('settings.signInPasswordTitle')}</Text>
          <ListRow
            title={t('settings.signInPasswordTitle')}
            value={
              data.hasPassword
                ? t('settings.signInPasswordSet')
                : t('settings.signInPasswordNotSet')
            }
            onPress={() => router.push('/(app)/settings/password')}
            last
          />
          {!data.hasPassword && data.linked.length > 0 ? (
            <Text style={styles.warning}>{t('settings.signInOnlyProvider')}</Text>
          ) : null}

          <Text style={styles.heading}>{t('settings.signInConnected')}</Text>
          {data.linked.length === 0 ? (
            <ListRow title={t('settings.signInNoneConnected')} last />
          ) : (
            data.linked.map((account, index) => (
              <ListRow
                key={account.provider}
                title={PROVIDER_NAMES[account.provider]}
                subtitle={t('settings.signInConnectedSince', {
                  date: new Date(account.linkedAt).toLocaleDateString(),
                })}
                last={index === data.linked.length - 1}
              />
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

const useStyles = makeStyles(({ colors, font, spacing }) => ({
  intro: { ...font.caption, color: colors.textMuted, marginTop: spacing.md },
  heading: { ...font.heading, color: colors.text, marginTop: spacing.lg },
  warning: { ...font.body, color: colors.text, marginTop: spacing.md },
  retry: { gap: spacing.md, marginTop: spacing.md },
  loading: { gap: spacing.sm, marginTop: spacing.md },
  loadingGap: { marginTop: spacing.lg },
}))

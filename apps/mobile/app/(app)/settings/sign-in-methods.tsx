import Feather from '@expo/vector-icons/Feather'
import { LINKED_PROVIDERS, type LinkedProvider } from '@langx/shared'
import { router, useFocusEffect } from 'expo-router'
import { useCallback } from 'react'
import { Pressable, Text, View } from 'react-native'
import { ProviderMark } from '../../../src/components/ProviderMark'
import { Button } from '../../../src/components/ui/Button'
import { ListRow } from '../../../src/components/ui/ListRow'
import { Screen } from '../../../src/components/ui/Screen'
import { ScreenHeader } from '../../../src/components/ui/ScreenHeader'
import { Skeleton } from '../../../src/components/ui/Skeleton'
import { useAppConfig } from '../../../src/hooks/useAppConfig'
import {
  useLinkProvider,
  useSignInMethods,
  useUnlinkProvider,
} from '../../../src/hooks/useSignInMethods'
import { useScreenInteractive } from '../../../src/hooks/useScreenInteractive'
import { useT } from '../../../src/i18n'
import { confirmAlert } from '../../../src/lib/alert'
import { goBackTo } from '../../../src/lib/navigation'
import { makeStyles, useTheme } from '../../../src/lib/theme'
import { showToast } from '../../../src/lib/toast'

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
 * Connect and Disconnect sit on each provider's row, as the design draws
 * them. Disconnect is withheld — not merely refused — when the link is the only
 * way in: the server would say no (`allowUnlinkingAll` is off), but a button
 * that can only fail is worse than a line that says why it is not there.
 */
export default function SignInMethodsScreen() {
  useScreenInteractive()
  const styles = useStyles()
  const { colors } = useTheme()
  const t = useT()
  const methods = useSignInMethods()
  const data = methods.data
  const offered = useAppConfig().data?.authProviders
  const link = useLinkProvider()
  const unlink = useUnlinkProvider()

  // A browser-based link comes back to this screen; the list is stale then.
  // `refetch` is the stable reference, not the query object, which is new on
  // every render and would refetch in a loop.
  const refetch = methods.refetch
  useFocusEffect(
    useCallback(() => {
      void refetch()
    }, [refetch]),
  )

  async function connect(provider: LinkedProvider): Promise<void> {
    try {
      const outcome = await link.mutateAsync(provider)
      if (outcome === 'linked') showToast(t('settings.signInLinked'))
    } catch {
      showToast(t('settings.signInLinkFailed'))
    }
  }

  async function disconnect(provider: LinkedProvider, accountId: string): Promise<void> {
    const yes = await confirmAlert({
      title: t('settings.signInDisconnect'),
      message: t('settings.signInDisconnectConfirm', { provider: PROVIDER_NAMES[provider] }),
      confirmLabel: t('settings.signInDisconnect'),
      destructive: true,
    })
    if (!yes) return
    try {
      await unlink.mutateAsync(accountId)
      showToast(t('settings.signInUnlinked'))
    } catch {
      showToast(t('settings.signInUnlinkFailed'))
    }
  }

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
          {/*
            One row per provider this build offers, connected or not, so the
            way to connect is where the connection will be shown. A provider
            linked before the build stopped offering it still gets its row:
            it can be disconnected, and hiding it would hide a way in.
          */}
          {LINKED_PROVIDERS.filter(
            (provider) =>
              offered?.[provider] || data.linked.some((account) => account.provider === provider),
          ).map((provider, index, rows) => {
            const account = data.linked.find((row) => row.provider === provider)
            // The only way in: no password and nothing else linked.
            const lastWayIn = account !== undefined && !data.hasPassword && data.linked.length === 1
            const busy = link.isPending || unlink.isPending
            return (
              /*
               * Local rather than a `ListRow`: the provider's mark leads the
               * row, and `ListRow` has no slot before the title. Same metrics.
               */
              <View
                key={provider}
                style={[styles.provider, index < rows.length - 1 && styles.divided]}
              >
                <ProviderMark provider={provider} />
                <View style={styles.providerText}>
                  <Text style={styles.providerName}>{PROVIDER_NAMES[provider]}</Text>
                  <Text style={styles.providerMeta}>
                    {account
                      ? lastWayIn
                        ? t('settings.signInLastMethod')
                        : t('settings.signInConnectedSince', {
                            date: new Date(account.linkedAt).toLocaleDateString(),
                          })
                      : t('settings.signInNoneConnected')}
                  </Text>
                </View>
                {account ? (
                  lastWayIn ? null : (
                    <Pressable
                      accessibilityRole="button"
                      disabled={busy}
                      hitSlop={8}
                      onPress={() => void disconnect(provider, account.id)}
                      style={({ pressed }) => pressed && styles.pressed}
                    >
                      <Text style={styles.disconnect}>{t('settings.signInDisconnect')}</Text>
                    </Pressable>
                  )
                ) : (
                  <Pressable
                    accessibilityRole="button"
                    disabled={busy}
                    hitSlop={8}
                    onPress={() => void connect(provider)}
                    style={({ pressed }) => pressed && styles.pressed}
                  >
                    <Text style={styles.connect}>{t('settings.signInConnect')}</Text>
                  </Pressable>
                )}
              </View>
            )
          })}
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
  // Text actions, as the design draws them: the accent to add, the danger to remove.
  connect: { color: colors.accent, fontSize: 14, fontWeight: '600' },
  disconnect: { color: colors.danger, fontSize: 14, fontWeight: '600' },
  pressed: { opacity: 0.6 },
  retry: { gap: spacing.md, marginTop: spacing.md },
  loading: { gap: spacing.sm, marginTop: spacing.md },
  loadingGap: { marginTop: spacing.lg },
}))

import Feather from '@expo/vector-icons/Feather'
import { LINKED_PROVIDERS, type LinkedProvider } from '@langx/shared'
import { router, useFocusEffect } from 'expo-router'
import { useCallback } from 'react'
import { Pressable, Text, View } from 'react-native'
import { ProviderMark } from '../../components/ProviderMark'
import {
  SettingsGroupV3,
  SettingsHeadingV3,
  SettingsItemV3,
  SettingsScreenV3,
} from '../../components/settings/v3/SettingsKitV3'
import { SettingsLeadV3, SettingsNoteV3 } from '../../components/settings/v3/SettingsFormV3'
import { Button } from '../../components/ui/Button'
import { Skeleton } from '../../components/ui/Skeleton'
import { useAppConfig } from '../../hooks/useAppConfig'
import {
  SESSION_NOT_FRESH,
  useLinkProvider,
  useSignInMethods,
  useUnlinkProvider,
} from '../../hooks/useSignInMethods'
import { useScreenInteractive } from '../../hooks/useScreenInteractive'
import { useLocale, useT } from '../../i18n'
import { confirmAlert } from '../../lib/alert'
import { makeStyles, useTheme } from '../../lib/theme'
import { showToast } from '../../lib/toast'

/** Providers keep their own names — none of them is translated. */
const PROVIDER_NAMES: Record<LinkedProvider, string> = {
  google: 'Google',
  apple: 'Apple',
  facebook: 'Facebook',
  discord: 'Discord',
}

/**
 * What this account can be signed in with, in the redesign's look
 * (`V-SetSignInMethods`), behind `flags.v3Home`. Which providers get a row,
 * when Disconnect is withheld, the confirmation and every word are
 * `settings/sign-in-methods.tsx`'s; see it for why.
 */
export function SignInMethodsScreenV3() {
  useScreenInteractive()
  const styles = useStyles()
  const { v3 } = useTheme()
  const { isRtl } = useLocale()
  const t = useT()
  const methods = useSignInMethods()
  const data = methods.data
  const offered = useAppConfig().data?.authProviders
  const link = useLinkProvider()
  const unlink = useUnlinkProvider()

  // A browser-based link comes back to this screen; the list is stale then.
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
    } catch (error) {
      showToast(
        error instanceof Error && error.message === SESSION_NOT_FRESH
          ? t('settings.signInUnlinkSignInAgain')
          : t('settings.signInUnlinkFailed'),
      )
    }
  }

  return (
    <SettingsScreenV3 title={t('settings.signInMethods')} back="/(app)/settings/account">
      {data ? (
        <>
          <View style={styles.block}>
            <SettingsLeadV3>{t('settings.signInIdentifiers')}</SettingsLeadV3>
            <SettingsGroupV3>
              <SettingsItemV3 icon="mail" hue="sky" title={t('auth.email')} value={data.email} />
              <SettingsItemV3
                icon="at-sign"
                hue="tangerine"
                title={t('onboarding.username')}
                value={`@${data.handle}`}
              />
            </SettingsGroupV3>
          </View>

          <View style={styles.block}>
            <SettingsGroupV3>
              {/*
                Local rather than `SettingsItemV3`: the row opens a page and
                ends in a readout with a check, and the kit's row is either a
                button or carries an accessory, not both.
              */}
              <Pressable
                accessibilityRole="button"
                onPress={() => router.push('/(app)/settings/password')}
                style={({ pressed }) => [styles.row, pressed && styles.pressed]}
              >
                <View style={[styles.square, { backgroundColor: v3.hues.sky }]}>
                  <Feather name="lock" size={v3.icon.lg} color={v3.colors.ink} />
                </View>
                <Text style={styles.rowTitle}>{t('settings.signInPasswordTitle')}</Text>
                {data.hasPassword ? (
                  <View style={styles.set}>
                    <Feather name="check" size={v3.icon.xs} color={v3.colors.correction} />
                    <Text style={styles.setText}>{t('settings.signInPasswordSet')}</Text>
                  </View>
                ) : (
                  <Text style={styles.value}>{t('settings.signInPasswordNotSet')}</Text>
                )}
                <Feather
                  name={isRtl ? 'chevron-left' : 'chevron-right'}
                  size={v3.icon.md}
                  color={v3.colors.muted}
                />
              </Pressable>
            </SettingsGroupV3>
            {!data.hasPassword && data.linked.length > 0 ? (
              <SettingsNoteV3 icon="alert-triangle" hue="tangerine">
                {t('settings.signInOnlyProvider')}
              </SettingsNoteV3>
            ) : null}
          </View>

          <View style={styles.block}>
            <SettingsHeadingV3 title={t('settings.signInConnected')} />
            <SettingsGroupV3>
              {/*
                One row per provider this build offers, connected or not, plus
                any linked before the build stopped offering it — as today.
              */}
              {LINKED_PROVIDERS.filter(
                (provider) =>
                  offered?.[provider] ||
                  data.linked.some((account) => account.provider === provider),
              ).map((provider) => {
                const account = data.linked.find((row) => row.provider === provider)
                const lastWayIn =
                  account !== undefined && !data.hasPassword && data.linked.length === 1
                const busy = link.isPending || unlink.isPending
                return (
                  <View key={provider} style={styles.provider}>
                    <View style={styles.mark}>
                      <ProviderMark provider={provider} />
                    </View>
                    <View style={styles.providerText}>
                      <Text style={styles.rowTitle} numberOfLines={1}>
                        {PROVIDER_NAMES[provider]}
                      </Text>
                      <Text style={styles.meta}>
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
                        <Button
                          label={t('settings.signInDisconnect')}
                          variant="danger"
                          size="small"
                          style={styles.action}
                          disabled={busy}
                          onPress={() => void disconnect(provider, account.id)}
                        />
                      )
                    ) : (
                      <Button
                        label={t('settings.signInConnect')}
                        variant="secondary"
                        size="small"
                        icon="plus"
                        style={styles.action}
                        disabled={busy}
                        onPress={() => void connect(provider)}
                      />
                    )}
                  </View>
                )
              })}
            </SettingsGroupV3>
          </View>
        </>
      ) : methods.isError ? (
        // Said out loud rather than left blank, as today.
        <View style={styles.block}>
          <SettingsLeadV3>{t('common.retry')}</SettingsLeadV3>
          <Button
            label={t('common.tryAgain')}
            variant="secondary"
            onPress={() => void methods.refetch()}
          />
        </View>
      ) : (
        <View style={styles.loading}>
          <Skeleton width="55%" />
          <Skeleton height={124} />
          <Skeleton height={62} />
          <Skeleton width="40%" />
          <Skeleton height={136} />
        </View>
      )}
    </SettingsScreenV3>
  )
}

const useStyles = makeStyles(({ v3 }) => ({
  block: { gap: v3.space[10] },
  loading: { gap: v3.space[12] },
  row: {
    alignItems: 'center',
    borderTopColor: v3.colors.line,
    borderTopWidth: 1,
    flexDirection: 'row',
    gap: v3.space[12],
    minHeight: 62,
    paddingHorizontal: v3.space[12],
    paddingVertical: v3.space[10],
  },
  pressed: { backgroundColor: v3.colors.line },
  square: {
    alignItems: 'center',
    borderRadius: v3.radius.icon,
    height: 40,
    justifyContent: 'center',
    width: 40,
  },
  rowTitle: { ...v3.type.button, color: v3.colors.fg, flexShrink: 1 },
  value: { ...v3.type.callout, color: v3.colors.muted, fontWeight: '600', marginStart: 'auto' },
  /** "Set", with its check, in the correction's green: the one reassuring readout here. */
  set: {
    alignItems: 'center',
    backgroundColor: v3.colors.correctionTint,
    borderRadius: v3.radius.pill,
    flexDirection: 'row',
    gap: v3.space[4],
    marginStart: 'auto',
    minHeight: 30,
    paddingHorizontal: v3.space[10],
  },
  setText: { ...v3.type.callout, color: v3.colors.correction, fontWeight: '700' },
  provider: {
    alignItems: 'center',
    borderTopColor: v3.colors.line,
    borderTopWidth: 1,
    flexDirection: 'row',
    gap: v3.space[12],
    minHeight: 68,
    paddingHorizontal: v3.space[12],
    paddingVertical: v3.space[10],
  },
  // The provider's own mark keeps its colours, on a plain disc.
  mark: {
    alignItems: 'center',
    backgroundColor: v3.colors.bg,
    borderColor: v3.colors.line,
    borderRadius: v3.radius.pill,
    borderWidth: 1.5,
    height: 40,
    justifyContent: 'center',
    width: 40,
  },
  // The kit's Button spans its parent by default, which in a row leaves the name no room.
  action: { flexShrink: 0, width: 'auto' },
  providerText: { flex: 1, gap: v3.space[2], minWidth: 0 },
  meta: { ...v3.type.caption, color: v3.colors.muted },
}))

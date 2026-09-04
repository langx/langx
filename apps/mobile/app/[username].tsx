import {
  countryFlag,
  getCountry,
  HANDLE_PATTERN,
  INVITE_QUERY_PARAM,
  profileUrl,
  type SharedProfile,
} from '@langx/shared'
import { useQuery } from '@tanstack/react-query'
import { Redirect, useLocalSearchParams } from 'expo-router'
import { useEffect } from 'react'
import { ActivityIndicator, Text, View } from 'react-native'
import { api } from '../src/api/client'
import { authClient } from '../src/lib/auth-client'
import { Avatar } from '../src/components/ui/Avatar'
import { Button } from '../src/components/ui/Button'
import { EmptyState } from '../src/components/ui/EmptyState'
import { LevelBars } from '../src/components/ui/LevelBars'
import { Screen } from '../src/components/ui/Screen'
import { FLAG_KEYS, writeFlag } from '../src/lib/localFlags'
import { openExternal } from '../src/lib/openExternal'
import { makeStyles } from '../src/lib/theme'
import { useDisplayNames, useT } from '../src/i18n'
import { useScreenInteractive } from '../src/hooks/useScreenInteractive'

/**
 * `/<handle>` — the address somebody shares for their own profile.
 *
 * At the root of `app/`, which is what puts it *outside* both
 * `Stack.Protected` branches in `_layout.tsx`. That is the whole point: a
 * shared link has to answer for somebody who has never signed in, and every
 * other profile route is behind the session guard.
 *
 * Signed in, it is a redirect — the full screen already exists and knows how
 * to do everything this one cannot. Signed out, it is a card and an invitation,
 * built on `GET /public/profiles/:handle`, which returns a deliberately
 * smaller allow-list than members see.
 *
 * Every top-level route name is therefore a handle nobody may claim; see
 * `RESERVED_HANDLES`. Static routes win over this one, so a collision would
 * not break the app — it would break the *user*, whose link quietly resolves
 * to a screen instead of to them.
 */
export default function SharedProfileScreen() {
  useScreenInteractive()
  const params = useLocalSearchParams<{ username: string; invite?: string }>()
  const handle = (params.username ?? '').toLowerCase()
  /*
   * The web half of the invite flow, and today the only half that fires: the
   * app claims `app.langx.io` while links point at `app.langx.io`, so on a
   * phone an invite link opens a browser rather than the app. This screen is
   * already what that browser lands on.
   *
   * Writing the flag here rather than in `usePendingInvite` because on web the
   * router resolves the URL itself and the hook's `getInitialURL` is not the
   * event that matters.
   */
  const invited = params[INVITE_QUERY_PARAM] === '1' && HANDLE_PATTERN.test(handle)
  useEffect(() => {
    if (invited) void writeFlag(FLAG_KEYS.pendingReferrer, handle)
  }, [invited, handle])
  const styles = useStyles()
  const t = useT()
  const names = useDisplayNames()
  const { data: session, isPending: sessionPending } = authClient.useSession()

  const profile = useQuery({
    queryKey: ['sharedProfile', handle],
    queryFn: () => api.get<SharedProfile>(`/public/profiles/${encodeURIComponent(handle)}`),
    enabled: handle.length > 0 && !session,
    retry: false,
  })

  // Nothing renders until the session is known, or a signed-in user sees the
  // signed-out card flash before being redirected off it.
  if (sessionPending) {
    return (
      <Screen>
        <ActivityIndicator style={styles.loading} />
      </Screen>
    )
  }

  if (session) return <Redirect href={`/(app)/profile/${handle}`} />

  if (profile.isPending) {
    return (
      <Screen>
        <ActivityIndicator style={styles.loading} />
      </Screen>
    )
  }

  if (!profile.data) {
    return (
      <Screen>
        <EmptyState
          icon="user-x"
          title={t('shared.missingTitle')}
          body={t('shared.missingBody', { handle })}
        />
      </Screen>
    )
  }

  const user = profile.data
  const country = user.country ? getCountry(user.country) : undefined

  return (
    <Screen scroll>
      <View style={styles.hero}>
        {/*
          No generated face here, and deliberately. The public profile DTO does
          not carry the account id — a test asserts it — and the avatar route
          takes an id and nothing else, so this page keeps the initials rather
          than reopening a decision made for the open internet.
        */}
        <Avatar url={user.avatarUrl} name={user.displayName} size={96} />
        <Text style={styles.name}>{user.displayName}</Text>
        <Text style={styles.handle}>
          @{user.handle}
          {country ? ` · ${countryFlag(country.code)} ${names.country(country.code)}` : ''}
        </Text>
        {user.bio ? <Text style={styles.bio}>{user.bio}</Text> : null}
      </View>

      {user.nativeLanguages.length > 0 ? (
        <View style={styles.section}>
          <Text style={styles.kicker}>{t('shared.speaks')}</Text>
          <Text style={styles.languages}>
            {user.nativeLanguages.map((l) => names.language(l.code)).join(', ')}
          </Text>
        </View>
      ) : null}

      {user.learning.length > 0 ? (
        <View style={styles.section}>
          <Text style={styles.kicker}>{t('shared.learning')}</Text>
          {user.learning.map((l) => (
            <View key={l.code} style={styles.learningRow}>
              <Text style={styles.languages}>{names.language(l.code)}</Text>
              <LevelBars level={l.level} />
            </View>
          ))}
        </View>
      ) : null}

      <View style={styles.cta}>
        <Text style={styles.ctaBody}>
          {invited ? t('shared.inviteBody') : t('shared.ctaBody', { name: user.displayName })}
        </Text>
        {/* An external open rather than a route: this branch of the tree is
            the signed-out one, so pushing at `(auth)` from here would cross a
            `Stack.Protected` boundary that has not flipped yet. */}
        <Button
          label={t('shared.ctaLabel')}
          onPress={() => void openExternal(profileUrl(handle))}
        />
      </View>
    </Screen>
  )
}

const useStyles = makeStyles(({ colors, font, spacing }) => ({
  loading: { marginTop: spacing.xxl },
  hero: { alignItems: 'center', gap: spacing.sm, paddingTop: spacing.xxl },
  name: { ...font.title, color: colors.text, fontSize: 26, textAlign: 'center' },
  handle: { ...font.body, color: colors.textMuted, textAlign: 'center' },
  bio: {
    ...font.body,
    color: colors.textMuted,
    lineHeight: 23,
    marginTop: spacing.sm,
    textAlign: 'center',
  },
  section: {
    borderBottomColor: colors.border,
    borderBottomWidth: 1,
    gap: spacing.xs,
    paddingVertical: spacing.lg,
  },
  kicker: { color: colors.textFaint, fontSize: 13, fontWeight: '600' },
  languages: { ...font.body, color: colors.text },
  learningRow: {
    alignItems: 'center',
    flexDirection: 'row',
    gap: spacing.sm,
    justifyContent: 'space-between',
  },
  cta: { gap: spacing.md, marginTop: spacing.xxl },
  ctaBody: { ...font.body, color: colors.textMuted, lineHeight: 23, textAlign: 'center' },
}))

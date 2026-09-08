import {
  countryFlag,
  getCountry,
  HANDLE_PATTERN,
  INVITE_QUERY_PARAM,
  profileUrl,
  type SharedProfile,
  TOKEN_RULES,
} from '@langx/shared'
import { useQuery } from '@tanstack/react-query'
import { Redirect, useLocalSearchParams } from 'expo-router'
import { useEffect, useState } from 'react'
import { ActivityIndicator, Pressable, Text, View } from 'react-native'
import { api } from '../src/api/client'
import { authClient } from '../src/lib/auth-client'
import { Avatar } from '../src/components/ui/Avatar'
import { Button } from '../src/components/ui/Button'
import { EmptyState } from '../src/components/ui/EmptyState'
import { LanguageColumns } from '../src/components/LanguageColumns'
import { PhotoViewer } from '../src/components/PhotoViewer'
import { Screen } from '../src/components/ui/Screen'
import { Skeleton } from '../src/components/ui/Skeleton'
import { FLAG_KEYS, writeFlag } from '../src/lib/localFlags'
import { openExternal } from '../src/lib/openExternal'
import { makeStyles } from '../src/lib/theme'
import { useDisplayNames, useLocale, useT } from '../src/i18n'
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
  // Above the early returns, where hooks have to be.
  const [avatarOpen, setAvatarOpen] = useState(false)
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
  const { locale } = useLocale()
  const n = (value: number) => value.toLocaleString(locale)
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
      <Screen scroll>
        <View style={styles.hero}>
          <Skeleton width={96} height={96} radius={48} />
          <View style={styles.heroText}>
            <Skeleton width={168} height={26} />
            <Skeleton width={132} height={14} />
          </View>
        </View>
        <View style={styles.bioSkeleton}>
          <Skeleton width="100%" height={16} />
          <Skeleton width="88%" height={16} />
          <Skeleton width="44%" height={16} />
        </View>
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
      {/* The same hero as a member sees, minus what the public DTO does not
          carry: no age, no streak, no account age, no online dot. */}
      <View style={styles.hero}>
        {/*
          No generated face here, and deliberately. The public profile DTO does
          not carry the account id — a test asserts it — and the avatar route
          takes an id and nothing else, so this page keeps the initials rather
          than reopening a decision made for the open internet.
        */}
        {user.avatarUrl ? (
          <Pressable
            accessibilityRole="button"
            accessibilityLabel={t('photo.open')}
            onPress={() => setAvatarOpen(true)}
          >
            <Avatar url={user.avatarUrl} name={user.displayName} size={96} />
          </Pressable>
        ) : (
          <Avatar url={user.avatarUrl} name={user.displayName} size={96} />
        )}
        {user.avatarUrl ? (
          <PhotoViewer
            photos={[{ url: user.avatarUrl }]}
            index={avatarOpen ? 0 : null}
            onClose={() => setAvatarOpen(false)}
          />
        ) : null}
        <View style={styles.heroText}>
          <Text style={styles.name}>{user.displayName}</Text>
          <Text style={styles.handle} numberOfLines={1}>
            @{user.handle}
            {country ? ` · ${countryFlag(country.code)} ${names.country(country.code)}` : ''}
          </Text>
        </View>
      </View>

      <LanguageColumns
        nativeLanguages={user.nativeLanguages}
        // The public DTO has no `priority`; the server already sends them in
        // the owner's order, so the index is that order.
        learning={user.learning.map((language, index) => ({ ...language, priority: index + 1 }))}
      />

      {user.bio ? <Text style={styles.bio}>{user.bio}</Text> : null}

      <View style={styles.cta}>
        <Text style={styles.ctaBody}>
          {invited
            ? t('shared.inviteBody', {
                name: user.displayName,
                total: n(TOKEN_RULES.referral.inviteeTotal),
                activation: n(TOKEN_RULES.referral.activation),
                max: n(TOKEN_RULES.referral.maxPerInvitee),
              })
            : t('shared.ctaBody', { name: user.displayName })}
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
  hero: { alignItems: 'center', flexDirection: 'row', gap: 20, paddingTop: spacing.lg },
  heroText: { flex: 1, gap: spacing.xs, minWidth: 0 },
  name: { ...font.heading, color: colors.text, fontSize: 26 },
  handle: { color: colors.textMuted, fontSize: 14 },
  bio: { color: colors.text, fontSize: 16, lineHeight: 25, paddingVertical: 22 },
  bioSkeleton: { gap: 10, paddingVertical: 22 },
  cta: { gap: spacing.md, marginTop: spacing.xxl },
  ctaBody: { ...font.body, color: colors.textMuted, lineHeight: 23, textAlign: 'center' },
}))

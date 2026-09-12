import Feather from '@expo/vector-icons/Feather'
import { wornCosmetic } from '@langx/shared'
import { router, useLocalSearchParams } from 'expo-router'
import { useState } from 'react'
import { Pressable, Text, View } from 'react-native'
import { authClient } from '../../../src/lib/auth-client'
import { requireAccount } from '../../../src/lib/requireAccount'
import {
  useBlockUser,
  useMe,
  useProfile,
  usePublicSummary,
  useSetFollow,
} from '../../../src/api/queries'
import { ActivityMap } from '../../../src/components/ActivityMap'
import { Avatar } from '../../../src/components/ui/Avatar'
import { placeLabel } from '../../../src/lib/placeLabel'
import { Button } from '../../../src/components/ui/Button'
import { Callout } from '../../../src/components/ui/Callout'
import { LanguageColumns } from '../../../src/components/LanguageColumns'
import { OfficialMark } from '../../../src/components/OfficialMark'
import { PhotoGallery } from '../../../src/components/PhotoGallery'
import { PhotoViewer } from '../../../src/components/PhotoViewer'
import { PresenceLine } from '../../../src/components/PresenceLine'
import { WeeklyChart } from '../../../src/components/WeeklyChart'
import { StatTile } from '../../../src/components/ui/StatTile'
import { ProfileSkeleton } from '../../../src/components/skeletons/ProfileSkeleton'
import { Screen } from '../../../src/components/ui/Screen'
import { chooseAlert, confirmAlert } from '../../../src/lib/alert'
import { goBackTo, openFollows } from '../../../src/lib/navigation'
import { shareLink } from '../../../src/lib/share'
import { profileShareText } from '../../../src/lib/shareText'
import { showToast } from '../../../src/lib/toast'
import { makeStyles, useTheme } from '../../../src/lib/theme'
import { interestLabel, useDisplayNames, useT } from '../../../src/i18n'
import { useScreenInteractive } from '../../../src/hooks/useScreenInteractive'

export default function ProfileScreen() {
  useScreenInteractive()
  const { colors } = useTheme()
  const styles = useStyles()
  const t = useT()
  const names = useDisplayNames()

  // `from` is set by whoever pushed here — this screen is reachable from
  // Discover, Chats, the viewer list, the leaderboard and a chat header, so a
  // single named parent would be wrong for four of the five.
  const { handle, from } = useLocalSearchParams<{ handle: string; from?: string }>()
  const profile = useProfile(handle ?? '')
  const me = useMe()
  const setFollow = useSetFollow(handle ?? '')
  const here = `/(app)/profile/${handle}`
  const { data: session } = authClient.useSession()
  const summary = usePublicSummary(handle ?? '')
  const block = useBlockUser()

  const [avatarOpen, setAvatarOpen] = useState(false)

  if (profile.isPending) {
    // The bar with the back arrow is drawn now, not with the profile: it needs
    // nothing from the request, and without it the whole page dropped by its
    // height when the data came. The kebab waits — whether it exists depends
    // on whose profile this turns out to be.
    return (
      <Screen scroll>
        <View style={styles.topBar}>
          <Pressable
            accessibilityRole="button"
            accessibilityLabel={t('common.backPlain')}
            onPress={() => goBackTo('/(app)/(tabs)/discover', from)}
            hitSlop={12}
            style={({ pressed }) => [styles.back, pressed && styles.iconPressed]}
          >
            <Feather name="arrow-left" size={22} color={colors.text} />
          </Pressable>
          <View style={styles.spacer} />
        </View>
        <ProfileSkeleton avatarSize={96} />
      </Screen>
    )
  }
  if (!profile.data) {
    return (
      <Screen>
        <Text style={styles.missing}>{t('profile.notFound')}</Text>
        <Button
          label={t('common.backPlain')}
          variant="secondary"
          onPress={() => goBackTo('/(app)/(tabs)/discover', from)}
        />
      </Screen>
    )
  }

  const user = profile.data
  const isSelf = user?._id === me.data?._id
  const following = user.follow.viewerFollows
  /*
   * Old clients and old caches send no `accountStatus`, and the honest
   * default for "I do not know" is the state every profile was in before this
   * field existed.
   */
  const active = (user.accountStatus ?? 'active') === 'active'

  // One line under the name — the handle, then where they are. The city and
  // the country used to be separate entries and wrapped on most phones; see
  // `placeLabel` for why they are one item now.
  const handleLine = [`@${user.handle}`, placeLabel(user, names.country) ?? null]
    .filter(Boolean)
    .join(' · ')

  async function confirmBlock(): Promise<void> {
    const yes = await confirmAlert({
      title: t('common.block'),
      message: t('profile.blockConfirm', { name: user.displayName }),
      confirmLabel: t('common.block'),
      destructive: true,
    })
    if (yes)
      block.mutate(user._id, {
        onSuccess: () => {
          router.replace('/(app)/(tabs)/discover')
          showToast(t('profile.blocked', { name: user.displayName }))
        },
      })
  }

  /**
   * The kebab: share first, then the two actions the footer also offers.
   * Share sits on somebody else's profile only — your own has a screen for it
   * under Me, with a code that can be photographed.
   */
  async function openActions(): Promise<void> {
    const action = await chooseAlert(user.displayName, undefined, [
      { label: t('share.profile'), value: 'share' },
      { label: t('common.report'), value: 'report', destructive: true },
      { label: t('common.block'), value: 'block', destructive: true },
    ])
    if (action === 'share')
      void shareLink(profileShareText(t, { name: user.displayName, handle: user.handle }))
    if (action === 'report')
      router.push({ pathname: '/(app)/report', params: { userId: user._id } })
    if (action === 'block') void confirmBlock()
  }

  return (
    <Screen scroll>
      {/* No title: the name below is the title. */}
      <View style={styles.topBar}>
        <Pressable
          accessibilityRole="button"
          accessibilityLabel={t('common.backPlain')}
          onPress={() => goBackTo('/(app)/(tabs)/discover', from)}
          hitSlop={12}
          style={({ pressed }) => [styles.back, pressed && styles.iconPressed]}
        >
          <Feather name="arrow-left" size={22} color={colors.text} />
        </Pressable>
        <View style={styles.spacer} />
        {isSelf ? null : (
          <Pressable
            accessibilityRole="button"
            accessibilityLabel={`${t('share.profile')} · ${t('common.report')} · ${t('common.block')}`}
            onPress={() => void openActions()}
            hitSlop={8}
            style={({ pressed }) => [styles.more, pressed && styles.iconPressed]}
          >
            <Feather name="more-horizontal" size={22} color={colors.text} />
          </Pressable>
        )}
      </View>

      {/*
        Said before the profile rather than after it, so nobody reads their own
        page for a moment wondering why they cannot message themselves.
      */}
      {isSelf ? (
        <Callout tone="info" style={styles.previewNote}>
          <Text style={styles.previewNoteText}>{t('profile.previewNote')}</Text>
        </Callout>
      ) : null}

      <View style={styles.hero}>
        {/*
          Only a real photo opens: a generated face or a pair of initials is a
          stand-in, and a full-screen stand-in answers a question nobody asked.
          Without the URL there is no button, and a screen reader is not told
          there is one.
        */}
        {user.avatarUrl ? (
          <Pressable
            accessibilityRole="button"
            accessibilityLabel={t('photo.open')}
            onPress={() => setAvatarOpen(true)}
          >
            <Avatar
              url={user.avatarUrl}
              name={user.displayName}
              seed={user._id}
              size={96}
              frame={wornCosmetic(user.equipped, user.cosmetics ?? [], 'frame')?.tone}
              online={user.isOnline}
            />
          </Pressable>
        ) : (
          <Avatar
            url={user.avatarUrl}
            name={user.displayName}
            seed={user._id}
            size={96}
            frame={wornCosmetic(user.equipped, user.cosmetics ?? [], 'frame')?.tone}
            online={user.isOnline}
          />
        )}
        <View style={styles.heroText}>
          <View style={styles.nameRow}>
            <Text style={styles.name}>{user.displayName}</Text>
            {/*
              An official account has no age to show — the server omits it
              rather than deriving one from a placeholder birth date — and
              wears a tick in its place. Everything else below that a program
              has no honest answer for is hidden the same way: a streak, a
              language pair and a correction count on @langx would be numbers
              about nobody.
            */}
            {user.official ? (
              <OfficialMark size={18} />
            ) : (
              <Text style={styles.age}>{user.age}</Text>
            )}
          </View>
          <Text style={styles.handle} numberOfLines={1}>
            {handleLine}
          </Text>
          {/*
            On the handle's line rather than among the facts below: pronouns are
            part of somebody's name, not a statistic about them, and reading
            them a moment before you write is the whole reason they are here.
          */}
          {user.pronouns ? (
            <Text style={styles.pronouns} numberOfLines={1}>
              {user.pronouns}
            </Text>
          ) : null}
          {/*
            A read-only tag, like the interests below and for the same reason:
            nothing here is pressable. It is the **whole** of what anybody else
            is told — when a suspension ends, why, and whether it was appealed
            belong to the person it is about.
          */}
          {active ? null : (
            <View
              style={[
                styles.statusTag,
                user.accountStatus === 'suspended' ? styles.statusSuspended : styles.statusDeleted,
              ]}
            >
              <Text
                style={[
                  styles.statusLabel,
                  {
                    color: user.accountStatus === 'suspended' ? colors.danger : colors.textMuted,
                  },
                ]}
              >
                {t(
                  user.accountStatus === 'suspended'
                    ? 'profile.suspendedTag'
                    : 'profile.deletedTag',
                )}
              </Text>
            </View>
          )}
          {/*
            The two things somebody wants to know about a stranger who has just
            written to them: how often this person comes back, and whether they
            are here now. How long the account has existed used to sit here too
            and was the line that never fit — it is on the activity map below
            in every sense that matters, and a hero that wraps to read it was
            paying too much.

            `PresenceLine` is the chat header's, so the two cannot drift apart
            again; it draws nothing when the profile hides its online status,
            since the field is then absent from the payload.
          */}
          <View style={styles.facts}>
            {summary.data && !user.official ? (
              /*
                The bolt and the number alone, as on a Discover card — this is
                where the convention is learned, and spelling it out here cost
                the row a whole line on a phone. The words survive for a screen
                reader, which has no bolt to go on.
              */
              <View
                accessibilityLabel={t('profile.dayStreak', {
                  count: summary.data.streak.current,
                })}
                style={styles.streak}
              >
                <Feather name="zap" size={13} color={colors.streak} />
                <Text style={styles.fact}>{summary.data.streak.current}</Text>
              </View>
            ) : null}
            {user.official ? null : <PresenceLine lastActiveAt={user.lastActiveAt} />}
          </View>
        </View>
      </View>

      <PhotoGallery photos={user.photos} />
      {user.avatarUrl ? (
        <PhotoViewer
          photos={[{ url: user.avatarUrl }]}
          index={avatarOpen ? 0 : null}
          onClose={() => setAvatarOpen(false)}
        />
      ) : null}

      {/* v3's two-column language block, shared with the owner's own tab so
          the two views of one profile cannot drift apart. */}
      {user.official ? null : (
        <LanguageColumns nativeLanguages={user.nativeLanguages} learning={user.learning} />
      )}

      {/*
        The numbers: the quickest read of whether this person is here to
        teach. The streak has moved up beside the name, and the follower count
        is the way into the list — the "›" is the hint that it opens.
      */}
      {summary.data && !user.official ? (
        <View style={styles.stats}>
          <StatTile
            tone="success"
            label={t('me.corrections')}
            value={String(summary.data.corrections)}
          />
          <StatTile label={t('me.badges')} value={String(summary.data.badges)} />
          <StatTile
            label={`${t('profile.followersTitle')} ›`}
            value={String(user.follow.followers)}
            onPress={() => openFollows(user._id, 'followers', here)}
          />
        </View>
      ) : null}

      {user.bio ? <Text style={styles.bio}>{user.bio}</Text> : null}

      {/* Read-only tags, not `Chip`s: a chip is a control, and nothing here is
          pressable. */}
      {user.interests.length > 0 ? (
        <View style={styles.interests}>
          <Text style={styles.kicker}>{t('profile.interests')}</Text>
          <View style={styles.tags}>
            {user.interests.map((interest) => (
              <View key={interest} style={styles.tag}>
                <Text style={styles.tagLabel}>{interestLabel(t, interest)}</Text>
              </View>
            ))}
          </View>
        </View>
      ) : null}

      {/* Read-only, and drawn from the same component as your own — a second
          implementation of a grid is a second grid to keep in step. */}
      {user.official ? null : <ActivityMap handle={user.handle} />}

      {/*
        The week's chart, only if it is offered: `weekChartVisible` is checked
        on the server, so a profile that turned it off sends no `week` and
        there is nothing here to hide. Beside the activity map, which is the
        same kind of thing at a different zoom.
      */}
      {summary.data?.week && !user.official ? <WeeklyChart week={summary.data.week} /> : null}

      {/*
        Everything below is addressed to somebody else, so none of it belongs
        on your own profile. `isSelf` used to gate only the kebab menu and the
        Follow button, which left a composer that messaged you and a Block
        button that blocked you — reachable already through a handle deep
        link, and now the whole point of "Preview my profile".
      */}
      {isSelf ? (
        <Button
          label={t('me.editProfile')}
          variant="secondary"
          onPress={() => router.push('/(app)/edit-profile')}
          style={styles.editProfile}
        />
      ) : !active ? (
        /*
         * Nothing to do with an account that is not one any more, except read
         * back what was already said. The thread stays reachable when there is
         * one — that is usually how somebody arrived here — and every action
         * that would write to them is gone rather than disabled: a button that
         * refuses is worse than a button that is not there.
         */
        user.conversationId ? (
          <View style={styles.actions}>
            <Button
              label={t('profile.openChat')}
              variant="secondary"
              onPress={() => router.push(`/(app)/chat/${user.conversationId}`)}
            />
          </View>
        ) : null
      ) : (
        <View style={styles.actions}>
          {/*
            A conversation that already exists is a link to it; one that does
            not is a link to the screen that starts it — v3 opens the thread's
            own composer rather than unfolding a form here, so the first
            sentence is written where the reply will arrive. `chat/new` cannot
            start a second conversation — `startConversation` refuses — which
            is why the existing one is offered first.

            A channel gets neither: the API refuses a message to it, and the
            same rule the suspended branch above states applies here — a button
            that refuses is worse than a button that is not there. Opening the
            thread stays, because reading what it has said is the point of it.
          */}
          {user.conversationId ? (
            <Button
              label={t('profile.openChat')}
              onPress={() => router.push(`/(app)/chat/${user.conversationId}`)}
            />
          ) : user.acceptsMessages === false ? null : (
            <Button
              label={t('profile.sendMessage')}
              // Gated here as well as at the send: a guest should hear about
              // the account before typing a message out, not after.
              onPress={() => {
                if (!requireAccount(session?.user, { action: 'message', toUserId: user._id }))
                  return
                router.push(`/(app)/chat/new?to=${user._id}&from=${encodeURIComponent(here)}`)
              }}
            />
          )}
          <Button
            label={following ? t('profile.following') : t('profile.follow')}
            variant="secondary"
            icon={following ? <Feather name="check" size={16} color={colors.accent} /> : undefined}
            loading={setFollow.isPending}
            // No confirmation on unfollow. It is trivially reversible, and
            // `confirmAlert` is what blocking is for.
            // Gated like `send()` above, and for the same reason: this is a
            // write a guest reaches in one tap. Without the guard the
            // transport still catches it, but a round trip later and only
            // after `onError` has already shown a toast that says nothing
            // about needing an account.
            onPress={() => {
              if (!requireAccount(session?.user, { action: 'follow' })) return
              setFollow.mutate(
                { userId: user._id, following: !following },
                { onError: () => showToast(t('profile.followFailed')) },
              )
            }}
          />
          {/* Report and Block live in the top-right menu only. They used to be
              repeated as a row down here, which made the bottom of every
              profile read as a warning. */}
        </View>
      )}
    </Screen>
  )
}

const useStyles = makeStyles(({ colors, font, spacing, radius }) => ({
  missing: {
    ...font.body,
    color: colors.textMuted,
    marginVertical: spacing.xl,
    textAlign: 'center',
  },
  topBar: {
    alignItems: 'center',
    flexDirection: 'row',
    gap: spacing.md + 2,
    paddingBottom: spacing.sm,
  },
  // 34 square like `ScreenHeader`'s arrow; the kebab gets the design's 36.
  back: { alignItems: 'center', height: 34, justifyContent: 'center', width: 34 },
  more: { alignItems: 'center', height: 36, justifyContent: 'center', width: 36 },
  spacer: { flex: 1 },
  iconPressed: { opacity: 0.6 },
  previewNote: { marginBottom: spacing.lg },
  previewNoteText: { color: colors.text, fontSize: 14, lineHeight: 20 },
  hero: { alignItems: 'center', flexDirection: 'row', gap: 20 },
  heroText: { flex: 1, gap: spacing.xs, minWidth: 0 },
  nameRow: { alignItems: 'center', flexDirection: 'row', flexWrap: 'wrap', gap: spacing.sm },
  name: { ...font.heading, color: colors.text, fontSize: 26 },
  age: { color: colors.textMuted, fontSize: 18 },
  handle: { color: colors.textMuted, fontSize: 14 },
  pronouns: { color: colors.textFaint, fontSize: 13 },
  // Wraps: "Last seen 3 hours ago" is a whole sentence in every language and
  // a long one in some, so the pair runs past a phone's hero column in German
  // before it does in English. A row that cannot wrap makes the sentence wrap
  // inside itself instead, which reads as a broken line rather than a second
  // fact.
  facts: {
    alignItems: 'center',
    columnGap: 12,
    flexDirection: 'row',
    flexWrap: 'wrap',
    marginTop: 2,
    rowGap: 2,
  },
  streak: { alignItems: 'center', flexDirection: 'row', gap: 3 },
  fact: { color: colors.textMuted, fontSize: 13 },
  stats: {
    borderBottomColor: colors.border,
    borderBottomWidth: 1,
    flexDirection: 'row',
    gap: 10,
    paddingVertical: 20,
  },
  bio: { color: colors.text, fontSize: 16, lineHeight: 25, paddingBottom: 18, paddingTop: 22 },
  interests: {
    borderBottomColor: colors.border,
    borderBottomWidth: 1,
    gap: 10,
    paddingBottom: 22,
  },
  kicker: {
    color: colors.textFaint,
    fontSize: 12,
    fontWeight: '700',
    letterSpacing: 0.5,
    textTransform: 'uppercase',
  },
  tags: { flexDirection: 'row', flexWrap: 'wrap', gap: spacing.sm },
  tag: {
    backgroundColor: colors.accentBg,
    borderRadius: radius.pill,
    paddingHorizontal: 14,
    paddingVertical: spacing.sm,
  },
  tagLabel: { color: colors.accent, fontSize: 13, fontWeight: '700' },
  statusTag: {
    alignSelf: 'flex-start',
    borderRadius: radius.pill,
    marginTop: spacing.xs,
    paddingHorizontal: 10,
    paddingVertical: 3,
  },
  statusSuspended: { backgroundColor: colors.dangerBg },
  // Muted rather than red: a deleted account is a fact, not a warning.
  statusDeleted: { backgroundColor: colors.fill },
  statusLabel: { fontSize: 12, fontWeight: '700' },
  actions: { gap: spacing.md, paddingTop: spacing.xl },
  editProfile: { marginTop: spacing.xl },
}))

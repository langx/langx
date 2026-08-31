import Feather from '@expo/vector-icons/Feather'
import { countryFlag, getCountry, wornCosmetic } from '@langx/shared'
import { router, useLocalSearchParams } from 'expo-router'
import { useState } from 'react'
import { ActivityIndicator, Pressable, Text, TextInput, View } from 'react-native'
import { ApiRequestError } from '../../../src/api/client'
import {
  useBlockUser,
  useMe,
  useProfile,
  usePublicSummary,
  useQuota,
  useReportUser,
  useSetFollow,
  useStartConversation,
} from '../../../src/api/queries'
import { ActivityMap } from '../../../src/components/ActivityMap'
import { Avatar } from '../../../src/components/ui/Avatar'
import { PresenceLine } from '../../../src/components/PresenceLine'
import { CosmeticTitle } from '../../../src/components/CosmeticTitle'
import { Button } from '../../../src/components/ui/Button'
import { LevelBars } from '../../../src/components/ui/LevelBars'
import { PhotoGallery } from '../../../src/components/PhotoGallery'
import { WeeklyChart } from '../../../src/components/WeeklyChart'
import { TierBadge } from '../../../src/components/TierBadge'
import { Chip } from '../../../src/components/ui/Chip'
import { StatTile } from '../../../src/components/ui/StatTile'
import { Screen } from '../../../src/components/ui/Screen'
import { chooseAlert, confirmAlert } from '../../../src/lib/alert'
import { goBackTo, openFollows } from '../../../src/lib/navigation'
import { openPaywall } from '../../../src/lib/paywall'
import { showToast } from '../../../src/lib/toast'
import { days } from '../../../src/lib/format'
import { makeStyles, useTheme } from '../../../src/lib/theme'
import {
  accountAgeLabel,
  interestLabel,
  levelLabel,
  useDisplayNames,
  useT,
} from '../../../src/i18n'

export default function ProfileScreen() {
  const { colors } = useTheme()
  const styles = useStyles()
  const t = useT()
  const names = useDisplayNames()

  /** "🇹🇷 Türkiye", not "TR" — the code alone means nothing to a reader. */
  const countryLabel = (code: string): string => {
    const country = getCountry(code)
    return country ? `${countryFlag(country.code)} ${names.country(country.code)}` : code
  }

  // `from` is set by whoever pushed here — this screen is reachable from
  // Discover, Chats, the viewer list, the leaderboard and a chat header, so a
  // single named parent would be wrong for four of the five.
  const { handle, from } = useLocalSearchParams<{ handle: string; from?: string }>()
  const profile = useProfile(handle ?? '')
  const me = useMe()
  const setFollow = useSetFollow(handle ?? '')
  const here = `/(app)/profile/${handle}`
  const startConversation = useStartConversation()
  const summary = usePublicSummary(handle ?? '')
  const quota = useQuota()
  const block = useBlockUser()
  const report = useReportUser()

  const [message, setMessage] = useState('')
  const [error, setError] = useState<string | undefined>()

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
        <Text style={styles.missing}>{t('profile.notFound')}</Text>
        <Button
          label={t('common.backPlain')}
          variant="secondary"
          onPress={() => goBackTo('/(app)/discover', from)}
        />
      </Screen>
    )
  }

  const user = profile.data
  const isSelf = user?._id === me.data?._id
  const canSend = message.trim().length > 0 && !startConversation.isPending

  // v3's identity block folds the badge chips into one muted line.
  const metaLine = [
    String(user.age),
    user.country ? countryLabel(user.country) : null,
    user.streak.current > 0 ? `🔥 ${days(t, user.streak.current)}` : null,
    user.emailVerified ? t('profile.verifiedEmail') : null,
  ]
    .filter(Boolean)
    .join(' · ')

  // `priority` is the order the user picked them in; the API has always sent it.
  const study = [...user.learning].sort((a, b) => a.priority - b.priority)

  async function send(): Promise<void> {
    setError(undefined)
    try {
      const conversation = await startConversation.mutateAsync({
        toUserId: user._id,
        body: message.trim(),
      })
      setMessage('')
      router.replace(`/(app)/chat/${conversation._id}`)
    } catch (caught) {
      if (caught instanceof ApiRequestError) {
        // The free tier's 5-a-day cap is the single most important thing this
        // screen has to explain well — a generic failure here reads as a bug.
        if (caught.code === 'QUOTA_EXCEEDED') {
          // `openPaywall` rather than the raw route: it is the one place that
          // knows how the paywall is reached, and pushing the path directly
          // meant this call site quietly missed whatever it does.
          openPaywall(undefined, `/(app)/profile/${handle}`)
          return
        }
        if (caught.code === 'CONVERSATION_EXISTS') {
          router.replace('/(app)/chats')
          return
        }
        setError(caught.message)
      } else {
        setError(t('profile.sendFailed'))
      }
    }
  }

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
          router.replace('/(app)/discover')
          showToast(t('profile.blocked', { name: user.displayName }))
        },
      })
  }

  async function confirmReport(): Promise<void> {
    const reason = await chooseAlert(t('common.report'), t('report.profileQuestion'), [
      { label: t('report.spam'), value: 'spam' },
      { label: t('report.harassment'), value: 'harassment' },
      { label: t('report.inappropriate'), value: 'inappropriate_content' },
    ])
    if (reason)
      report.mutate(
        { userId: user._id, reason },
        { onSuccess: () => showToast(t('report.profileSent')) },
      )
  }

  /** The kebab is a shortcut to the same two actions the footer offers. */
  async function openActions(): Promise<void> {
    const action = await chooseAlert(user.displayName, undefined, [
      { label: t('common.report'), value: 'report' },
      { label: t('common.block'), value: 'block' },
    ])
    if (action === 'report') void confirmReport()
    if (action === 'block') void confirmBlock()
  }

  return (
    <Screen scroll>
      <View style={styles.topBar}>
        <Pressable
          accessibilityRole="button"
          accessibilityLabel={t('common.backPlain')}
          onPress={() => goBackTo('/(app)/discover', from)}
          hitSlop={12}
          style={({ pressed }) => [styles.iconButton, pressed && styles.iconPressed]}
        >
          <Feather name="arrow-left" size={22} color={colors.text} />
        </Pressable>
        {isSelf ? null : (
          <Pressable
            accessibilityRole="button"
            accessibilityLabel={`${t('common.report')} · ${t('common.block')}`}
            onPress={() => void openActions()}
            hitSlop={12}
            style={({ pressed }) => [styles.iconButton, pressed && styles.iconPressed]}
          >
            <Feather name="more-vertical" size={20} color={colors.textMuted} />
          </Pressable>
        )}
      </View>

      <View style={styles.hero}>
        <Avatar
          url={user.avatarUrl}
          name={user.displayName}
          size={84}
          frame={wornCosmetic(user.equipped, user.cosmetics ?? [], 'frame')?.tone}
          online={user.isOnline}
        />
        <View style={styles.nameRow}>
          <Text style={styles.name}>{user.displayName}</Text>
          <CosmeticTitle cosmetic={wornCosmetic(user.equipped, user.cosmetics ?? [], 'title')} />
        </View>
        {/*
          Directly under the name, which is where a reader is already looking
          when they are deciding whether this person will answer.
        */}
        <View style={styles.presence}>
          <PresenceLine lastActiveAt={user.lastActiveAt} />
        </View>
        {/*
          How long the account has existed, next to who it says it is: the two
          questions someone asks about a stranger who just messaged them are
          the same question, so they share a line.
        */}
        <Text style={styles.handle}>
          @{user.handle} · {t('profile.registeredLabel')}{' '}
          {accountAgeLabel(t, new Date(user.createdAt))}
        </Text>
        {metaLine ? <Text style={styles.meta}>{metaLine}</Text> : null}
        {user.tier !== 'free' ? (
          <View style={styles.tierRow}>
            <TierBadge tier={user.tier} />
          </View>
        ) : null}

        <View style={styles.followRow}>
          <Pressable
            accessibilityRole="button"
            hitSlop={8}
            onPress={() => openFollows(user._id, 'followers', here)}
          >
            <Text style={styles.followCount}>
              {t('profile.followers', { count: user.follow.followers })}
            </Text>
          </Pressable>
          <Pressable
            accessibilityRole="button"
            hitSlop={8}
            onPress={() => openFollows(user._id, 'following', here)}
          >
            <Text style={styles.followingCount}>
              {t('profile.followingCount', { count: user.follow.following })}
            </Text>
          </Pressable>
        </View>

        {/*
          Nothing at all on your own profile. This screen is reachable for
          yourself through a handle deep link, and a Follow button pointing at
          the person pressing it is the bug that ships.
        */}
        {isSelf ? null : (
          <Button
            label={user.follow.viewerFollows ? t('profile.following') : t('profile.follow')}
            variant={user.follow.viewerFollows ? 'secondary' : 'primary'}
            loading={setFollow.isPending}
            // No confirmation on unfollow. It is trivially reversible, and
            // `confirmAlert` is what blocking is for.
            onPress={() =>
              setFollow.mutate(
                { userId: user._id, following: !user.follow.viewerFollows },
                { onError: () => showToast(t('profile.followFailed')) },
              )
            }
            style={styles.followButton}
          />
        )}
      </View>

      <PhotoGallery photos={user.photos} />

      {user.bio ? <Text style={styles.bio}>{user.bio}</Text> : null}

      {/* v3's two-column language block: teaches on the left, learns on the
          right, level bars instead of level words. */}
      {user.nativeLanguages.length > 0 || study.length > 0 ? (
        <View style={styles.languages}>
          <View style={styles.languageColumn}>
            <Text style={styles.kicker}>{t('profile.teaches')}</Text>
            {user.nativeLanguages.map((language) => (
              <View key={language.code} style={styles.languageEntry}>
                <Text style={styles.languageName}>{names.language(language.code)}</Text>
                {/* `level` is ignored when `native` draws all five bars. */}
                <LevelBars level="fluent" native size={17} />
              </View>
            ))}
          </View>
          <View style={styles.languageColumn}>
            <Text style={styles.kicker}>{t('profile.learns')}</Text>
            {study.map((language) => (
              <View key={language.code} style={styles.languageEntry}>
                <Text
                  style={[styles.languageName, styles.languageNameAccent]}
                  accessibilityLabel={`${names.language(language.code)} · ${levelLabel(t, language.level)}`}
                >
                  {names.language(language.code)}
                </Text>
                <LevelBars level={language.level} />
              </View>
            ))}
          </View>
        </View>
      ) : null}

      {user.interests.length > 0 ? (
        <>
          <Text style={styles.sectionTitle}>{t('profile.interests')}</Text>
          <View style={styles.chips}>
            {user.interests.map((interest) => (
              <Chip key={interest} label={interestLabel(t, interest)} />
            ))}
          </View>
        </>
      ) : null}

      {/*
        The numbers, and only if they are offered: `statsVisible` is checked on
        the server, so a profile that turned them off sends nothing to hide.
      */}
      {summary.data?.visible ? (
        <>
          <View style={styles.stats}>
            <StatTile label={t('me.dayStreak')} value={`🔥 ${summary.data.streak?.current ?? 0}`} />
            <StatTile
              tone="success"
              label={t('me.corrections')}
              value={String(summary.data.corrections ?? 0)}
            />
            <StatTile label={t('tokens.title')} value={String(summary.data.tokens ?? 0)} />
          </View>
          {summary.data.week ? <WeeklyChart week={summary.data.week} /> : null}
        </>
      ) : null}

      {/* Read-only, and drawn from the same component as your own — a second
          implementation of a grid is a second grid to keep in step. */}
      <View style={styles.activity}>
        <ActivityMap handle={user.handle} />
      </View>

      {/*
        Everything below is addressed to somebody else, so none of it belongs
        on your own profile. `isSelf` used to gate only the kebab menu and the
        Follow button, which left a composer that messaged you and a Block
        button that blocked you — reachable already through a handle deep
        link, and now the whole point of "Preview my profile".
      */}
      {isSelf ? (
        <Text style={styles.previewNote}>{t('profile.previewNote')}</Text>
      ) : (
        <>
          {/*
            A conversation that already exists is a link, not a form. The
            composer below cannot start a second one — `startConversation`
            refuses, which used to surface as "a conversation with this user
            already exists" after typing a message out.
          */}
          {user.conversationId ? (
            <Button
              label={t('profile.openChat')}
              variant="secondary"
              onPress={() => router.push(`/(app)/chat/${user.conversationId}`)}
              style={styles.send}
            />
          ) : (
            <>
              <Text style={styles.sendLabel}>{t('profile.sendMessage')}</Text>
              <View style={styles.composerRow}>
                <TextInput
                  value={message}
                  onChangeText={setMessage}
                  placeholder={t('chat.sayHello', { name: user.displayName })}
                  placeholderTextColor={colors.textFaint}
                  style={styles.input}
                />
                <Pressable
                  accessibilityRole="button"
                  accessibilityLabel={t('common.send')}
                  accessibilityState={{ disabled: !canSend }}
                  disabled={!canSend}
                  onPress={() => void send()}
                  style={({ pressed }) => [
                    styles.sendCircle,
                    !canSend && styles.sendCircleDisabled,
                    pressed && canSend && styles.iconPressed,
                  ]}
                >
                  {startConversation.isPending ? (
                    <ActivityIndicator color={colors.bg} />
                  ) : (
                    <Feather name="send" size={17} color={colors.bg} />
                  )}
                </Pressable>
              </View>
              {quota.data ? (
                <Text style={styles.quotaHint}>
                  {t('me.newChatsLeft')} {quota.data.initiations.remaining ?? '—'} /{' '}
                  {quota.data.initiations.limit ?? '∞'}
                </Text>
              ) : null}
              {error ? <Text style={styles.error}>{error}</Text> : null}
            </>
          )}

          <View style={styles.danger}>
            <Pressable onPress={() => void confirmReport()} hitSlop={8}>
              <Text style={styles.dangerText}>{t('common.report')}</Text>
            </Pressable>
            <Pressable onPress={() => void confirmBlock()} hitSlop={8}>
              <Text style={styles.dangerText}>{t('common.block')}</Text>
            </Pressable>
          </View>
        </>
      )}
    </Screen>
  )
}

const useStyles = makeStyles(({ colors, font, spacing, radius }) => ({
  loading: { marginTop: spacing.xxl },
  missing: {
    ...font.body,
    color: colors.textMuted,
    marginVertical: spacing.xl,
    textAlign: 'center',
  },
  topBar: {
    alignItems: 'center',
    flexDirection: 'row',
    justifyContent: 'space-between',
    paddingVertical: spacing.sm,
  },
  iconButton: { alignItems: 'center', height: 30, justifyContent: 'center', width: 30 },
  iconPressed: { opacity: 0.6 },
  hero: { alignItems: 'center', paddingTop: spacing.sm },
  presence: { marginTop: 6 },
  nameRow: { alignItems: 'center', flexDirection: 'row', gap: 6, justifyContent: 'center' },
  name: { ...font.heading, color: colors.text, fontSize: 24, marginTop: 12 },
  handle: { color: colors.textMuted, fontSize: 14, marginTop: 2 },
  meta: { color: colors.textMuted, fontSize: 14, marginTop: 8, textAlign: 'center' },
  tierRow: { marginTop: spacing.sm },
  followRow: { flexDirection: 'row', gap: 20, marginTop: 12 },
  followCount: { color: colors.text, fontSize: 14, fontWeight: '700' },
  followingCount: { color: colors.textMuted, fontSize: 14, fontWeight: '600' },
  followButton: { marginTop: spacing.lg },
  bio: { ...font.body, color: colors.text, marginBottom: spacing.md },
  languages: {
    borderBottomColor: colors.border,
    borderBottomWidth: 1,
    flexDirection: 'row',
    marginTop: spacing.lg,
    paddingBottom: 18,
  },
  languageColumn: { flex: 1 },
  languageEntry: { marginTop: 3 },
  kicker: { color: colors.textFaint, fontSize: 12, fontWeight: '600' },
  languageName: { ...font.heading, color: colors.text, fontSize: 18, marginBottom: 5 },
  languageNameAccent: { color: colors.accent },
  sectionTitle: {
    color: colors.textFaint,
    fontSize: 13,
    fontWeight: '600',
    marginBottom: spacing.sm,
    marginTop: spacing.lg,
  },
  chips: { flexDirection: 'row', flexWrap: 'wrap', gap: spacing.xs },
  stats: {
    borderBottomColor: colors.border,
    borderBottomWidth: 1,
    flexDirection: 'row',
    paddingVertical: 18,
  },
  activity: { marginTop: spacing.md },
  sendLabel: { color: colors.textMuted, fontSize: 14, fontWeight: '600', marginTop: 18 },
  composerRow: { alignItems: 'center', flexDirection: 'row', gap: 10, marginTop: spacing.sm },
  input: {
    backgroundColor: colors.fill,
    borderRadius: radius.pill,
    color: colors.text,
    flex: 1,
    fontSize: 15,
    minHeight: 46,
    paddingHorizontal: 18,
    paddingVertical: 12,
  },
  sendCircle: {
    alignItems: 'center',
    backgroundColor: colors.ink,
    borderRadius: radius.pill,
    height: 46,
    justifyContent: 'center',
    width: 46,
  },
  sendCircleDisabled: { opacity: 0.5 },
  quotaHint: { color: colors.textFaint, fontSize: 13, marginTop: 10 },
  error: { ...font.caption, color: colors.danger, marginTop: spacing.sm },
  send: { marginTop: spacing.lg },
  previewNote: {
    ...font.caption,
    color: colors.textFaint,
    lineHeight: 19,
    marginTop: spacing.xl,
  },
  danger: {
    borderTopColor: colors.border,
    borderTopWidth: 1,
    flexDirection: 'row',
    gap: 32,
    justifyContent: 'center',
    marginTop: spacing.xxl,
    paddingVertical: spacing.lg,
  },
  dangerText: { color: colors.danger, fontSize: 13, fontWeight: '600' },
}))

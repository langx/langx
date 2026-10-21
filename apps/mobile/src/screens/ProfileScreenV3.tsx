import Feather from '@expo/vector-icons/Feather'
import { Nunito_900Black } from '@expo-google-fonts/nunito/900Black'
import { profileUrl, TIER_BADGES, TIER_NAMES, wornCosmetic, wornFrameTone } from '@langx/shared'
import { useFonts } from 'expo-font'
import { Image } from 'expo-image'
import { router, useIsFocused } from 'expo-router'
import { useState, type ReactNode } from 'react'
import { Pressable, RefreshControl, ScrollView, Text, View } from 'react-native'
import { useSafeAreaInsets } from 'react-native-safe-area-context'
import {
  useBlockUser,
  useEffectiveTier,
  useMe,
  useProfile,
  usePublicSummary,
  useSetFollow,
  type ConversationDto,
} from '../api/queries'
import { ActivityMap } from '../components/ActivityMap'
import { BadgePatch } from '../components/badges/BadgePatch'
import { ConversationPicker } from '../components/ConversationPicker'
import { GenderMark } from '../components/GenderMark'
import { OfficialMark } from '../components/OfficialMark'
import { PhotoViewer } from '../components/PhotoViewer'
import { PresenceLine } from '../components/PresenceLine'
import { ProMark } from '../components/ProMark'
import { ProfileSkeleton } from '../components/skeletons/ProfileSkeleton'
import { ProfileTestimonials } from '../components/testimonials/ProfileTestimonials'
import { WebTitle } from '../components/WebTitle'
import { WeeklyChart } from '../components/WeeklyChart'
import { WhatsProSheet } from '../components/WhatsProSheet'
import { Avatar } from '../components/ui/Avatar'
import { Button } from '../components/ui/Button'
import { FrameSweep } from '../components/ui/FrameSweep'
import { IconButton } from '../components/ui/IconButton'
import { LevelBars } from '../components/ui/LevelBars'
import { PressableScale } from '../components/ui/PressableScale'
import { FlameGlyph } from '../components/ui/StreakFlame'
import { TitleBadge } from '../components/ui/TitleBadge'
import { usePullToRefresh } from '../hooks/usePullToRefresh'
import { useScreenInteractive } from '../hooks/useScreenInteractive'
import { interestLabel, levelLabel, useDisplayNames, useLocale, useT } from '../i18n'
import { chooseAlert, confirmAlert, showAlert } from '../lib/alert'
import { track } from '../lib/analytics'
import { authClient } from '../lib/auth-client'
import { shouldGateGuest } from '../lib/guestGate'
import { goBackTo, openBadges, openFollows, openPostCorrections } from '../lib/navigation'
import { openPaywall } from '../lib/paywall'
import { placeLabel } from '../lib/placeLabel'
import { badgeSheetEnd } from '../lib/proRoads'
import { requireAccount } from '../lib/requireAccount'
import { shareLink } from '../lib/share'
import { profileShareText } from '../lib/shareText'
import { emitWithAck, getSocket } from '../lib/socket'
import { DISPLAY_FONT, layout, makeStyles, useTheme } from '../lib/theme'
import { partnerHueFor } from '../lib/theme/partnerHue'
import { showToast } from '../lib/toast'
import type { ProfileScreenProps } from './ProfileScreen'

/**
 * Somebody's profile in the redesign, behind `flags.v3Home` — `ProfileScreen`
 * picks it. Drawn from `V-Profile`: the person on their own colour at the
 * top, then their photos, languages, numbers, badges, words and history, and
 * the way to write to them pinned to the foot so it is always in reach.
 *
 * **Only the drawing is new.** Every request, guard and handler is the
 * current screen's, copied rather than shared so the current file stays as it
 * is until the flag goes; `profileScreenV3.test.ts` holds the two together.
 * The data is the same two queries, so nothing here is shown that today's
 * profile does not already show — what a privacy setting hides is absent from
 * the payload, not hidden here.
 */
export function ProfileScreenV3({ handle, from, embedded = false, onClose }: ProfileScreenProps) {
  useScreenInteractive(!embedded)
  const { v3 } = useTheme()
  const styles = useStyles()
  const t = useT()
  const names = useDisplayNames()
  const { isRtl } = useLocale()
  const safe = useSafeAreaInsets()
  // A panel sits below the screen's own header, not under the status bar.
  const insets = embedded ? { ...safe, top: 0 } : safe
  const [blackLoaded] = useFonts({ Nunito_900Black })
  // For the browser tab's title — see the same gate in `ChatScreen`.
  const focused = useIsFocused()

  const profile = useProfile(handle ?? '')
  const me = useMe()
  const setFollow = useSetFollow(handle ?? '')
  const here = `/(app)/profile/${handle}`
  const { data: session } = authClient.useSession()
  const summary = usePublicSummary(handle ?? '')
  const block = useBlockUser()

  const [avatarOpen, setAvatarOpen] = useState(false)
  /** Which of the photos is open, or `null` — `PhotoGallery`'s own state. */
  const [photoAt, setPhotoAt] = useState<number | null>(null)
  /** "What's Pro?", behind the PRO badge. */
  const [proSheetOpen, setProSheetOpen] = useState(false)
  // The viewer's own plan, which decides how that sheet ends — never the
  // profile's, which is whose badge it is.
  const viewerTier = useEffectiveTier()
  /** Choosing the thread this profile is about to be sent into. */
  const [sending, setSending] = useState(false)
  // Both queries or neither, for the current screen's reason.
  const pull = usePullToRefresh(() => Promise.all([profile.refetch(), summary.refetch()]))

  const back = () => goBackTo('/(app)/(tabs)/discover', from)
  const chevron = isRtl ? 'chevron-left' : 'chevron-right'

  /*
   * Plain on the ground while the profile loads, in ink on the hero once it
   * has: the colour is the person's, and it is not known until they are.
   * Absent in a panel, as today — the list it would go back to is beside it.
   */
  const backButton = (onHue: boolean) =>
    embedded ? null : (
      <IconButton
        icon={isRtl ? 'chevron-right' : 'chevron-left'}
        accessibilityLabel={t('common.backPlain')}
        onPress={back}
        hitSlop={12}
        {...(onHue ? { color: v3.colors.ink } : {})}
      />
    )

  if (profile.isPending) {
    return (
      <View style={[styles.root, { paddingTop: insets.top }]}>
        <View style={styles.column}>
          <View style={styles.loadingBar}>{backButton(false)}</View>
          <View style={styles.loadingBody}>
            <ProfileSkeleton avatarSize={96} />
          </View>
        </View>
      </View>
    )
  }
  if (!profile.data) {
    return (
      <View style={[styles.root, { paddingTop: insets.top }]}>
        <View style={[styles.column, styles.missingBody]}>
          <Text style={styles.missing}>{t('profile.notFound')}</Text>
          <Button
            label={t('common.backPlain')}
            variant="secondary"
            onPress={() => (embedded ? onClose?.() : back())}
          />
        </View>
      </View>
    )
  }

  const user = profile.data
  const isSelf = user?._id === me.data?._id
  const badge = user.official ? null : TIER_BADGES[user.tier]
  const following = user.follow.viewerFollows
  // No `accountStatus` from an old API or cache means what it did before the field.
  const active = (user.accountStatus ?? 'active') === 'active'
  // The worn title — not on an account that is gone or suspended.
  const title = active ? wornCosmetic(user.equipped, user.cosmetics ?? [], 'title') : undefined
  const hue = v3.hues[partnerHueFor(user._id)]
  const frame = wornFrameTone(user.equipped, user.cosmetics ?? [])
  const handleLine = [`@${user.handle}`, placeLabel(user, names.country) ?? null]
    .filter(Boolean)
    .join(' · ')
  const showNumbers = summary.data && !user.official ? summary.data : undefined
  const study = [...user.learning].sort((a, b) => a.priority - b.priority)

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
          if (embedded) onClose?.()
          else router.replace('/(app)/(tabs)/discover')
          showToast(t('profile.blocked', { name: user.displayName }))
        },
      })
  }

  /** The ••• sheet, exactly the current screen's: share, send, report, block. */
  async function openActions(): Promise<void> {
    const action = await chooseAlert(user.displayName, undefined, [
      { label: t('share.profile'), value: 'share' },
      { label: t('share.sendInChat'), value: 'send' },
      { label: t('common.report'), value: 'report', destructive: true },
      { label: t('common.block'), value: 'block', destructive: true },
    ])
    if (action === 'share') {
      track({ name: 'profile_shared', properties: { own: false, via: 'sheet' } })
      void shareLink(profileShareText(t, { name: user.displayName, handle: user.handle }))
    }
    if (action === 'send' && requireAccount(session?.user, { action: 'other' })) setSending(true)
    if (action === 'report')
      router.push({ pathname: '/(app)/report', params: { userId: user._id } })
    if (action === 'block') void confirmBlock()
  }

  /** The bare link as an ordinary message — see the current screen's `sendTo`. */
  async function sendTo(conversation: ConversationDto): Promise<void> {
    setSending(false)
    try {
      const socket = await getSocket()
      await emitWithAck(socket, 'message:send', {
        conversationId: conversation._id,
        body: profileUrl(user.handle),
      })
      showToast(t('conversationPicker.sent'))
    } catch {
      void showAlert(t('chat.couldNotSend'), t('common.retry'))
    }
  }

  function sendMessage(): void {
    // Gated here as well as at the send: a guest should hear about the
    // account before typing a message out, not after.
    if (!requireAccount(session?.user, { action: 'message', toUserId: user._id })) return
    router.push(`/(app)/chat/new?to=${user._id}&from=${encodeURIComponent(here)}`)
  }

  function toggleFollow(): void {
    if (!requireAccount(session?.user, { action: 'follow' })) return
    setFollow.mutate(
      { userId: user._id, following: !following },
      { onError: () => showToast(t('profile.followFailed')) },
    )
  }

  const openChat = () => router.push(`/(app)/chat/${user.conversationId}`)

  /*
   * The footer holds what the current screen puts at the very end of the
   * scroll, in the same order of precedence: your own profile edits; a gone
   * account keeps only its thread; otherwise the thread if there is one, a
   * new one if they take it, the reason if they do not, nothing for a
   * channel — and Follow beside it.
   */
  let footer: ReactNode
  if (isSelf) {
    footer = (
      <Button
        label={t('me.editProfile')}
        variant="blue"
        icon="edit-2"
        onPress={() => router.push('/(app)/edit-profile')}
        style={styles.grow}
      />
    )
  } else if (!active) {
    footer = user.conversationId ? (
      <Button
        label={t('profile.openChat')}
        variant="secondary"
        icon="message-circle"
        onPress={openChat}
        style={styles.grow}
      />
    ) : null
  } else {
    const write = user.conversationId ? (
      <Button
        label={t('profile.openChat')}
        variant="blue"
        icon="message-circle"
        onPress={openChat}
        style={styles.grow}
      />
    ) : user.acceptsMessages === false ? null : user.acceptsNewChats === false ? (
      <View style={styles.closedNote}>
        <Feather name="lock" size={v3.icon.xs} color={v3.colors.muted} />
        <Text style={styles.closedNoteText}>
          {t('profile.newChatsRefused', { name: user.displayName })}
        </Text>
      </View>
    ) : (
      <Button
        label={t('profile.sendMessage')}
        variant="blue"
        icon="message-circle"
        onPress={sendMessage}
        style={styles.grow}
      />
    )
    footer = (
      <>
        {write}
        <Button
          label={following ? t('profile.following') : t('profile.follow')}
          variant="secondary"
          icon={following ? 'check' : 'user-plus'}
          loading={setFollow.isPending}
          onPress={toggleFollow}
          style={write ? styles.follow : styles.grow}
        />
      </>
    )
  }

  const avatar = (
    <Avatar
      url={user.avatarUrl}
      name={user.displayName}
      seed={user._id}
      size={AVATAR}
      frame={frame}
      sweep={isSelf ? FrameSweep : undefined}
    />
  )

  const stats: {
    key: string
    value: string
    label: string
    tint: boolean
    onPress: () => void
  }[] = showNumbers
    ? [
        {
          key: 'corrections',
          value: String(showNumbers.corrections),
          label: t('me.corrections'),
          tint: true,
          onPress: () => openPostCorrections(user.handle, here, 'corrections'),
        },
        {
          key: 'posts',
          value: String(showNumbers.posts ?? 0),
          label: t('tabs.feed'),
          tint: false,
          onPress: () => openPostCorrections(user.handle, here, 'posts'),
        },
        // Off the board is not a zero: no tile at all, as today.
        ...(showNumbers.rank
          ? [
              {
                key: 'rank',
                value: t('profile.rankValue', { percent: showNumbers.rank.percentile }),
                label: t('profile.rankLabel'),
                tint: false,
                onPress: () => router.push('/(app)/wallet/leaderboard'),
              },
            ]
          : []),
        {
          key: 'followers',
          value: String(user.follow.followers),
          label: t('profile.followersTitle'),
          tint: false,
          onPress: () => openFollows(user._id, 'followers', here),
        },
      ]
    : []

  return (
    <View style={styles.root}>
      {focused ? <WebTitle page={user.displayName} /> : null}
      {/* The status bar's strip in the hero's colour, so the block reaches the top edge. */}
      <View style={{ backgroundColor: hue, height: insets.top }} />
      <ScrollView
        style={styles.fill}
        contentContainerStyle={styles.scrollContent}
        refreshControl={<RefreshControl refreshing={pull.refreshing} onRefresh={pull.onRefresh} />}
      >
        <View style={styles.column}>
          <View style={[styles.hero, { backgroundColor: hue }]}>
            <View style={styles.heroTop}>
              {backButton(true)}
              {/* Your own preview says whose page it is; anybody else's name is the title. */}
              {isSelf ? (
                <Text style={styles.topTitle} numberOfLines={1} accessibilityRole="header">
                  {t('profile.previewTitle')}
                </Text>
              ) : (
                <View style={styles.fill} />
              )}
              {isSelf ? null : (
                <IconButton
                  look="hue"
                  icon="more-horizontal"
                  iconSize={v3.icon.lg}
                  accessibilityLabel={`${t('share.profile')} · ${t('share.sendInChat')} · ${t('common.report')} · ${t('common.block')}`}
                  onPress={() => void openActions()}
                />
              )}
            </View>

            <View style={styles.heroBody}>
              <View style={styles.avatarWrap}>
                {/* Only a real photo opens; initials are a stand-in. */}
                {user.avatarUrl ? (
                  <Pressable
                    accessibilityRole="button"
                    accessibilityLabel={t('photo.open')}
                    onPress={() => setAvatarOpen(true)}
                  >
                    {avatar}
                  </Pressable>
                ) : (
                  avatar
                )}
                {/* Cut out of the hue, as the board draws it. `isOnline` is
                    false for anybody hiding their status. */}
                {user.isOnline ? <View style={[styles.onlineDot, { borderColor: hue }]} /> : null}
                {badge ? (
                  <View pointerEvents="box-none" style={styles.proBadgeRow}>
                    <Pressable
                      accessibilityRole="button"
                      accessibilityLabel={t('profile.proBadge')}
                      accessibilityHint={t('profile.proSheetTitle', { plan: TIER_NAMES.pro })}
                      hitSlop={14}
                      onPress={() => setProSheetOpen(true)}
                      style={({ pressed }) => pressed && styles.pressed}
                    >
                      <ProMark style={[styles.proBadge, { borderColor: hue }]} />
                    </Pressable>
                  </View>
                ) : null}
              </View>

              <View style={styles.heroText}>
                <View style={styles.nameRow}>
                  <Text
                    style={[styles.name, !blackLoaded && styles.nameFallback]}
                    accessibilityRole="header"
                    numberOfLines={2}
                  >
                    {user.displayName}
                  </Text>
                  {/* An official account has no age, and wears its tick there.
                      Otherwise the server's age, as today — absent means none. */}
                  {user.official ? (
                    <OfficialMark size={18} />
                  ) : user.age !== undefined ? (
                    <Text style={styles.age}>{user.age}</Text>
                  ) : null}
                  <GenderMark gender={user.gender} color={v3.colors.ink} />
                </View>
                {title ? <TitleBadge id={title.id} /> : null}
                <Text style={[styles.handle, styles.hugStart]} numberOfLines={1}>
                  {handleLine}
                </Text>
                {user.pronouns ? (
                  <Text style={[styles.pronouns, styles.hugStart]} numberOfLines={1}>
                    {user.pronouns}
                  </Text>
                ) : null}
                {/* Read-only, and the whole of what anybody else is told. */}
                {active ? null : (
                  <View
                    style={[
                      styles.statusTag,
                      user.accountStatus === 'suspended' && styles.statusSuspended,
                    ]}
                  >
                    <Text
                      style={[
                        styles.statusLabel,
                        user.accountStatus === 'suspended' && styles.statusSuspendedLabel,
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
                <View style={styles.facts}>
                  {summary.data && !user.official ? (
                    <View
                      accessible
                      accessibilityLabel={t('profile.dayStreak', {
                        count: summary.data.streak.current,
                      })}
                      style={styles.streak}
                    >
                      <FlameGlyph size={v3.icon.xs} color={v3.colors.ink} />
                      <Text style={styles.fact}>{summary.data.streak.current}</Text>
                    </View>
                  ) : null}
                  {user.official ? null : (
                    <PresenceLine lastActiveAt={user.lastActiveAt} timezone={user.timezone} onHue />
                  )}
                </View>
              </View>
            </View>
          </View>

          <View style={styles.body}>
            {isSelf ? (
              <View style={styles.previewNote}>
                <Feather name="eye" size={v3.icon.md} color={v3.colors.fg} />
                <Text style={styles.previewNoteText}>{t('profile.previewNote')}</Text>
              </View>
            ) : null}

            {user.photos.length > 0 ? (
              <View style={styles.photos}>
                {user.photos.map((photo, index) => (
                  <Pressable
                    key={photo.url}
                    accessibilityRole="button"
                    accessibilityLabel={`${t('photo.open')} · ${t('photo.counter', { index: index + 1, total: user.photos.length })}`}
                    onPress={() => setPhotoAt(index)}
                    style={({ pressed }) => [styles.photo, pressed && styles.pressed]}
                  >
                    <Image
                      source={{ uri: photo.url }}
                      style={styles.photoImage}
                      contentFit="cover"
                    />
                  </Pressable>
                ))}
              </View>
            ) : null}

            {/* Nothing a program has an honest answer for. */}
            {user.official || (user.nativeLanguages.length === 0 && study.length === 0) ? null : (
              <View style={styles.languages}>
                <View style={styles.languageTile}>
                  <Text style={styles.kicker}>{t('profile.teaches')}</Text>
                  {user.nativeLanguages.map((language) => (
                    <View key={language.code}>
                      <Text style={styles.languageName}>{names.language(language.code)}</Text>
                      <Text style={styles.languageLevel}>{t('onboarding.native')}</Text>
                    </View>
                  ))}
                </View>
                <View style={styles.languageTile}>
                  <Text style={styles.kicker}>{t('profile.learns')}</Text>
                  {study.map((language) => (
                    <View
                      key={language.code}
                      accessible
                      accessibilityLabel={`${names.language(language.code)} · ${levelLabel(t, language.level)}`}
                    >
                      <View style={styles.languageHead}>
                        <Text style={[styles.languageName, styles.shrink]}>
                          {names.language(language.code)}
                        </Text>
                        <LevelBars level={language.level} size={14} />
                      </View>
                      <Text style={styles.languageLevel}>{levelLabel(t, language.level)}</Text>
                    </View>
                  ))}
                </View>
              </View>
            )}

            {stats.length > 0 ? (
              <View style={styles.stats}>
                {stats.map((stat) => (
                  <PressableScale
                    key={stat.key}
                    accessibilityRole="button"
                    accessibilityLabel={`${stat.label}: ${stat.value}`}
                    onPress={stat.onPress}
                    touchStyle={styles.statTouch}
                    style={[
                      styles.stat,
                      { backgroundColor: stat.tint ? v3.hues.mint : v3.colors.surface },
                    ]}
                  >
                    {/* The figure and the chevron on one line, the word under them:
                        "100%" beside "This week" left the word a column too
                        narrow to hold it, in English already. */}
                    <View style={styles.statHead}>
                      <Text
                        style={[
                          styles.statValue,
                          !blackLoaded && styles.nameFallback,
                          stat.tint && styles.onHue,
                        ]}
                        maxFontSizeMultiplier={1.4}
                        numberOfLines={1}
                      >
                        {stat.value}
                      </Text>
                      <Feather
                        name={chevron}
                        size={v3.icon.sm}
                        color={stat.tint ? v3.colors.ink : v3.colors.fg}
                      />
                    </View>
                    <Text style={[styles.statLabel, stat.tint && styles.onHue]} numberOfLines={2}>
                      {stat.label}
                    </Text>
                  </PressableScale>
                ))}
              </View>
            ) : null}

            {/* One button for the whole shelf, and nothing for nobody's badges. */}
            {showNumbers && showNumbers.topBadges.length > 0 ? (
              <PressableScale
                accessibilityRole="button"
                accessibilityLabel={t('profile.badgeStrip', {
                  count: showNumbers.topBadges.length,
                })}
                onPress={() => openBadges(user.handle, here)}
                style={styles.badges}
              >
                <View style={styles.badgeMarks}>
                  {(showNumbers.pinnedBadges ?? showNumbers.topBadges)
                    .slice(0, 3)
                    .map((b, index) => (
                      <View key={b.id} style={[styles.badgeMark, index > 0 && styles.badgeOverlap]}>
                        <BadgePatch id={b.id} size={BADGE} />
                      </View>
                    ))}
                </View>
                <Text style={styles.badgesLabel}>
                  {t('profile.badgeStrip', { count: showNumbers.topBadges.length })}
                </Text>
                <Feather name={chevron} size={v3.icon.md} color={v3.colors.muted} />
              </PressableScale>
            ) : null}

            {user.bio ? <Text style={styles.bio}>{user.bio}</Text> : null}

            {/* Read-only tags: nothing here is pressable. */}
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

            <ProfileTestimonials
              handle={user.handle}
              subject={{ _id: user._id, displayName: user.displayName, avatarUrl: user.avatarUrl }}
              here={here}
            />

            {user.official ? null : (
              <View style={styles.history}>
                <ActivityMap handle={user.handle} />
              </View>
            )}

            {/* Only if it is offered: the server sends no `week` otherwise. */}
            {summary.data?.week && !user.official ? (
              <View style={styles.history}>
                <WeeklyChart week={summary.data.week} />
              </View>
            ) : null}
          </View>
        </View>
      </ScrollView>

      {footer ? (
        <View style={[styles.footer, { paddingBottom: v3.space[16] + insets.bottom }]}>
          <View style={[styles.column, styles.footerRow]}>{footer}</View>
        </View>
      ) : null}

      {user.avatarUrl ? (
        <PhotoViewer
          photos={[{ url: user.avatarUrl }]}
          index={avatarOpen ? 0 : null}
          onClose={() => setAvatarOpen(false)}
        />
      ) : null}
      {user.photos.length > 0 ? (
        <PhotoViewer
          photos={user.photos}
          index={photoAt}
          onClose={() => setPhotoAt(null)}
          onIndexChange={setPhotoAt}
        />
      ) : null}
      {badge ? (
        <WhatsProSheet
          visible={proSheetOpen}
          name={user.displayName}
          end={badgeSheetEnd({
            loaded: me.data !== undefined,
            tier: viewerTier,
            guest: shouldGateGuest(session?.user),
            own: isSelf,
          })}
          onSeePlans={() => {
            setProSheetOpen(false)
            openPaywall(undefined, here, 'pro_badge')
          }}
          onClose={() => setProSheetOpen(false)}
        />
      ) : null}
      {sending ? (
        <ConversationPicker
          visible
          title={t('conversationPicker.sendProfileTitle')}
          onPick={(conversation) => void sendTo(conversation)}
          onClose={() => setSending(false)}
        />
      ) : null}
    </View>
  )
}

const AVATAR = 96
const BADGE = 40

const useStyles = makeStyles(({ v3 }) => ({
  root: { backgroundColor: v3.colors.bg, flex: 1 },
  fill: { flex: 1 },
  shrink: { flexShrink: 1 },
  pressed: { opacity: 0.7 },
  onHue: { color: v3.colors.ink },
  scrollContent: { alignItems: 'center', paddingBottom: v3.space[20] },
  column: { maxWidth: layout.maxWidth, width: '100%' },
  loadingBar: { minHeight: 44, paddingHorizontal: v3.space[8], paddingTop: v3.space[6] },
  loadingBody: { paddingHorizontal: v3.space[16] },
  missingBody: { gap: v3.space[16], paddingHorizontal: v3.space[16] },
  missing: {
    ...v3.type.body,
    color: v3.colors.muted,
    marginTop: v3.space[32],
    textAlign: 'center',
  },

  hero: {
    borderBottomEndRadius: v3.radius.hero,
    borderBottomStartRadius: v3.radius.hero,
    gap: v3.space[8],
    paddingBottom: v3.space[20],
    paddingHorizontal: v3.space[8],
    paddingTop: v3.space[6],
  },
  heroTop: { alignItems: 'center', flexDirection: 'row', gap: v3.space[8], minHeight: 44 },
  topTitle: { ...v3.type.headline, color: v3.colors.ink, flex: 1 },
  heroBody: {
    alignItems: 'center',
    flexDirection: 'row',
    gap: v3.space[16],
    paddingHorizontal: v3.space[8],
  },
  avatarWrap: { flexShrink: 0, paddingBottom: v3.space[8] },
  onlineDot: {
    backgroundColor: v3.colors.correction,
    borderRadius: v3.radius.pill,
    borderWidth: 4,
    end: 2,
    height: 22,
    position: 'absolute',
    top: 4,
    width: 22,
  },
  proBadgeRow: { alignItems: 'center', bottom: 0, end: 0, position: 'absolute', start: 0 },
  proBadge: { borderWidth: 3 },
  heroText: { flex: 1, gap: v3.space[2], minWidth: 0 },
  nameRow: { alignItems: 'baseline', flexDirection: 'row', flexWrap: 'wrap', gap: v3.space[8] },
  name: { ...v3.type.title, color: v3.colors.ink, flexShrink: 1 },
  // ExtraBold at Black's size until Black has loaded, so nothing reflows.
  nameFallback: { fontFamily: DISPLAY_FONT },
  age: { ...v3.type.headline, color: v3.colors.ink },
  handle: { ...v3.type.callout, color: v3.colors.ink, fontWeight: '700' },
  /*
   * Sized to its words and set at the start edge. A handle is Latin, and a
   * full-width Latin line aligns itself left even in Arabic; forcing the
   * paragraph right-to-left instead moves the "@" to the far end.
   */
  hugStart: { alignSelf: 'flex-start', maxWidth: '100%' },
  pronouns: { ...v3.type.caption, color: v3.colors.ink, fontWeight: '600' },
  statusTag: {
    alignSelf: 'flex-start',
    backgroundColor: v3.colors.onBlue,
    borderRadius: v3.radius.pill,
    marginTop: v3.space[4],
    paddingHorizontal: v3.space[10],
    paddingVertical: v3.space[2],
  },
  statusLabel: { ...v3.type.label, color: v3.colors.ink },
  // Ink rather than red: on a hue, ink is what reads in both schemes, and the
  // filled tag still tells a suspension from a deleted account at a glance.
  statusSuspended: { backgroundColor: v3.colors.ink },
  statusSuspendedLabel: { color: v3.colors.onBlue },
  facts: {
    alignItems: 'center',
    columnGap: v3.space[8],
    flexDirection: 'row',
    flexWrap: 'wrap',
    marginTop: v3.space[2],
    rowGap: v3.space[2],
  },
  streak: { alignItems: 'center', flexDirection: 'row', gap: v3.space[2] },
  fact: { ...v3.type.caption, color: v3.colors.ink, fontWeight: '700' },

  body: { gap: v3.space[14], paddingHorizontal: v3.space[12], paddingTop: v3.space[14] },
  previewNote: {
    alignItems: 'center',
    backgroundColor: v3.colors.surface,
    borderRadius: v3.radius.tile,
    flexDirection: 'row',
    gap: v3.space[10],
    paddingHorizontal: v3.space[14],
    paddingVertical: v3.space[12],
  },
  previewNoteText: { ...v3.type.callout, color: v3.colors.fg, flex: 1 },

  photos: { flexDirection: 'row', flexWrap: 'wrap', gap: v3.space[8] },
  // Three across, the gaps taken out of the row.
  photo: {
    backgroundColor: v3.colors.surface,
    borderRadius: v3.radius.tile,
    flexBasis: '31%',
    flexGrow: 1,
    height: 112,
    maxWidth: '33%',
    overflow: 'hidden',
  },
  photoImage: { height: '100%', width: '100%' },

  languages: { flexDirection: 'row', gap: v3.space[8] },
  languageTile: {
    backgroundColor: v3.colors.surface,
    borderRadius: v3.radius.tile,
    flex: 1,
    gap: v3.space[6],
    paddingHorizontal: v3.space[14],
    paddingVertical: v3.space[12],
  },
  kicker: { ...v3.type.label, color: v3.colors.muted },
  languageHead: { alignItems: 'center', flexDirection: 'row', gap: v3.space[6] },
  languageName: { ...v3.type.headline, color: v3.colors.fg },
  languageLevel: { ...v3.type.caption, color: v3.colors.muted },

  stats: { flexDirection: 'row', flexWrap: 'wrap', gap: v3.space[8] },
  statTouch: { flexBasis: '45%', flexGrow: 1 },
  stat: {
    borderRadius: v3.radius.tile,
    gap: v3.space[2],
    minHeight: 64,
    paddingEnd: v3.space[12],
    paddingStart: v3.space[14],
    paddingVertical: v3.space[10],
  },
  statHead: { alignItems: 'center', flexDirection: 'row', gap: v3.space[8] },
  statValue: { ...v3.type.title, color: v3.colors.fg, flex: 1 },
  statLabel: { ...v3.type.callout, color: v3.colors.fg, fontWeight: '700' },

  badges: {
    alignItems: 'center',
    backgroundColor: v3.colors.surface,
    borderRadius: v3.radius.tile,
    flexDirection: 'row',
    gap: v3.space[10],
    minHeight: 60,
    paddingHorizontal: v3.space[12],
    paddingVertical: v3.space[8],
  },
  badgeMarks: { flexDirection: 'row' },
  badgeMark: {
    backgroundColor: v3.colors.surface,
    borderRadius: v3.radius.pill,
    padding: 2,
  },
  badgeOverlap: { marginStart: -v3.space[10] },
  badgesLabel: { ...v3.type.button, color: v3.colors.fg, flex: 1 },

  bio: { ...v3.type.body, color: v3.colors.fg, paddingHorizontal: v3.space[4] },
  interests: { gap: v3.space[8], paddingHorizontal: v3.space[4] },
  tags: { flexDirection: 'row', flexWrap: 'wrap', gap: v3.space[6] },
  tag: {
    backgroundColor: v3.colors.surface,
    borderRadius: v3.radius.pill,
    paddingHorizontal: v3.space[12],
    paddingVertical: v3.space[6],
  },
  tagLabel: { ...v3.type.callout, color: v3.colors.fg, fontWeight: '700' },

  /*
   * On the ground, not on the board's grey card: the map's empty days are the
   * current look's `fill`, which all but vanishes on `surface`. The card
   * comes with a map drawn on v3's own track colour.
   */
  history: { paddingHorizontal: v3.space[4] },

  footer: {
    alignItems: 'center',
    backgroundColor: v3.colors.bg,
    borderTopColor: v3.colors.line,
    borderTopWidth: 1,
    paddingHorizontal: v3.space[12],
    paddingTop: v3.space[10],
  },
  footerRow: { alignItems: 'center', flexDirection: 'row', gap: v3.space[8] },
  grow: { flex: 1, width: 'auto' },
  follow: { flexShrink: 0, width: 'auto' },
  closedNote: {
    alignItems: 'center',
    flex: 1,
    flexDirection: 'row',
    gap: v3.space[8],
    minHeight: 56,
  },
  closedNoteText: { ...v3.type.caption, color: v3.colors.fg, flex: 1 },
}))

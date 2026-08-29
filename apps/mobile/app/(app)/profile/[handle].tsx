import { countryFlag, getCountry } from '@langx/shared'
import { router, useLocalSearchParams } from 'expo-router'
import { useState } from 'react'
import { ActivityIndicator, Pressable, StyleSheet, Text, TextInput, View } from 'react-native'
import { ApiRequestError } from '../../../src/api/client'
import {
  useBlockUser,
  useProfile,
  useReportUser,
  useStartConversation,
} from '../../../src/api/queries'
import { Avatar } from '../../../src/components/ui/Avatar'
import { Button } from '../../../src/components/ui/Button'
import { LanguageCards } from '../../../src/components/LanguageCards'
import { PhotoGallery } from '../../../src/components/PhotoGallery'
import { TierBadge } from '../../../src/components/TierBadge'
import { Chip } from '../../../src/components/ui/Chip'
import { Screen } from '../../../src/components/ui/Screen'
import { chooseAlert, confirmAlert } from '../../../src/lib/alert'
import { goBackTo } from '../../../src/lib/navigation'
import { openPaywall } from '../../../src/lib/paywall'
import { showToast } from '../../../src/lib/toast'
import { days } from '../../../src/lib/format'
import { makeStyles, useTheme } from '../../../src/lib/theme'
import { accountAgeLabel, interestLabel, useDisplayNames, useT } from '../../../src/i18n'

export default function ProfileScreen() {
  const { colors, layout } = useTheme()
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
  const startConversation = useStartConversation()
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

  return (
    <Screen scroll>
      <Pressable
        onPress={() => goBackTo('/(app)/discover', from)}
        hitSlop={12}
        style={styles.backRow}
      >
        <Text style={styles.back}>{t('common.back')}</Text>
      </Pressable>

      <View style={styles.hero}>
        <Avatar
          url={user.avatarUrl}
          name={user.displayName}
          size={layout.avatarLarge}
          online={user.isOnline}
        />
        <Text style={styles.name}>{user.displayName}</Text>
        <Text style={styles.handle}>@{user.handle}</Text>
        {/*
          How long the account has existed, next to who it says it is: the two
          questions someone asks about a stranger who just messaged them are
          the same question, and only one of them was answered here before.
        */}
        <Text style={styles.joined}>
          {t('profile.registeredLabel')} {accountAgeLabel(t, new Date(user.createdAt))}
        </Text>
        <View style={styles.badges}>
          <Chip label={`${user.age}`} />
          {user.country ? <Chip label={countryLabel(user.country)} /> : null}
          {user.streak.current > 0 ? (
            <Chip label={`🔥 ${days(t, user.streak.current)}`} tone="streak" />
          ) : null}
          {user.emailVerified ? <Chip label={t('profile.verifiedEmail')} tone="accent" /> : null}
          <TierBadge tier={user.tier} />
        </View>
      </View>

      <PhotoGallery photos={user.photos} />

      {user.bio ? <Text style={styles.bio}>{user.bio}</Text> : null}

      <LanguageCards native={user.nativeLanguages} learning={user.learning} />

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

      <Text style={styles.sectionTitle}>{t('profile.sendMessage')}</Text>
      <TextInput
        value={message}
        onChangeText={setMessage}
        placeholder={t('chat.sayHello', { name: user.displayName })}
        placeholderTextColor={colors.textMuted}
        style={styles.input}
        multiline
      />
      {error ? <Text style={styles.error}>{error}</Text> : null}
      <Button
        label={t('common.send')}
        disabled={message.trim().length === 0}
        loading={startConversation.isPending}
        onPress={send}
        style={styles.send}
      />

      <View style={styles.danger}>
        <Pressable onPress={() => void confirmReport()} hitSlop={8}>
          <Text style={styles.dangerText}>{t('common.report')}</Text>
        </Pressable>
        <Pressable onPress={() => void confirmBlock()} hitSlop={8}>
          <Text style={styles.dangerText}>{t('common.block')}</Text>
        </Pressable>
      </View>
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
  backRow: { paddingVertical: spacing.sm },
  back: { ...font.body, color: colors.textMuted },
  hero: { alignItems: 'center', paddingVertical: spacing.lg },
  name: { ...font.title, color: colors.text, marginTop: spacing.md },
  handle: { ...font.caption, color: colors.textMuted },
  joined: { ...font.caption, color: colors.textMuted, marginTop: spacing.xs },
  badges: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: spacing.xs,
    justifyContent: 'center',
    marginTop: spacing.md,
  },
  bio: { ...font.body, color: colors.text, marginBottom: spacing.md },
  sectionTitle: {
    ...font.label,
    color: colors.textMuted,
    marginBottom: spacing.sm,
    marginTop: spacing.lg,
  },
  chips: { flexDirection: 'row', flexWrap: 'wrap', gap: spacing.xs },
  input: {
    backgroundColor: colors.surface,
    borderRadius: radius.md,
    color: colors.text,
    minHeight: 88,
    padding: spacing.md,
    textAlignVertical: 'top',
    ...font.body,
  },
  error: { ...font.caption, color: colors.danger, marginTop: spacing.sm },
  send: { marginTop: spacing.md },
  danger: {
    borderTopColor: colors.border,
    borderTopWidth: StyleSheet.hairlineWidth,
    flexDirection: 'row',
    gap: spacing.xl,
    justifyContent: 'center',
    marginTop: spacing.xxl,
    paddingTop: spacing.lg,
  },
  dangerText: { ...font.caption, color: colors.danger },
}))

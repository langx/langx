import { getLanguage } from '@langx/shared'
import { router, useLocalSearchParams } from 'expo-router'
import { useState } from 'react'
import {
  ActivityIndicator,
  Alert,
  Pressable,
  StyleSheet,
  Text,
  TextInput,
  View,
} from 'react-native'
import { ApiRequestError } from '../../../src/api/client'
import {
  useBlockUser,
  useProfile,
  useReportUser,
  useStartConversation,
} from '../../../src/api/queries'
import { Avatar } from '../../../src/components/ui/Avatar'
import { Button } from '../../../src/components/ui/Button'
import { Chip } from '../../../src/components/ui/Chip'
import { Screen } from '../../../src/components/ui/Screen'
import { colors, font, layout, radius, spacing } from '../../../src/lib/theme'

export default function ProfileScreen() {
  const { handle } = useLocalSearchParams<{ handle: string }>()
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
        <Text style={styles.missing}>Bu profil bulunamadı.</Text>
        <Button label="Geri" variant="secondary" onPress={() => router.back()} />
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
          router.push('/(app)/paywall')
          return
        }
        if (caught.code === 'CONVERSATION_EXISTS') {
          router.replace('/(app)/chats')
          return
        }
        setError(caught.message)
      } else {
        setError('Mesaj gönderilemedi.')
      }
    }
  }

  function confirmBlock(): void {
    Alert.alert(
      'Engelle',
      `${user.displayName} engellensin mi? Birbirinizi hiçbir listede göremezsiniz.`,
      [
        { text: 'Vazgeç', style: 'cancel' },
        {
          text: 'Engelle',
          style: 'destructive',
          onPress: () => {
            block.mutate(user._id, { onSuccess: () => router.replace('/(app)/discover') })
          },
        },
      ],
    )
  }

  function confirmReport(): void {
    Alert.alert('Şikayet et', 'Bu profili neden bildiriyorsun?', [
      { text: 'Vazgeç', style: 'cancel' },
      { text: 'Spam', onPress: () => report.mutate({ userId: user._id, reason: 'spam' }) },
      { text: 'Taciz', onPress: () => report.mutate({ userId: user._id, reason: 'harassment' }) },
      {
        text: 'Uygunsuz içerik',
        onPress: () => report.mutate({ userId: user._id, reason: 'inappropriate_content' }),
      },
    ])
  }

  return (
    <Screen scroll>
      <Pressable onPress={() => router.back()} hitSlop={12} style={styles.backRow}>
        <Text style={styles.back}>‹ Geri</Text>
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
        <View style={styles.badges}>
          <Chip label={`${user.age}`} />
          {user.country ? <Chip label={user.country} /> : null}
          {user.streak.current > 0 ? (
            <Chip label={`🔥 ${user.streak.current} gün`} tone="streak" />
          ) : null}
          {user.tier === 'pro' ? <Chip label="PRO" tone="pro" selected /> : null}
        </View>
      </View>

      {user.bio ? <Text style={styles.bio}>{user.bio}</Text> : null}

      <Text style={styles.sectionTitle}>Konuşuyor</Text>
      <View style={styles.chips}>
        {user.nativeLanguages.map((l) => (
          <Chip key={l.code} label={getLanguage(l.code)?.name ?? l.code} tone="accent" selected />
        ))}
      </View>

      <Text style={styles.sectionTitle}>Öğreniyor</Text>
      <View style={styles.chips}>
        {user.learning.map((l) => (
          <Chip
            key={l.code}
            label={`${getLanguage(l.code)?.name ?? l.code} · ${l.level}`}
            tone="accent"
          />
        ))}
      </View>

      {user.interests.length > 0 ? (
        <>
          <Text style={styles.sectionTitle}>İlgi alanları</Text>
          <View style={styles.chips}>
            {user.interests.map((interest) => (
              <Chip key={interest} label={interest} />
            ))}
          </View>
        </>
      ) : null}

      <Text style={styles.sectionTitle}>Mesaj gönder</Text>
      <TextInput
        value={message}
        onChangeText={setMessage}
        placeholder={`${user.displayName} kişisine merhaba de…`}
        placeholderTextColor={colors.textMuted}
        style={styles.input}
        multiline
      />
      {error ? <Text style={styles.error}>{error}</Text> : null}
      <Button
        label="Gönder"
        disabled={message.trim().length === 0}
        loading={startConversation.isPending}
        onPress={send}
        style={styles.send}
      />

      <View style={styles.danger}>
        <Pressable onPress={confirmReport} hitSlop={8}>
          <Text style={styles.dangerText}>Şikayet et</Text>
        </Pressable>
        <Pressable onPress={confirmBlock} hitSlop={8}>
          <Text style={styles.dangerText}>Engelle</Text>
        </Pressable>
      </View>
    </Screen>
  )
}

const styles = StyleSheet.create({
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
})

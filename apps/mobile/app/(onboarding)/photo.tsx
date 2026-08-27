import { INTEREST_SUGGESTIONS, MAX_INTERESTS } from '@langx/shared'
import * as ImagePicker from 'expo-image-picker'
import { router } from 'expo-router'
import { useState } from 'react'
import { Alert, Pressable, StyleSheet, Text, View } from 'react-native'
import { Image } from 'expo-image'
import { uploadAvatarBytes } from '../../src/api/queries'
import { CountryPicker } from '../../src/components/CountryPicker'
import { Button } from '../../src/components/ui/Button'
import { Chip } from '../../src/components/ui/Chip'
import { Screen } from '../../src/components/ui/Screen'
import { updateDraft, useOnboardingDraft } from '../../src/hooks/useOnboardingDraft'
import { colors, font, radius, spacing } from '../../src/lib/theme'

/**
 * Step 3 of 4, and both halves of it are skippable.
 *
 * `docs/architecture.md` has described the wizard as "languages + levels →
 * gender/bio/avatar/interests → username claim" from the beginning; the avatar
 * and the interests were the part nobody wrote. Without them a new account
 * arrives in discovery as a letter on a grey circle with nothing to talk
 * about, which is the worst possible first impression in a product whose whole
 * mechanic is strangers choosing each other.
 *
 * The picture is uploaded here but **not** confirmed: `confirm` writes onto a
 * profile and there is no profile until the last step. The URL rides in the
 * draft and `POST /profiles` writes it, running the same bucket check.
 */
export default function PhotoStep() {
  const draft = useOnboardingDraft()
  const [uploading, setUploading] = useState(false)

  async function pickPhoto(): Promise<void> {
    const permission = await ImagePicker.requestMediaLibraryPermissionsAsync()
    if (!permission.granted) {
      Alert.alert('Photos unavailable', 'LangX needs access to your photos to set a picture.')
      return
    }

    const picked = await ImagePicker.launchImageLibraryAsync({
      mediaTypes: ['images'],
      allowsEditing: true,
      aspect: [1, 1],
      quality: 0.8,
    })
    const asset = picked.assets?.[0]
    if (picked.canceled || !asset) return

    setUploading(true)
    try {
      const url = await uploadAvatarBytes(asset.uri, asset.mimeType ?? 'image/jpeg')
      updateDraft({ avatarUrl: url })
    } catch {
      Alert.alert('Upload failed', 'That picture did not upload. You can try again or skip.')
    } finally {
      setUploading(false)
    }
  }

  function toggleInterest(interest: string): void {
    const chosen = draft.interests.includes(interest)
    if (chosen) {
      updateDraft({ interests: draft.interests.filter((each) => each !== interest) })
      return
    }
    // Silently ignoring the tap past the cap would read as a broken chip, so
    // the counter above says what the limit is before anyone reaches it.
    if (draft.interests.length >= MAX_INTERESTS) return
    updateDraft({ interests: [...draft.interests, interest] })
  }

  return (
    <Screen scroll>
      <Text style={styles.step}>3 / 4</Text>
      <Text style={styles.title}>Put a face to it</Text>
      <Text style={styles.hint}>
        Both of these are optional, and both make people far more likely to say hello.
      </Text>

      <View style={styles.avatarRow}>
        {draft.avatarUrl ? (
          <Image source={{ uri: draft.avatarUrl }} style={styles.avatar} contentFit="cover" />
        ) : (
          <View style={[styles.avatar, styles.avatarEmpty]}>
            <Text style={styles.avatarEmptyText}>+</Text>
          </View>
        )}
        <Button
          label={uploading ? 'Uploading…' : draft.avatarUrl ? 'Change photo' : 'Add a photo'}
          variant="secondary"
          loading={uploading}
          onPress={() => void pickPhoto()}
          style={styles.avatarAction}
        />
      </View>

      <Text style={styles.label}>
        Interests {draft.interests.length > 0 ? `(${draft.interests.length}/${MAX_INTERESTS})` : ''}
      </Text>
      <Text style={styles.hint}>Something for a stranger to open with.</Text>
      <View style={styles.chips}>
        {INTEREST_SUGGESTIONS.map((interest) => (
          <Chip
            key={interest}
            label={interest}
            selected={draft.interests.includes(interest)}
            onPress={() => toggleInterest(interest)}
          />
        ))}
      </View>

      {/*
        `country` has been in the onboarding schema and in the draft from the
        start with no screen writing it, so every account created through the
        wizard had none — and discovery's country filter had nothing to match.
      */}
      <View style={styles.country}>
        <CountryPicker
          label="Where are you?"
          value={draft.country}
          onChange={(country) => updateDraft({ country })}
        />
      </View>

      <Button
        label="Continue"
        onPress={() => router.push('/(onboarding)/handle')}
        style={styles.cta}
      />
      <Pressable onPress={() => router.push('/(onboarding)/handle')} hitSlop={8}>
        <Text style={styles.skip}>Skip for now</Text>
      </Pressable>
    </Screen>
  )
}

const styles = StyleSheet.create({
  step: { ...font.caption, color: colors.textMuted, marginTop: spacing.lg },
  title: { ...font.title, color: colors.text, marginTop: spacing.xs },
  hint: { ...font.caption, color: colors.textMuted, marginBottom: spacing.md },
  avatarRow: { alignItems: 'center', flexDirection: 'row', gap: spacing.lg },
  avatar: { borderRadius: radius.pill, height: 88, width: 88 },
  avatarEmpty: {
    alignItems: 'center',
    backgroundColor: colors.surface,
    borderColor: colors.border,
    borderStyle: 'dashed',
    borderWidth: 1,
    justifyContent: 'center',
  },
  avatarEmptyText: { color: colors.textMuted, fontSize: 28 },
  // Undoes Button's full-width default, which is wrong beside the avatar.
  avatarAction: { flexShrink: 1, width: 'auto' },
  label: { ...font.label, color: colors.text, marginTop: spacing.xl },
  chips: { flexDirection: 'row', flexWrap: 'wrap', gap: spacing.xs },
  country: { marginTop: spacing.xl },
  cta: { marginTop: spacing.xl },
  skip: {
    ...font.body,
    alignSelf: 'center',
    color: colors.textMuted,
    marginTop: spacing.md,
    paddingVertical: spacing.sm,
  },
})

import { INTEREST_SUGGESTIONS, MAX_INTERESTS } from '@langx/shared'
import { router } from 'expo-router'
import { useState } from 'react'
import { Pressable, Text, View } from 'react-native'
import { Image } from 'expo-image'
import { uploadAvatarBytes } from '../../src/api/queries'
import { StepProgress } from '../../src/components/StepProgress'
import { Button } from '../../src/components/ui/Button'
import { Chip } from '../../src/components/ui/Chip'
import { Screen } from '../../src/components/ui/Screen'
import { updateDraft, useOnboardingDraft } from '../../src/hooks/useOnboardingDraft'
import { showAlert } from '../../src/lib/alert'
import { pickImageAsset } from '../../src/lib/pickMediaAsset'
import { makeStyles } from '../../src/lib/theme'
import { interestLabel, useT } from '../../src/i18n'
import { useScreenInteractive } from '../../src/hooks/useScreenInteractive'

/**
 * Step 4 of 5, and both halves of it are skippable.
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
  useScreenInteractive()
  const styles = useStyles()
  const t = useT()

  const draft = useOnboardingDraft()
  const [uploading, setUploading] = useState(false)

  async function pickPhoto(): Promise<void> {
    const picked = await pickImageAsset({ allowsEditing: true, aspect: [1, 1] })
    if (picked.status === 'denied') {
      void showAlert(
        picked.source === 'camera' ? t('media.cameraTitle') : t('onboarding.photoUnavailable'),
        picked.source === 'camera' ? t('media.cameraPermission') : t('onboarding.photoPermission'),
      )
      return
    }
    if (picked.status === 'unsupported') {
      void showAlert(t('errors.uploadFailed'), t('errors.attachmentUnsupported'))
      return
    }
    if (picked.status === 'cancelled') return

    setUploading(true)
    try {
      const url = await uploadAvatarBytes(picked.image.uri, picked.image.contentType)
      updateDraft({ avatarUrl: url })
    } catch {
      void showAlert(t('errors.uploadFailed'), t('onboarding.photoUploadFailed'))
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
      <StepProgress step="photo" />
      <Text style={styles.title}>{t('onboarding.photoTitle')}</Text>
      <Text style={styles.subtitle}>{t('onboarding.photoBody')}</Text>

      <View style={styles.avatarRow}>
        {draft.avatarUrl ? (
          <Image source={{ uri: draft.avatarUrl }} style={styles.avatar} contentFit="cover" />
        ) : (
          <View style={[styles.avatar, styles.avatarEmpty]}>
            <Text style={styles.avatarEmptyText}>+</Text>
          </View>
        )}
        <Pressable
          accessibilityRole="button"
          accessibilityState={{ disabled: uploading, busy: uploading }}
          disabled={uploading}
          hitSlop={8}
          onPress={() => void pickPhoto()}
          style={({ pressed }) => pressed && styles.pressed}
        >
          <Text style={styles.avatarAction}>
            {uploading
              ? t('onboarding.uploading')
              : draft.avatarUrl
                ? t('onboarding.changePhoto')
                : t('onboarding.addPhoto')}
          </Text>
        </Pressable>
      </View>

      <Text style={styles.label}>
        {t('onboarding.interests')}{' '}
        {draft.interests.length > 0 ? `(${draft.interests.length}/${MAX_INTERESTS})` : ''}
      </Text>
      <Text style={styles.hint}>{t('onboarding.bioPrompt')}</Text>
      <View style={styles.chips}>
        {INTEREST_SUGGESTIONS.map((interest) => (
          <Chip
            key={interest}
            label={interestLabel(t, interest)}
            selected={draft.interests.includes(interest)}
            onPress={() => toggleInterest(interest)}
          />
        ))}
      </View>

      {/*
        No country question any more. It used to be a picker here; it is read
        off the connection at `POST /profiles` now, because a self-declared
        country makes discovery's country filter mean nothing. Somebody who
        wants to correct it grants location permission in Settings.
      */}

      <Button
        label={t('common.continue')}
        onPress={() => router.push('/(onboarding)/handle')}
        style={styles.cta}
      />
      <Pressable
        accessibilityRole="button"
        onPress={() => router.push('/(onboarding)/handle')}
        hitSlop={8}
      >
        <Text style={styles.skip}>{t('common.skip')}</Text>
      </Pressable>
    </Screen>
  )
}

const useStyles = makeStyles(({ colors, font, spacing, radius }) => ({
  title: { ...font.title, color: colors.text, lineHeight: 38, marginTop: spacing.xl + 2 },
  subtitle: {
    ...font.body,
    color: colors.textMuted,
    fontSize: 16,
    lineHeight: 24,
    marginTop: spacing.sm + 2,
  },
  avatarRow: { alignItems: 'center', flexDirection: 'row', gap: spacing.lg, marginTop: spacing.xl },
  avatar: { borderRadius: radius.pill, height: 88, width: 88 },
  // The `fill` grey, not a dashed outline: v3 draws placeholders as soft
  // fills, and structure never comes from boxes.
  avatarEmpty: {
    alignItems: 'center',
    backgroundColor: colors.fill,
    justifyContent: 'center',
  },
  avatarEmptyText: { color: colors.textFaint, fontSize: 30 },
  avatarAction: { color: colors.accent, fontSize: 15, fontWeight: '700' },
  label: { color: colors.textMuted, fontSize: 14, fontWeight: '600', marginTop: spacing.xl },
  hint: { ...font.caption, color: colors.textFaint, fontSize: 13, marginTop: 2 },
  chips: { flexDirection: 'row', flexWrap: 'wrap', gap: spacing.sm, marginTop: spacing.md },
  pressed: { opacity: 0.7 },
  cta: { marginTop: spacing.xl },
  skip: {
    alignSelf: 'center',
    color: colors.accent,
    fontSize: 15,
    fontWeight: '600',
    marginTop: spacing.md,
    paddingVertical: spacing.sm,
  },
}))

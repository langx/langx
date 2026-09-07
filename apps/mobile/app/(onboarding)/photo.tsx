import { BIO_MAX_LENGTH } from '@langx/shared'
import Feather from '@expo/vector-icons/Feather'
import { router } from 'expo-router'
import { useState } from 'react'
import { Pressable, ScrollView, Text, View } from 'react-native'
import { Image } from 'expo-image'
import { uploadAvatarBytes } from '../../src/api/queries'
import { StepProgress } from '../../src/components/StepProgress'
import { Button } from '../../src/components/ui/Button'
import { FormField } from '../../src/components/ui/FormField'
import { Screen } from '../../src/components/ui/Screen'
import { updateDraft, useOnboardingDraft } from '../../src/hooks/useOnboardingDraft'
import { showAlert } from '../../src/lib/alert'
import { goBackTo } from '../../src/lib/navigation'
import { pickImageAsset } from '../../src/lib/pickMediaAsset'
import { makeStyles, useTheme } from '../../src/lib/theme'
import { useT } from '../../src/i18n'
import { useScreenInteractive } from '../../src/hooks/useScreenInteractive'

/**
 * Step 4 of 5, and both halves of it are skippable.
 *
 * `docs/architecture.md` has described the wizard as "languages + levels →
 * gender/bio/avatar/interests → username claim" from the beginning; the avatar
 * and the bio are the two that make a first impression. Without them a new
 * account arrives in discovery as a letter on a grey circle with nothing to
 * open with, which is the worst possible first impression in a product whose
 * whole mechanic is strangers choosing each other. Interests wait for the
 * profile editor — v3 keeps this step to the two.
 *
 * The picture is uploaded here but **not** confirmed: `confirm` writes onto a
 * profile and there is no profile until the last step. The URL rides in the
 * draft and `POST /profiles` writes it, running the same bucket check.
 */
export default function PhotoStep() {
  useScreenInteractive()
  const styles = useStyles()
  const { colors } = useTheme()
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

  // The name is required two steps back, so there is always a letter to show.
  const initial = draft.displayName.trim().charAt(0).toUpperCase()
  const photoLabel = uploading
    ? t('onboarding.uploading')
    : draft.avatarUrl
      ? t('onboarding.changePhoto')
      : t('onboarding.addPhoto')

  return (
    <Screen fluid>
      {/*
        Own scroll view rather than `Screen scroll`: the content grows to the
        height, which is what pins the two buttons to the bottom while the
        form is shorter than the screen, and the keyboard inset is the same
        one `Screen` documents.
      */}
      <ScrollView
        style={styles.scroll}
        contentContainerStyle={styles.content}
        keyboardShouldPersistTaps="handled"
        automaticallyAdjustKeyboardInsets
      >
        <StepProgress step="photo" onBack={() => goBackTo('/(onboarding)/about-you')} />
        <Text style={styles.title}>{t('onboarding.photoTitle')}</Text>
        <Text style={styles.subtitle}>{t('onboarding.photoBody')}</Text>

        <View style={styles.avatarBlock}>
          <Pressable
            accessibilityRole="button"
            accessibilityLabel={photoLabel}
            accessibilityState={{ disabled: uploading, busy: uploading }}
            disabled={uploading}
            onPress={() => void pickPhoto()}
            style={({ pressed }) => [styles.avatar, pressed && styles.pressed]}
          >
            {draft.avatarUrl ? (
              <Image source={{ uri: draft.avatarUrl }} style={styles.photo} contentFit="cover" />
            ) : (
              <Text style={styles.initial}>{initial}</Text>
            )}
            <View style={styles.badge}>
              <Feather name="camera" size={20} color={colors.text} />
            </View>
          </Pressable>
          <Pressable
            accessibilityRole="button"
            accessibilityState={{ disabled: uploading, busy: uploading }}
            disabled={uploading}
            hitSlop={8}
            onPress={() => void pickPhoto()}
            style={({ pressed }) => [styles.avatarAction, pressed && styles.pressed]}
          >
            <Text style={styles.avatarActionText}>{photoLabel}</Text>
          </Pressable>
        </View>

        <View style={styles.bio}>
          <FormField
            label={t('onboarding.aboutYouOptional')}
            value={draft.bio}
            onChangeText={(bio) => updateDraft({ bio })}
            placeholder={t('onboarding.bioPrompt')}
            multiline
            maxLength={BIO_MAX_LENGTH}
          />
        </View>

        {/*
          No country question any more. It used to be a picker here; it is read
          off the connection at `POST /profiles` now, because a self-declared
          country makes discovery's country filter mean nothing. Somebody who
          wants to correct it grants location permission in Settings.
        */}

        <Button label={t('common.continue')} onPress={() => router.push('/(onboarding)/handle')} />
        <Pressable
          accessibilityRole="button"
          hitSlop={8}
          onPress={() => router.push('/(onboarding)/handle')}
          style={({ pressed }) => [styles.skip, pressed && styles.pressed]}
        >
          <Text style={styles.skipText}>{t('common.skip')}</Text>
        </Pressable>
      </ScrollView>
    </Screen>
  )
}

const useStyles = makeStyles(({ colors, font, spacing, radius, cardShadow }) => ({
  scroll: { flex: 1 },
  // v3's wizard column: 8 above the progress block, 18 between blocks, 28
  // under the button so it is not sitting on the home indicator.
  content: { flexGrow: 1, gap: 18, paddingBottom: 28, paddingTop: spacing.sm },
  title: { ...font.title, color: colors.text, lineHeight: 38, marginTop: 10 },
  subtitle: { color: colors.textMuted, fontSize: 16, lineHeight: 24 },
  avatarBlock: { alignItems: 'center', gap: 14, paddingVertical: spacing.lg },
  avatar: {
    alignItems: 'center',
    backgroundColor: colors.accent,
    borderRadius: radius.pill,
    height: 120,
    justifyContent: 'center',
    width: 120,
  },
  photo: { borderRadius: radius.pill, height: 120, width: 120 },
  initial: { ...font.heading, color: colors.textInverse, fontSize: 44 },
  // A disc of the ground colour on the circle's edge, lifted by the card
  // shadow so it reads as a button rather than a hole in the avatar.
  badge: {
    ...cardShadow,
    alignItems: 'center',
    backgroundColor: colors.bg,
    borderRadius: radius.pill,
    bottom: -2,
    end: -2,
    height: 40,
    justifyContent: 'center',
    position: 'absolute',
    width: 40,
  },
  avatarAction: { height: 40, justifyContent: 'center' },
  avatarActionText: { color: colors.accent, fontSize: 15, fontWeight: '600' },
  bio: { flex: 1 },
  // Tucked under the button: the prototype pulls it up by 8 of the 18 gap.
  skip: { alignItems: 'center', height: 44, justifyContent: 'center', marginTop: -8 },
  skipText: { color: colors.accent, fontSize: 15, fontWeight: '600' },
  pressed: { opacity: 0.7 },
}))

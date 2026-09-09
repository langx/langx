import { BIO_MAX_LENGTH } from '@langx/shared'
import Feather from '@expo/vector-icons/Feather'
import { router } from 'expo-router'
import { useState } from 'react'
import { Pressable, ScrollView, Text, View } from 'react-native'
import { ApiRequestError } from '../../src/api/client'
import { useMe, useUpdateProfile, useUploadAvatar } from '../../src/api/queries'
import { StepProgress } from '../../src/components/StepProgress'
import { Avatar } from '../../src/components/ui/Avatar'
import { Button } from '../../src/components/ui/Button'
import { FormField } from '../../src/components/ui/FormField'
import { Screen } from '../../src/components/ui/Screen'
import { showAlert } from '../../src/lib/alert'
import { pickImageAsset } from '../../src/lib/pickMediaAsset'
import { makeStyles, useTheme } from '../../src/lib/theme'
import { useT } from '../../src/i18n'
import { useScreenInteractive } from '../../src/hooks/useScreenInteractive'

/**
 * The last step, and both halves of it are skippable.
 *
 * The avatar and the bio are the two things that make a first impression.
 * Without them a new account arrives in discovery as a letter on a grey circle
 * with nothing to open with, which is the worst possible first impression in a
 * product whose whole mechanic is strangers choosing each other. Interests
 * wait for the profile editor — v3 keeps this step to the two.
 *
 * v3 claims the username *before* this screen, so the profile already exists
 * when it opens. The picture therefore goes through the same upload-and-confirm
 * the profile editor uses, and the bio is a plain `PATCH /profiles/me` — nothing
 * rides in the draft any more, which is also why there is no way back: the
 * claim behind this screen cannot be undone.
 */
export default function PhotoStep() {
  useScreenInteractive()
  const styles = useStyles()
  const { colors } = useTheme()
  const t = useT()

  const me = useMe()
  const uploadAvatar = useUploadAvatar()
  const updateProfile = useUpdateProfile()
  const [bio, setBio] = useState('')
  const [saving, setSaving] = useState(false)
  const uploading = uploadAvatar.isPending

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

    try {
      await uploadAvatar.mutateAsync(picked.image)
    } catch (caught) {
      // The same split the profile editor makes: storage may simply not be
      // configured on this instance, which is not something to try again.
      void showAlert(
        t('errors.uploadFailed'),
        caught instanceof ApiRequestError && caught.code === 'INTERNAL'
          ? t('editProfile.storageUnconfigured')
          : t('onboarding.photoUploadFailed'),
      )
    }
  }

  /**
   * Saves the bio if there is one, then on to the finish screen. Skipping is
   * the same navigation without the save; the picture, if any, is already on
   * the profile.
   */
  async function finish(save: boolean): Promise<void> {
    const text = bio.trim()
    if (save && text.length > 0) {
      setSaving(true)
      try {
        await updateProfile.mutateAsync({ bio: text })
      } catch {
        setSaving(false)
        void showAlert(t('editProfile.saveFailed'), t('common.retry'))
        return
      }
      setSaving(false)
    }
    router.replace('/(onboarding)/done')
  }

  const avatarUrl = me.data?.avatarUrl
  const photoLabel = uploading
    ? t('onboarding.uploading')
    : avatarUrl
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
        {/* No back arrow: the username behind this screen is claimed and the profile exists. */}
        <StepProgress step="photo" />
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
            {/*
              The drawn face, not an initial: this is the one screen whose
              question is "a photo, or the face we made you", and it used to
              answer it with a letter nothing else in the app ever shows.
              `Avatar` already walks photo → drawn face → initials.
            */}
            <Avatar
              url={avatarUrl}
              name={me.data?.displayName ?? ''}
              seed={me.data?._id}
              size={120}
            />
            <View style={styles.badge}>
              <Feather name="camera" size={20} color={colors.text} />
            </View>
          </Pressable>
          {/* Only while it is the face on screen; a photo speaks for itself. */}
          {avatarUrl ? null : <Text style={styles.drawnFace}>{t('onboarding.drawnFace')}</Text>}
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
            value={bio}
            onChangeText={setBio}
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

        <Button
          label={t('onboarding.startUsing')}
          loading={saving}
          disabled={uploading}
          onPress={() => finish(true)}
        />
        <Pressable
          accessibilityRole="button"
          hitSlop={8}
          onPress={() => void finish(false)}
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
  drawnFace: { color: colors.textFaint, fontSize: 13, lineHeight: 18, textAlign: 'center' },
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

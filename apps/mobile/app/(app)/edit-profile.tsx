import {
  BIO_MAX_LENGTH,
  LANGUAGE_LEVELS,
  LEVEL_SHORT_LABELS,
  CITY_MAX_LENGTH,
  DISPLAY_NAME_MAX_LENGTH,
  INTEREST_SUGGESTIONS,
  MAX_INTERESTS,
  PLAN_LIMITS,
  getLanguage,
  type LanguageLevel,
} from '@langx/shared'
import { useState } from 'react'
import { ActivityIndicator, Image, Pressable, ScrollView, Text, View } from 'react-native'
import {
  useAddPhoto,
  useEffectiveTier,
  useMe,
  useRemovePhoto,
  useDiscloseGender,
  useUpdateProfile,
  useUploadAvatar,
  type MeProfile,
} from '../../src/api/queries'
import { LoadFailed } from '../../src/components/LoadFailed'
import { ApiRequestError } from '../../src/api/client'
import { LanguagePicker } from '../../src/components/LanguagePicker'
import { Avatar } from '../../src/components/ui/Avatar'
import { Button } from '../../src/components/ui/Button'
import { Chip } from '../../src/components/ui/Chip'
import { FormField } from '../../src/components/ui/FormField'
import { LevelBars } from '../../src/components/ui/LevelBars'
import { CountryFromLocation } from '../../src/components/CountryFromLocation'
import { Screen } from '../../src/components/ui/Screen'
import { ScreenHeader } from '../../src/components/ui/ScreenHeader'
import { goBackTo } from '../../src/lib/navigation'
import { confirmAlert, showAlert } from '../../src/lib/alert'
import { pickImageAsset } from '../../src/lib/pickImageAsset'
import { showToast } from '../../src/lib/toast'
import { makeStyles } from '../../src/lib/theme'
import { genderLabel, interestLabel, levelShortLabel, useDisplayNames, useT } from '../../src/i18n'

/**
 * Splitting the form out of the loading state is not cosmetic.
 *
 * `useState(profile?.displayName ?? '')` runs on the component's *first*
 * render, and hooks cannot sit behind an early return — so with the query
 * still pending, every field initialised to empty and stayed empty once the
 * data arrived. The form was silently always blank. Rendering `<Form>` only
 * once the profile exists means its initialisers see the real values, which is
 * what a `key`-based remount would buy without the indirection.
 */
/**
 * What can be disclosed after onboarding. `undisclosed` is missing on purpose:
 * it is the state being left, and the server has no way back to it.
 */
const DISCLOSABLE_GENDERS = ['female', 'male', 'other'] as const

export default function EditProfileScreen() {
  const styles = useStyles()

  const me = useMe()

  /*
   * `!me.data` rather than `isPending`, and an error branch beside it.
   * `useMe` does not retry, so a refused request settles at once with nothing
   * — and `isPending || !me.data` stayed true forever, leaving this screen on
   * a spinner with no end and nothing to press. Data already in hand still
   * wins over a failed refetch, which is what checking it first says.
   */
  if (!me.data) {
    return (
      <Screen>
        {me.isError ? (
          <LoadFailed onRetry={() => void me.refetch()} />
        ) : (
          <ActivityIndicator style={styles.loading} />
        )}
      </Screen>
    )
  }
  return <EditProfileForm profile={me.data} />
}

function EditProfileForm({ profile }: { profile: MeProfile }) {
  const styles = useStyles()
  const t = useT()
  const names = useDisplayNames()

  const update = useUpdateProfile()
  const disclose = useDiscloseGender()
  const uploadAvatar = useUploadAvatar()
  const addPhoto = useAddPhoto()
  const removePhoto = useRemovePhoto()

  const [displayName, setDisplayName] = useState(profile.displayName ?? '')
  const [bio, setBio] = useState(profile?.bio ?? '')
  const [city, setCity] = useState(profile?.city ?? '')
  const [interests, setInterests] = useState<string[]>(profile?.interests ?? [])
  const [native, setNative] = useState<string[]>(profile?.nativeLanguages.map((l) => l.code) ?? [])
  const [learning, setLearning] = useState<{ code: string; level: LanguageLevel }[]>(
    profile?.learning.map((l) => ({ code: l.code, level: l.level })) ?? [],
  )
  const [editing, setEditing] = useState<'none' | 'native' | 'learning'>('none')
  const tier = useEffectiveTier()
  const [error, setError] = useState<string | undefined>()

  const photos = profile.photos ?? []
  const learningCodes = learning.map((l) => l.code)

  async function pick(then: (uri: string, contentType: string) => void): Promise<void> {
    const picked = await pickImageAsset({ allowsEditing: true })
    if (picked.status === 'denied') {
      // Which permission was refused, not "photos" for both: being told to
      // allow the photo library after declining the camera is advice that
      // does not work.
      void showAlert(
        picked.source === 'camera' ? t('media.cameraTitle') : t('chat.photosTitle'),
        picked.source === 'camera' ? t('media.cameraPermission') : t('chat.photosPermission'),
      )
      return
    }
    if (picked.status === 'unsupported') {
      void showAlert(t('errors.uploadFailed'), t('errors.attachmentUnsupported'))
      return
    }
    if (picked.status === 'cancelled') return
    then(picked.image.uri, picked.image.contentType)
  }

  function onUploadError(caught: unknown): void {
    // Storage may simply not be configured yet on this instance; say so rather
    // than showing a generic failure the user cannot act on.
    void showAlert(
      t('errors.uploadFailed'),
      caught instanceof ApiRequestError && caught.code === 'INTERNAL'
        ? t('editProfile.storageUnconfigured')
        : t('editProfile.uploadRetry'),
    )
  }

  /**
   * Confirmed rather than applied straight from the tap. It is the only
   * irreversible control on this screen — every other field here can be typed
   * over — and a chip is a very small thing to make a permanent choice with.
   */
  async function discloseAs(gender: (typeof DISCLOSABLE_GENDERS)[number]) {
    const ok = await confirmAlert({
      title: t('editProfile.genderConfirmTitle'),
      message: t('editProfile.genderConfirmBody', { gender: genderLabel(t, gender) }),
      confirmLabel: t('common.continue'),
    })
    if (!ok) return
    try {
      await disclose.mutateAsync(gender)
      showToast(t('editProfile.saved'))
    } catch (caught) {
      void caught
      await showAlert(t('editProfile.saveFailed'))
    }
  }

  async function save(): Promise<void> {
    setError(undefined)
    if (native.some((code) => learningCodes.includes(code))) {
      setError(t('editProfile.bothNativeAndLearning'))
      return
    }
    if (native.length === 0 || learning.length === 0) {
      setError(t('editProfile.pickOneOfEach'))
      return
    }
    try {
      await update.mutateAsync({
        displayName: displayName.trim(),
        bio: bio.trim(),
        ...(city.trim() ? { city: city.trim() } : {}),
        interests,
        nativeLanguages: native.map((code) => ({ code })),
        learning: learning.map((l, index) => ({ ...l, priority: index + 1 })),
      })
      goBackTo('/(app)/me')
      showToast(t('editProfile.saved'))
    } catch (caught) {
      // The API's message is English and written for a developer.
      void caught
      setError(t('editProfile.saveFailed'))
    }
  }

  return (
    <Screen scroll>
      <ScreenHeader title={t('editProfile.title')} onBack={() => goBackTo('/(app)/me')} />

      <View style={styles.avatarRow}>
        <Avatar url={profile.avatarUrl} name={profile.displayName} size={60} />
        {/* v3's second action is plain accent text, not a boxed button. */}
        <Pressable
          accessibilityRole="button"
          accessibilityState={{ disabled: uploadAvatar.isPending }}
          disabled={uploadAvatar.isPending}
          hitSlop={8}
          onPress={() =>
            void pick((uri, contentType) =>
              uploadAvatar.mutate(
                { uri, contentType },
                {
                  onError: onUploadError,
                  onSuccess: () => showToast(t('editProfile.photoUpdated')),
                },
              ),
            )
          }
          style={({ pressed }) => pressed && styles.pressed}
        >
          <Text style={styles.changePhoto}>
            {uploadAvatar.isPending ? t('onboarding.uploading') : t('onboarding.changePhoto')}
          </Text>
        </Pressable>
      </View>

      <FormField
        label={t('editProfile.displayName')}
        value={displayName}
        onChangeText={setDisplayName}
        maxLength={DISPLAY_NAME_MAX_LENGTH}
      />
      <FormField
        label={t('editProfile.aboutYou')}
        value={bio}
        onChangeText={setBio}
        maxLength={BIO_MAX_LENGTH}
        placeholder={t('editProfile.aboutYouPlaceholder')}
        multiline
      />
      <CountryFromLocation country={profile?.country} />

      {/*
        `city` has been in the schema and declared in the store privacy form
        from the start, and no screen ever asked for it — the declaration was
        describing a field that was always empty.
      */}
      <FormField
        label={t('editProfile.city')}
        value={city}
        onChangeText={setCity}
        placeholder={t('editProfile.cityPlaceholder')}
        autoCapitalize="words"
        maxLength={CITY_MAX_LENGTH}
      />

      {/*
        Interests were collected nowhere until the onboarding step landed, and
        anyone who predates it — or skipped it — still had no way to add them.
        The shared-interest term in the discovery score (weight 0.5) is a
        permanent zero for those accounts.
      */}
      <Text style={styles.label}>
        {t('editProfile.interests')}
        {interests.length > 0 ? ` · ${interests.length}/${MAX_INTERESTS}` : ''}
      </Text>
      <View style={styles.row}>
        {INTEREST_SUGGESTIONS.map((interest) => {
          const chosen = interests.includes(interest)
          return (
            <Chip
              key={interest}
              label={interestLabel(t, interest)}
              selected={chosen}
              onPress={() => {
                if (chosen) setInterests(interests.filter((each) => each !== interest))
                else if (interests.length < MAX_INTERESTS) setInterests([...interests, interest])
              }}
            />
          )
        })}
      </View>

      {/*
        Gender is set once — see `updateProfileSchema`, which excludes it for
        the same reason it excludes `birthDate`. So this is two screens in one:
        the question, for anybody who skipped it at onboarding, and a plain
        statement of the answer for everybody else. It is never a picker with
        the current value pre-selected, because that shape promises an edit
        the server will refuse.
      */}
      <Text style={styles.label}>{t('editProfile.gender')}</Text>
      {profile.gender === 'undisclosed' ? (
        <>
          <View style={styles.row}>
            {DISCLOSABLE_GENDERS.map((option) => (
              <Chip
                key={option}
                label={genderLabel(t, option)}
                onPress={() => void discloseAs(option)}
              />
            ))}
          </View>
          <Text style={styles.hint}>{t('editProfile.genderOnce')}</Text>
        </>
      ) : (
        <>
          <View style={styles.row}>
            <Chip label={genderLabel(t, profile.gender)} selected />
          </View>
          <Text style={styles.hint}>{t('editProfile.genderLocked')}</Text>
        </>
      )}

      <Text style={styles.label}>{t('editProfile.languages')}</Text>
      {/* v3 draws the level as bars inside a tinted pill; the words survive as
          the accessibility label. */}
      <View style={styles.row}>
        {native.map((code) => (
          <View key={code} style={styles.languageChip} accessibilityLabel={names.language(code)}>
            <Text style={styles.languageChipLabel}>{names.language(code)}</Text>
            <LevelBars level="fluent" native size={17} />
          </View>
        ))}
        {learning.map((l) => (
          <View
            key={l.code}
            style={styles.languageChip}
            accessibilityLabel={t('editProfile.languageWithLevel', {
              language: names.language(l.code),
              level: levelShortLabel(t, l.level),
            })}
          >
            <Text style={styles.languageChipLabel}>{names.language(l.code)}</Text>
            <LevelBars level={l.level} />
          </View>
        ))}
        <Pressable
          accessibilityRole="button"
          accessibilityState={{ selected: editing === 'native' }}
          onPress={() => setEditing(editing === 'native' ? 'none' : 'native')}
          style={({ pressed }) => [
            styles.editChip,
            editing === 'native' && styles.editChipActive,
            pressed && styles.pressed,
          ]}
        >
          <Text style={[styles.editChipLabel, editing === 'native' && styles.editChipLabelActive]}>
            {t('editProfile.editNative')}
          </Text>
        </Pressable>
        <Pressable
          accessibilityRole="button"
          accessibilityState={{ selected: editing === 'learning' }}
          onPress={() => setEditing(editing === 'learning' ? 'none' : 'learning')}
          style={({ pressed }) => [
            styles.editChip,
            editing === 'learning' && styles.editChipActive,
            pressed && styles.pressed,
          ]}
        >
          <Text
            style={[styles.editChipLabel, editing === 'learning' && styles.editChipLabelActive]}
          >
            {t('editProfile.editLearning')}
          </Text>
        </Pressable>
      </View>

      {editing !== 'none' ? (
        <View style={styles.pickerPane}>
          <LanguagePicker
            selected={editing === 'native' ? native : learningCodes}
            disabledCodes={editing === 'native' ? learningCodes : native}
            /* The viewer's own tier, not a fixed number: an over-limit profile
               keeps what it has (the server grandfathers it) but must not be
               offered another. */
            max={
              editing === 'native'
                ? PLAN_LIMITS[tier].maxNativeLanguages
                : PLAN_LIMITS[tier].maxLearningLanguages
            }
            onToggle={(code) => {
              if (editing === 'native') {
                setNative((current) =>
                  current.includes(code) ? current.filter((c) => c !== code) : [...current, code],
                )
              } else {
                setLearning((current) =>
                  current.some((l) => l.code === code)
                    ? current.filter((l) => l.code !== code)
                    : [...current, { code, level: 'absoluteBeginner' as const }],
                )
              }
            }}
          />
          {editing === 'learning' && learning.length > 0 ? (
            <ScrollView style={styles.levels} keyboardShouldPersistTaps="handled">
              {learning.map((entry) => (
                <View key={entry.code} style={styles.levelRow}>
                  <Text style={styles.levelLang}>
                    {getLanguage(entry.code)?.name ?? entry.code}
                  </Text>
                  <View style={styles.row}>
                    {LANGUAGE_LEVELS.map((level) => (
                      <Chip
                        key={level}
                        label={LEVEL_SHORT_LABELS[level]}
                        selected={entry.level === level}
                        onPress={() =>
                          setLearning((current) =>
                            current.map((l) => (l.code === entry.code ? { ...l, level } : l)),
                          )
                        }
                      />
                    ))}
                  </View>
                </View>
              ))}
            </ScrollView>
          ) : null}
        </View>
      ) : null}

      <Text style={styles.label}>
        {t('editProfile.photos')} · {photos.length}/{PLAN_LIMITS.free.maxPhotos}
      </Text>
      <View style={styles.gallery}>
        {photos.map((photo) => (
          <Pressable
            key={photo.url}
            onLongPress={() =>
              void confirmAlert({
                title: t('editProfile.removePhotoTitle'),
                message: t('editProfile.removePhotoBody'),
                confirmLabel: t('common.remove'),
                destructive: true,
              }).then((yes) => {
                if (yes) removePhoto.mutate(photo.url)
              })
            }
          >
            <Image source={{ uri: photo.url }} style={styles.photo} />
          </Pressable>
        ))}
        {photos.length < PLAN_LIMITS.free.maxPhotos ? (
          <Pressable
            style={[styles.photo, styles.photoAdd]}
            disabled={addPhoto.isPending}
            onPress={() =>
              void pick((uri, contentType) =>
                addPhoto.mutate(
                  { uri, contentType },
                  {
                    onError: onUploadError,
                    onSuccess: () => showToast(t('editProfile.photoAdded')),
                  },
                ),
              )
            }
          >
            <Text style={styles.photoAddLabel}>{addPhoto.isPending ? '…' : '+'}</Text>
          </Pressable>
        ) : null}
      </View>
      <Text style={styles.hint}>{t('editProfile.longPressToRemove')}</Text>

      {error ? <Text style={styles.error}>{error}</Text> : null}
      <Button
        label={t('common.save')}
        loading={update.isPending}
        onPress={save}
        style={styles.save}
      />
    </Screen>
  )
}

const useStyles = makeStyles(({ colors, font, spacing, radius }) => ({
  loading: { marginTop: spacing.xxl },
  avatarRow: {
    alignItems: 'center',
    flexDirection: 'row',
    gap: spacing.lg,
    marginBottom: spacing.md,
    marginTop: spacing.xs,
  },
  changePhoto: { color: colors.accent, fontSize: 15, fontWeight: '700' },
  pressed: { opacity: 0.6 },
  label: {
    color: colors.textMuted,
    fontSize: 14,
    fontWeight: '600',
    marginBottom: spacing.sm + 1,
    marginTop: spacing.lg,
  },
  row: { flexDirection: 'row', flexWrap: 'wrap', gap: 7 },
  /** The tinted language pill: soft accent ground, accent label, bars inside. */
  languageChip: {
    alignItems: 'center',
    backgroundColor: colors.accentBg,
    borderRadius: radius.pill,
    flexDirection: 'row',
    gap: 6,
    paddingHorizontal: 14,
    paddingVertical: 8,
  },
  languageChipLabel: { color: colors.accent, fontSize: 13, fontWeight: '600' },
  editChip: {
    borderColor: colors.border,
    borderRadius: radius.pill,
    borderStyle: 'dashed',
    borderWidth: 1,
    paddingHorizontal: 14,
    paddingVertical: 8,
  },
  editChipActive: { borderColor: colors.accent },
  editChipLabel: { color: colors.textMuted, fontSize: 13, fontWeight: '600' },
  editChipLabelActive: { color: colors.accent },
  pickerPane: { height: 320, marginTop: spacing.md },
  levels: {
    borderTopColor: colors.border,
    borderTopWidth: 1,
    maxHeight: 140,
    paddingTop: spacing.sm,
  },
  levelRow: { marginBottom: spacing.sm },
  levelLang: { ...font.caption, color: colors.textMuted, marginBottom: spacing.xs },
  gallery: { flexDirection: 'row', flexWrap: 'wrap', gap: spacing.sm + 1 },
  photo: { backgroundColor: colors.fill, borderRadius: 14, height: 58, width: 58 },
  photoAdd: {
    alignItems: 'center',
    backgroundColor: 'transparent',
    borderColor: colors.border,
    borderStyle: 'dashed',
    borderWidth: 1,
    justifyContent: 'center',
  },
  photoAddLabel: { color: colors.textFaint, fontSize: 22 },
  hint: { color: colors.textFaint, fontSize: 12, marginTop: spacing.sm },
  error: { ...font.caption, color: colors.danger, marginTop: spacing.md },
  save: { marginBottom: spacing.xxl, marginTop: spacing.lg },
}))

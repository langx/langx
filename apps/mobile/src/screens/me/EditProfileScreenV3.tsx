import {
  BIO_MAX_LENGTH,
  GENDER_CHANGE_COOLDOWN_DAYS,
  GENDER_CHANGE_COOLDOWN_MS,
  GENDERS,
  DISPLAY_NAME_MAX_LENGTH,
  HANDLE_CHANGE_COOLDOWN_DAYS,
  handleChangeFreeAt,
  INTEREST_SUGGESTIONS,
  MAX_INTERESTS,
  PLAN_LIMITS,
  PRONOUNS_MAX_LENGTH,
  type Gender,
} from '@langx/shared'
import Feather from '@expo/vector-icons/Feather'
import { router } from 'expo-router'
import { useState } from 'react'
import { Pressable, Text, View } from 'react-native'
import { ScrollView } from 'react-native-gesture-handler'
import {
  useEffectiveTier,
  useMe,
  useRemovePhoto,
  useReorderPhotos,
  useSetGender,
  useUpdateProfile,
  type MeProfile,
} from '../../api/queries'
import { ApiRequestError } from '../../api/client'
import { CountryFromLocation } from '../../components/CountryFromLocation'
import { DraggablePhotos } from '../../components/DraggablePhotos'
import { LoadFailed } from '../../components/LoadFailed'
import { PendingPhotoTile } from '../../components/PendingPhotoTile'
import { SettingsHeaderV3 } from '../../components/settings/v3/SettingsKitV3'
import { Avatar } from '../../components/ui/Avatar'
import { Button } from '../../components/ui/Button'
import { Chip } from '../../components/ui/Chip'
import { FormField } from '../../components/ui/FormField'
import { LevelBars } from '../../components/ui/LevelBars'
import { Screen } from '../../components/ui/Screen'
import { Skeleton } from '../../components/ui/Skeleton'
import { useChangeAvatar } from '../../hooks/useChangeAvatar'
import { useProfilePhotoUploads } from '../../hooks/useProfilePhotoUploads'
import { useScreenInteractive } from '../../hooks/useScreenInteractive'
import {
  genderLabel,
  genderShortLabel,
  interestLabel,
  levelLabel,
  levelShortLabel,
  useDisplayNames,
  useLocale,
  useT,
} from '../../i18n'
import { confirmAlert, showAlert } from '../../lib/alert'
import { moveItem } from '../../lib/gridReorder'
import { queryFailed } from '../../lib/listState'
import { goBackTo, openLanguages } from '../../lib/navigation'
import { pickMediaAssets } from '../../lib/pickMediaAsset'
import { makeStyles, useTheme } from '../../lib/theme'
import { partnerHueFor } from '../../lib/theme/partnerHue'
import { showToast } from '../../lib/toast'

/** One number for the stored tiles and the pending ones, so they cannot drift. */
const PHOTO_TILE = 58

const ME = '/(app)/(tabs)/me'

/**
 * Edit profile in the redesign's look (`V-EditProfile`), behind
 * `flags.v3Home`.
 *
 * Every handler here is `edit-profile.tsx`'s, copied rather than shared so
 * the current screen's diff stays a switch: the Save button writes the typed
 * fields and nothing else; photos, the username, the languages, the country
 * and the gender keep saving on their own, exactly as today. The languages
 * screen's own autosave is untouched — this page only reads the profile it
 * leaves behind.
 *
 * What v3 changes is the drawing: the photos sit on your colour with an ink
 * "Change photo", every way into another screen is a 44pt outline pill, and
 * Save is the screen's one yellow.
 */
export function EditProfileScreenV3() {
  useScreenInteractive()
  const styles = useStyles()
  const { v3 } = useTheme()
  const t = useT()

  const me = useMe()

  // `!me.data` rather than `isPending`, for today's reason: `useMe` does not
  // retry, and the form must initialise from the real values.
  if (!me.data) {
    return (
      <Screen ground={v3.colors.bg}>
        <SettingsHeaderV3 title={t('editProfile.title')} onBack={() => goBackTo(ME)} />
        {queryFailed(me) ? (
          <LoadFailed onRetry={() => void me.refetch()} />
        ) : (
          <View style={styles.loading}>
            <Skeleton height={196} radius={v3.radius.block} />
            <Skeleton height={56} radius={v3.radius.row} />
            <Skeleton height={56} radius={v3.radius.row} />
            <Skeleton height={112} radius={v3.radius.row} />
          </View>
        )}
      </Screen>
    )
  }
  return <EditProfileFormV3 profile={me.data} />
}

function EditProfileFormV3({ profile }: { profile: MeProfile }) {
  const { v3 } = useTheme()
  const styles = useStyles()
  const t = useT()
  const { locale } = useLocale()
  const names = useDisplayNames()

  const update = useUpdateProfile()
  const setGender = useSetGender()
  const avatar = useChangeAvatar()
  const removePhoto = useRemovePhoto()
  const reorderPhotos = useReorderPhotos()
  const uploads = useProfilePhotoUploads(onUploadError)

  const [displayName, setDisplayName] = useState(profile.displayName ?? '')
  const [bio, setBio] = useState(profile?.bio ?? '')
  const [pronouns, setPronouns] = useState(profile?.pronouns ?? '')
  const [interests, setInterests] = useState<string[]>(profile?.interests ?? [])
  const tier = useEffectiveTier()
  const [error, setError] = useState<string | undefined>()

  const photos = profile.photos ?? []
  const hue = v3.hues[partnerHueFor(profile._id)]

  // As today: room is counted against the pending tiles too, and against this
  // account's own ceiling.
  async function addPhotos(): Promise<void> {
    const room = PLAN_LIMITS[tier].maxPhotos - photos.length - uploads.pending.length
    if (room <= 0) return
    const picked = await pickMediaAssets({ kinds: 'images', remaining: room })
    if (picked.status === 'denied') {
      void showAlert(
        picked.source === 'camera' ? t('media.cameraTitle') : t('chat.photosTitle'),
        picked.source === 'camera' ? t('media.cameraPermission') : t('chat.photosPermission'),
      )
      return
    }
    if (picked.status === 'cancelled') return
    if (picked.refused) {
      void showAlert(
        t('errors.uploadFailed'),
        picked.refused.reason === 'tooLarge'
          ? t('errors.attachmentTooLarge')
          : picked.refused.reason === 'tooMany'
            ? t('editProfile.photosTrimmed', { max: PLAN_LIMITS[tier].maxPhotos })
            : t('errors.attachmentUnsupported'),
      )
    }
    uploads.add(picked.media)
  }

  function onUploadError(caught: unknown): void {
    void showAlert(
      t('errors.uploadFailed'),
      caught instanceof ApiRequestError && caught.code === 'INTERNAL'
        ? t('editProfile.storageUnconfigured')
        : t('editProfile.uploadRetry'),
    )
  }

  const genderFreeAt = profile.genderChangedAt
    ? new Date(new Date(profile.genderChangedAt).getTime() + GENDER_CHANGE_COOLDOWN_MS)
    : undefined
  const genderLocked = genderFreeAt !== undefined && genderFreeAt.getTime() > Date.now()
  const handleFreeAt = handleChangeFreeAt(profile)

  // Confirmed, as today: the one control here that spends something.
  async function changeGenderTo(gender: Gender) {
    if (gender === profile.gender) return
    const ok = await confirmAlert({
      title: t('editProfile.genderConfirmTitle'),
      message: t('editProfile.genderConfirmBody', {
        gender: genderLabel(t, gender),
        days: GENDER_CHANGE_COOLDOWN_DAYS,
      }),
      confirmLabel: t('common.continue'),
    })
    if (!ok) return
    try {
      await setGender.mutateAsync(gender)
      showToast(t('editProfile.saved'))
    } catch (caught) {
      void caught
      await showAlert(t('editProfile.saveFailed'))
    }
  }

  // The typed fields only, as today; the languages save on their own screen.
  async function save(): Promise<void> {
    setError(undefined)
    try {
      await update.mutateAsync({
        displayName: displayName.trim(),
        bio: bio.trim(),
        pronouns: pronouns.trim(),
        interests,
      })
      goBackTo(ME)
      showToast(t('editProfile.saved'))
    } catch (caught) {
      void caught
      setError(t('editProfile.saveFailed'))
    }
  }

  return (
    <Screen fluid ground={v3.colors.bg}>
      <SettingsHeaderV3 title={t('editProfile.title')} onBack={() => goBackTo(ME)} />

      <ScrollView
        style={styles.body}
        contentContainerStyle={styles.content}
        keyboardShouldPersistTaps="handled"
        automaticallyAdjustKeyboardInsets
      >
        <View style={[styles.photos, { backgroundColor: hue }]}>
          <View style={styles.avatarRow}>
            <Avatar
              url={profile.avatarUrl}
              name={profile.displayName}
              seed={profile._id}
              size={84}
            />
            <View style={styles.avatarText}>
              <Button
                label={avatar.isPending ? t('onboarding.uploading') : t('onboarding.changePhoto')}
                icon="camera"
                variant="hue"
                size="small"
                disabled={avatar.isPending}
                style={styles.auto}
                onPress={() => void avatar.change()}
              />
              <Text style={styles.onHue}>{t('editProfile.holdPhotoHint')}</Text>
            </View>
          </View>

          <View style={styles.gallery}>
            <DraggablePhotos
              photos={photos}
              size={PHOTO_TILE}
              onMove={(from, to) =>
                reorderPhotos.mutate(
                  moveItem(photos, from, to).map((photo) => photo.url),
                  { onError: () => showToast(t('editProfile.photoOrderFailed')) },
                )
              }
              onRemove={(index) => {
                const photo = photos[index]
                if (!photo) return
                void confirmAlert({
                  title: t('editProfile.removePhotoTitle'),
                  message: t('editProfile.removePhotoBody'),
                  confirmLabel: t('common.remove'),
                  destructive: true,
                }).then((yes) => {
                  if (yes) removePhoto.mutate(photo.url)
                })
              }}
            />
            {uploads.pending.map((photo) => (
              <PendingPhotoTile
                key={photo.id}
                photo={photo}
                size={PHOTO_TILE}
                onRetry={() => uploads.retry(photo.id)}
                onDiscard={() => uploads.discard(photo.id)}
              />
            ))}
            {photos.length + uploads.pending.length < PLAN_LIMITS[tier].maxPhotos ? (
              <Pressable
                accessibilityRole="button"
                accessibilityLabel={t('onboarding.addPhoto')}
                style={({ pressed }) => [styles.photoAdd, pressed && styles.pressed]}
                onPress={() => void addPhotos()}
              >
                <Feather name="plus" size={v3.icon.lg} color={v3.colors.ink} />
              </Pressable>
            ) : null}
          </View>
          {/* Said always, as today: a "+" that vanishes without a word reads as a bug. */}
          <Text style={styles.onHueStrong}>
            {t('editProfile.photoLimit', { max: PLAN_LIMITS[tier].maxPhotos })}
          </Text>
        </View>

        <View style={styles.block}>
          <Text style={styles.label}>{t('settings.username')}</Text>
          <View style={[styles.readOnly, handleFreeAt && styles.locked]}>
            <Text style={styles.readOnlyValue}>@{profile.handle}</Text>
            {handleFreeAt ? (
              <Feather name="lock" size={16} color={v3.colors.muted} />
            ) : (
              <Button
                label={t('common.edit')}
                icon="edit-2"
                variant="secondary"
                size="small"
                style={styles.auto}
                onPress={() =>
                  router.push({
                    pathname: '/(app)/settings/username',
                    params: { from: '/(app)/edit-profile' },
                  })
                }
              />
            )}
          </View>
          <Text style={styles.note}>
            {handleFreeAt
              ? t('editProfile.usernameCooldown', { date: handleFreeAt.toLocaleDateString(locale) })
              : t('editProfile.usernameEvery', { days: HANDLE_CHANGE_COOLDOWN_DAYS })}
          </Text>
        </View>

        <FormField
          label={t('editProfile.displayName')}
          value={displayName}
          onChangeText={setDisplayName}
          maxLength={DISPLAY_NAME_MAX_LENGTH}
        />
        <View style={styles.block}>
          <FormField
            label={t('editProfile.pronouns')}
            value={pronouns}
            onChangeText={setPronouns}
            placeholder={t('editProfile.pronounsPlaceholder')}
            maxLength={PRONOUNS_MAX_LENGTH}
            autoCapitalize="none"
          />
          <Text style={styles.note}>{t('editProfile.pronounsHint')}</Text>
        </View>
        <FormField
          label={t('editProfile.aboutYou')}
          value={bio}
          onChangeText={setBio}
          maxLength={BIO_MAX_LENGTH}
          placeholder={t('editProfile.aboutYouPlaceholder')}
          multiline
          numberOfLines={3}
        />

        {/* A way in, not the editor: languages save a tap at a time on their own screen. */}
        <View style={styles.block}>
          <View style={styles.blockHead}>
            <Text style={styles.label} accessibilityRole="header">
              {t('editProfile.languages')}
            </Text>
            <Button
              label={t('common.edit')}
              icon="edit-2"
              variant="secondary"
              size="small"
              style={styles.auto}
              onPress={() => openLanguages('/(app)/edit-profile')}
            />
          </View>
          <View style={styles.group}>
            {profile.nativeLanguages.map((entry, index) => (
              <View key={entry.code} style={[styles.languageRow, index > 0 && styles.divided]}>
                <Text style={styles.languageName}>{names.language(entry.code)}</Text>
                <Text style={styles.languageLevel}>{t('onboarding.native')}</Text>
              </View>
            ))}
            {[...profile.learning]
              .sort((a, b) => a.priority - b.priority)
              .map((entry, index) => (
                <View
                  key={entry.code}
                  style={[
                    styles.languageRow,
                    (index > 0 || profile.nativeLanguages.length > 0) && styles.divided,
                  ]}
                  accessibilityLabel={t('editProfile.languageWithLevel', {
                    language: names.language(entry.code),
                    level: levelShortLabel(t, entry.level),
                  })}
                >
                  <Text style={styles.languageName}>{names.language(entry.code)}</Text>
                  <Text style={styles.languageLevel}>{levelLabel(t, entry.level)}</Text>
                  <LevelBars level={entry.level} size={14} />
                </View>
              ))}
          </View>
        </View>

        <View style={styles.block}>
          <Text style={styles.label} accessibilityRole="header">
            {t('editProfile.interestsUpTo', { max: MAX_INTERESTS })}
          </Text>
          <View style={styles.chips}>
            {INTEREST_SUGGESTIONS.map((interest) => {
              const chosen = interests.includes(interest)
              return (
                <Chip
                  key={interest}
                  label={interestLabel(t, interest)}
                  selected={chosen}
                  onPress={() => {
                    if (chosen) setInterests(interests.filter((each) => each !== interest))
                    else if (interests.length < MAX_INTERESTS)
                      setInterests([...interests, interest])
                  }}
                />
              )
            })}
          </View>
        </View>

        <CountryFromLocation country={profile?.country} />

        <View style={styles.block}>
          <Text style={styles.label} accessibilityRole="header">
            {t('editProfile.gender')}
          </Text>
          {genderLocked ? (
            <>
              <View style={[styles.readOnly, styles.locked]}>
                <Text style={styles.readOnlyValue}>{genderLabel(t, profile.gender)}</Text>
                <Feather name="lock" size={16} color={v3.colors.muted} />
              </View>
              <Text style={styles.note}>
                {t('editProfile.genderCooldown', {
                  date: genderFreeAt.toLocaleDateString(locale),
                })}
              </Text>
            </>
          ) : (
            <>
              <View style={styles.chips}>
                {GENDERS.map((option) => (
                  <Chip
                    key={option}
                    label={genderShortLabel(t, option)}
                    selected={option === profile.gender}
                    onPress={() => void changeGenderTo(option)}
                  />
                ))}
              </View>
              <Text style={styles.note}>
                {t('editProfile.genderOnce', { days: GENDER_CHANGE_COOLDOWN_DAYS })}
              </Text>
            </>
          )}
        </View>
      </ScrollView>

      <View style={styles.footer}>
        {error ? <Text style={styles.error}>{error}</Text> : null}
        <Button label={t('common.save')} icon="check" loading={update.isPending} onPress={save} />
      </View>
    </Screen>
  )
}

const useStyles = makeStyles(({ v3 }) => ({
  loading: { gap: v3.space[16], paddingTop: v3.space[8] },
  body: { flex: 1 },
  content: { gap: 22, paddingBottom: v3.space[20], paddingTop: v3.space[8] },
  photos: {
    borderRadius: v3.radius.block,
    gap: v3.space[14],
    paddingBottom: v3.space[14],
    paddingHorizontal: v3.space[14],
    paddingTop: v3.space[16],
  },
  avatarRow: { alignItems: 'center', flexDirection: 'row', gap: v3.space[14] },
  avatarText: { alignItems: 'flex-start', flex: 1, gap: v3.space[8], minWidth: 0 },
  auto: { width: 'auto' },
  onHue: { ...v3.type.caption, color: v3.colors.ink, fontWeight: '600', lineHeight: 18 },
  onHueStrong: { ...v3.type.caption, color: v3.colors.ink, fontWeight: '700', lineHeight: 18 },
  gallery: { flexDirection: 'row', flexWrap: 'wrap', gap: v3.space[8] },
  photoAdd: {
    alignItems: 'center',
    borderColor: v3.colors.ink,
    borderRadius: 16,
    borderStyle: 'dashed',
    borderWidth: 2,
    height: PHOTO_TILE,
    justifyContent: 'center',
    width: PHOTO_TILE,
  },
  pressed: { opacity: 0.7 },
  block: { gap: v3.space[6] },
  blockHead: { alignItems: 'center', flexDirection: 'row', justifyContent: 'space-between' },
  label: { ...v3.type.buttonSmall, color: v3.colors.fg },
  readOnly: {
    alignItems: 'center',
    backgroundColor: v3.colors.surface,
    borderRadius: v3.radius.row,
    flexDirection: 'row',
    gap: v3.space[10],
    minHeight: 56,
    paddingEnd: v3.space[6],
    paddingStart: v3.space[16],
    paddingVertical: v3.space[6],
  },
  // Today's dimmed field while a cooldown runs, with the lock where the action was.
  locked: { opacity: 0.6, paddingEnd: v3.space[16] },
  readOnlyValue: { ...v3.type.body, color: v3.colors.fg, flex: 1, fontWeight: '600' },
  note: { ...v3.type.caption, color: v3.colors.muted, lineHeight: 18 },
  group: { backgroundColor: v3.colors.surface, borderRadius: v3.radius.tile, overflow: 'hidden' },
  divided: { borderTopColor: v3.colors.line, borderTopWidth: 1 },
  languageRow: {
    alignItems: 'center',
    flexDirection: 'row',
    gap: v3.space[10],
    minHeight: 56,
    paddingHorizontal: v3.space[16],
    paddingVertical: v3.space[8],
  },
  languageName: { ...v3.type.button, color: v3.colors.fg, flex: 1 },
  languageLevel: { ...v3.type.callout, color: v3.colors.muted },
  chips: { flexDirection: 'row', flexWrap: 'wrap', gap: v3.space[8] },
  error: { ...v3.type.caption, color: v3.colors.danger, paddingBottom: v3.space[8] },
  // Above the home indicator, as today's footer is.
  footer: {
    borderTopColor: v3.colors.line,
    borderTopWidth: 1,
    paddingBottom: 28,
    paddingTop: v3.space[10],
  },
}))

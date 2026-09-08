import {
  BIO_MAX_LENGTH,
  LANGUAGE_LEVELS,
  DISPLAY_NAME_MAX_LENGTH,
  INTEREST_SUGGESTIONS,
  MAX_INTERESTS,
  PLAN_LIMITS,
  getLanguage,
  type LanguageLevel,
} from '@langx/shared'
import Feather from '@expo/vector-icons/Feather'
import { useEffect, useRef, useState } from 'react'
import { Image, Pressable, ScrollView, Text, View } from 'react-native'
import {
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
import { useDebounced } from '../../src/hooks/useDebounced'
import { useProfilePhotoUploads } from '../../src/hooks/useProfilePhotoUploads'
import { Avatar } from '../../src/components/ui/Avatar'
import { Button } from '../../src/components/ui/Button'
import { Chip } from '../../src/components/ui/Chip'
import { FormField } from '../../src/components/ui/FormField'
import { LevelBars } from '../../src/components/ui/LevelBars'
import { CountryFromLocation } from '../../src/components/CountryFromLocation'
import { Screen } from '../../src/components/ui/Screen'
import { Skeleton } from '../../src/components/ui/Skeleton'
import { ScreenHeader } from '../../src/components/ui/ScreenHeader'
import { goBackTo } from '../../src/lib/navigation'
import { chooseAlert, confirmAlert, showAlert } from '../../src/lib/alert'
import { PendingPhotoTile } from '../../src/components/PendingPhotoTile'
import { pickImageAsset, pickMediaAssets } from '../../src/lib/pickMediaAsset'
import { showToast } from '../../src/lib/toast'
import { makeStyles, useTheme } from '../../src/lib/theme'
import {
  genderLabel,
  interestLabel,
  levelLabel,
  levelShortLabel,
  useDisplayNames,
  useT,
} from '../../src/i18n'
import { useScreenInteractive } from '../../src/hooks/useScreenInteractive'

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

/** One number for the stored tiles and the pending ones, so they cannot drift. */
const PHOTO_TILE = 58

export default function EditProfileScreen() {
  useScreenInteractive()
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
          <View style={styles.loading}>
            <Skeleton width={88} height={88} radius={44} />
            <Skeleton width="42%" height={14} />
            <Skeleton height={52} />
            <Skeleton width="34%" height={14} />
            <Skeleton height={52} />
            <Skeleton width="38%" height={14} />
            <Skeleton height={96} />
          </View>
        )}
      </Screen>
    )
  }
  return <EditProfileForm profile={me.data} />
}

function EditProfileForm({ profile }: { profile: MeProfile }) {
  const { colors } = useTheme()
  const styles = useStyles()
  const t = useT()
  const names = useDisplayNames()

  const update = useUpdateProfile()
  const disclose = useDiscloseGender()
  const uploadAvatar = useUploadAvatar()
  const removePhoto = useRemovePhoto()
  const uploads = useProfilePhotoUploads(onUploadError)

  const [displayName, setDisplayName] = useState(profile.displayName ?? '')
  const [bio, setBio] = useState(profile?.bio ?? '')
  const [interests, setInterests] = useState<string[]>(profile?.interests ?? [])
  const [native, setNative] = useState<string[]>(profile?.nativeLanguages.map((l) => l.code) ?? [])
  const [learning, setLearning] = useState<{ code: string; level: LanguageLevel }[]>(
    profile?.learning.map((l) => ({ code: l.code, level: l.level })) ?? [],
  )
  const [editing, setEditing] = useState<'none' | 'native' | 'learning'>('none')
  const tier = useEffectiveTier()
  const [error, setError] = useState<string | undefined>()
  const [languageStatus, setLanguageStatus] = useState<'idle' | 'saving' | 'saved'>('idle')

  const photos = profile.photos ?? []
  const learningCodes = learning.map((l) => l.code)

  /*
   * Languages save themselves; the Save button is for the fields you type.
   *
   * Picking a language and picking a level are complete decisions on their own
   * — there is nothing half-entered about either — so making them wait behind
   * a button meant the most common edit on this screen was also the easiest to
   * lose by leaving. The typed fields keep the button because a half-written
   * bio is exactly what an autosave should not publish.
   *
   * Debounced and driven off a signature rather than called from each handler,
   * so that stepping A1 → A2 → B1 is one request rather than three racing ones
   * whose replies would each overwrite `keys.me` in whatever order they landed.
   */
  const languageSignature = `${native.join(',')}|${learning
    .map((l) => `${l.code}:${l.level}`)
    .join(',')}`
  const settledLanguages = useDebounced(languageSignature, 600)
  const savedLanguages = useRef(languageSignature)

  useEffect(() => {
    // Still settling: another tap landed after this one was scheduled.
    if (settledLanguages !== languageSignature) return
    if (settledLanguages === savedLanguages.current) return

    // The same two rules `save()` applies. An intermediate state on the way to
    // a valid one — the moment after removing your only native language — is
    // not an error worth shouting about, so it just does not save.
    if (native.some((code) => learningCodes.includes(code))) {
      setError(t('editProfile.bothNativeAndLearning'))
      return
    }
    if (native.length === 0 || learning.length === 0) return

    setError(undefined)
    savedLanguages.current = settledLanguages
    setLanguageStatus('saving')
    update
      .mutateAsync({
        nativeLanguages: native.map((code) => ({ code })),
        learning: learning.map((l, index) => ({ ...l, priority: index + 1 })),
      })
      .then(() => setLanguageStatus('saved'))
      .catch((caught: unknown) => {
        // Forget what was saved so the next edit retries this one with it.
        void caught
        savedLanguages.current = ''
        setLanguageStatus('idle')
        setError(t('editProfile.saveFailed'))
      })
    // `update` and `t` are deliberately absent: both change identity on a
    // render this effect can itself cause, and depending on them would make a
    // save schedule the next one.
  }, [settledLanguages, languageSignature, native, learning, learningCodes])

  /**
   * The gallery takes several at once; the avatar still takes one, cropped.
   *
   * Room is counted against the pending tiles as well as the stored photos —
   * two pickers in a row must not between them exceed what the server will
   * accept, or the last upload comes back refused after its bytes are already
   * up. The ceiling is this account's, not the free one: the gallery is a
   * plan ladder, and reading the wrong row either refuses a subscriber or
   * lets a free account upload something the server will not take.
   */
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
    // Said once, for the first file that was dropped, the way the chat picker
    // says it: naming every file would be a stack of alerts nobody dismisses.
    // Every reason is answered — a photo that vanishes with no word is the
    // complaint this screen is being rewritten for.
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
   * One "Edit" for both lists. The two pickers are different controls with
   * different limits, so the sheet asks which one first; "Done" closes
   * whichever is open. Nothing to confirm on the way out — the languages have
   * been saving themselves all along.
   */
  async function editLanguages(): Promise<void> {
    if (editing !== 'none') {
      setEditing('none')
      return
    }
    const which = await chooseAlert(t('editProfile.languages'), undefined, [
      { label: t('editProfile.editNative'), value: 'native' as const },
      { label: t('editProfile.editLearning'), value: 'learning' as const },
    ])
    if (which) setEditing(which)
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
        interests,
        nativeLanguages: native.map((code) => ({ code })),
        learning: learning.map((l, index) => ({ ...l, priority: index + 1 })),
      })
      goBackTo('/(app)/(tabs)/me')
      showToast(t('editProfile.saved'))
    } catch (caught) {
      // The API's message is English and written for a developer.
      void caught
      setError(t('editProfile.saveFailed'))
    }
  }

  return (
    // `fluid` rather than `scroll`: Save sits in a footer under the scrolling
    // form, so this screen owns its own ScrollView.
    <Screen fluid>
      <ScreenHeader title={t('editProfile.title')} onBack={() => goBackTo('/(app)/(tabs)/me')} />

      <ScrollView
        style={styles.body}
        contentContainerStyle={styles.content}
        keyboardShouldPersistTaps="handled"
        // iOS-only by design, exactly as `Screen scroll` does it: Android
        // already resizes the window for the keyboard.
        automaticallyAdjustKeyboardInsets
      >
        <View style={styles.avatarRow}>
          <Avatar url={profile.avatarUrl} name={profile.displayName} seed={profile._id} size={80} />
          <View style={styles.avatarText}>
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
              style={({ pressed }) => [styles.changePhoto, pressed && styles.pressed]}
            >
              <Text style={styles.changePhotoLabel}>
                {uploadAvatar.isPending ? t('onboarding.uploading') : t('onboarding.changePhoto')}
              </Text>
            </Pressable>
            <Text style={styles.hint}>{t('editProfile.longPressToRemove')}</Text>
          </View>
        </View>

        {/* The photos the hint above is about, directly under it. */}
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
          {uploads.pending.map((photo) => (
            <PendingPhotoTile
              key={photo.id}
              photo={photo}
              size={PHOTO_TILE}
              onRetry={() => uploads.retry(photo.id)}
              onDiscard={() => uploads.discard(photo.id)}
            />
          ))}
          {/*
            No longer disabled while an upload runs — the queue takes more, and
            a "+" that goes dead for the length of an upload was the reason a
            second photo could not be picked at all. The only thing that hides
            it is having no room left.
          */}
          {photos.length + uploads.pending.length < PLAN_LIMITS[tier].maxPhotos ? (
            <Pressable
              accessibilityRole="button"
              accessibilityLabel={t('onboarding.addPhoto')}
              style={[styles.photo, styles.photoAdd]}
              onPress={() => void addPhotos()}
            >
              <Text style={styles.photoAddLabel}>+</Text>
            </Pressable>
          ) : null}
        </View>
        {/*
          Said always, not only once the gallery is full: the "+" simply stops
          being drawn at the limit, and a control that vanishes without a word
          reads as a bug rather than a limit.
        */}
        <Text style={styles.hint}>
          {t('editProfile.photoLimit', { max: PLAN_LIMITS[tier].maxPhotos })}
        </Text>

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
          numberOfLines={3}
        />

        {/* v3 lists the languages as rows — the level as words and bars — with
            one "Edit" over them; the pickers open underneath on demand. */}
        <View style={styles.block}>
          <View style={styles.blockHead}>
            <Text style={styles.label}>{t('editProfile.languages')}</Text>
            <Pressable
              accessibilityRole="button"
              accessibilityState={{ expanded: editing !== 'none' }}
              hitSlop={8}
              onPress={() => void editLanguages()}
              style={({ pressed }) => pressed && styles.pressed}
            >
              <Text style={styles.link}>
                {t(editing === 'none' ? 'common.edit' : 'common.done')}
              </Text>
            </Pressable>
          </View>
          <View style={styles.languageRows}>
            {native.map((code) => (
              <View key={code} style={styles.languageRow}>
                <Text style={styles.languageName}>{names.language(code)}</Text>
                <Text style={styles.languageLevel}>{t('onboarding.native')}</Text>
              </View>
            ))}
            {learning.map((l) => (
              <View
                key={l.code}
                style={styles.languageRow}
                accessibilityLabel={t('editProfile.languageWithLevel', {
                  language: names.language(l.code),
                  level: levelShortLabel(t, l.level),
                })}
              >
                <Text style={styles.languageName}>{names.language(l.code)}</Text>
                <View style={styles.languageLevelRow}>
                  <Text style={styles.languageLevel}>{levelLabel(t, l.level)}</Text>
                  <LevelBars level={l.level} size={12} />
                </View>
              </View>
            ))}
          </View>

          {languageStatus === 'idle' ? null : (
            <Text style={styles.languageStatus}>
              {t(languageStatus === 'saving' ? 'editProfile.savingLanguages' : 'editProfile.saved')}
            </Text>
          )}

          {editing !== 'none' ? (
            <View style={styles.pickerPane}>
              <LanguagePicker
                /*
                 * Remounts when the mode changes, which drops the search query.
                 * Without it React reuses the instance — same element type, same
                 * position — and a query typed while picking a native language was
                 * still filtering the list when the learning picker opened, with
                 * nothing on screen to say why most languages were missing.
                 * `(onboarding)/languages.tsx` keys its two pickers for this.
                 */
                key={editing}
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
                      current.includes(code)
                        ? current.filter((c) => c !== code)
                        : [...current, code],
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
                            label={levelShortLabel(t, level)}
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
        </View>

        {/*
          Interests were collected nowhere until the onboarding step landed, and
          anyone who predates it — or skipped it — still had no way to add them.
          The shared-interest term in the discovery score (weight 0.5) is a
          permanent zero for those accounts.
        */}
        <View style={styles.block}>
          <Text style={styles.label}>{t('editProfile.interestsUpTo', { max: MAX_INTERESTS })}</Text>
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
                    else if (interests.length < MAX_INTERESTS)
                      setInterests([...interests, interest])
                  }}
                />
              )
            })}
          </View>
        </View>

        <CountryFromLocation country={profile?.country} />

        {/*
          Gender is set once — see `updateProfileSchema`, which excludes it for
          the same reason it excludes `birthDate`. So this is two screens in one:
          the question, for anybody who skipped it at onboarding, and a plain
          statement of the answer for everybody else. It is never a picker with
          the current value pre-selected, because that shape promises an edit
          the server will refuse.
        */}
        <View style={styles.gender}>
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
              <Text style={styles.note}>{t('editProfile.genderOnce')}</Text>
            </>
          ) : (
            <>
              {/* Drawn like a field, dimmed and locked, so it reads as the
                  answer to a question that is no longer being asked. */}
              <View style={styles.lockedField}>
                <Text style={styles.lockedValue}>{genderLabel(t, profile.gender)}</Text>
                <Feather name="lock" size={16} color={colors.textFaint} />
              </View>
              <Text style={styles.note}>{t('editProfile.genderLocked')}</Text>
            </>
          )}
        </View>

        {error ? <Text style={styles.error}>{error}</Text> : null}
      </ScrollView>

      <View style={styles.footer}>
        <Button label={t('common.save')} loading={update.isPending} onPress={save} />
      </View>
    </Screen>
  )
}

const useStyles = makeStyles(({ colors, font, spacing, radius }) => ({
  loading: { gap: spacing.md, marginTop: spacing.xxl },
  body: { flex: 1 },
  content: { gap: 22, paddingBottom: spacing.xl },
  avatarRow: { alignItems: 'center', flexDirection: 'row', gap: 20, paddingTop: spacing.sm },
  avatarText: { gap: spacing.xs },
  changePhoto: { height: 36, justifyContent: 'center' },
  changePhotoLabel: { color: colors.accent, fontSize: 15, fontWeight: '600' },
  hint: { color: colors.textFaint, fontSize: 13 },
  pressed: { opacity: 0.6 },
  label: { color: colors.textMuted, fontSize: 14, fontWeight: '600' },
  link: { color: colors.accent, fontSize: 14, fontWeight: '600' },
  block: { gap: 10 },
  blockHead: { alignItems: 'baseline', flexDirection: 'row', justifyContent: 'space-between' },
  row: { flexDirection: 'row', flexWrap: 'wrap', gap: spacing.sm },
  languageRows: { borderTopColor: colors.border, borderTopWidth: 1 },
  languageRow: {
    alignItems: 'center',
    borderBottomColor: colors.border,
    borderBottomWidth: 1,
    flexDirection: 'row',
    justifyContent: 'space-between',
    paddingVertical: 14,
  },
  languageName: { color: colors.text, fontSize: 16, fontWeight: '600' },
  languageLevelRow: { alignItems: 'center', flexDirection: 'row', gap: 10 },
  languageLevel: { color: colors.textMuted, fontSize: 14 },
  languageStatus: { ...font.label, color: colors.textMuted, fontWeight: '400' },
  pickerPane: { height: 320 },
  levels: {
    borderTopColor: colors.border,
    borderTopWidth: 1,
    maxHeight: 140,
    paddingTop: spacing.sm,
  },
  levelRow: { marginBottom: spacing.sm },
  levelLang: { ...font.caption, color: colors.textMuted, marginBottom: spacing.xs },
  gallery: { flexDirection: 'row', flexWrap: 'wrap', gap: spacing.sm + 1 },
  photo: { backgroundColor: colors.fill, borderRadius: 14, height: PHOTO_TILE, width: PHOTO_TILE },
  photoAdd: {
    alignItems: 'center',
    backgroundColor: 'transparent',
    borderColor: colors.border,
    borderStyle: 'dashed',
    borderWidth: 1,
    justifyContent: 'center',
  },
  photoAddLabel: { color: colors.textFaint, fontSize: 22 },
  gender: { gap: 6 },
  // The field's own geometry — 54 tall, `fill`, pill — at 60%, with the lock
  // where a field would put its action.
  lockedField: {
    alignItems: 'center',
    backgroundColor: colors.fill,
    borderRadius: radius.pill,
    flexDirection: 'row',
    height: 54,
    justifyContent: 'space-between',
    opacity: 0.6,
    paddingHorizontal: 20,
  },
  lockedValue: { color: colors.text, fontSize: 16 },
  note: { color: colors.textFaint, fontSize: 13, paddingHorizontal: 6 },
  error: { ...font.caption, color: colors.danger },
  // 28 at the bottom for the same reason `Screen`'s scroll content has it: the
  // button must not sit on the home indicator.
  footer: {
    borderTopColor: colors.border,
    borderTopWidth: 1,
    paddingBottom: 28,
    paddingTop: spacing.md,
  },
}))

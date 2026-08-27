import { CEFR_LEVELS, PLAN_LIMITS, getLanguage, type CefrLevel, type Gender } from '@langx/shared'
import * as ImagePicker from 'expo-image-picker'
import { router } from 'expo-router'
import { useState } from 'react'
import {
  ActivityIndicator,
  Alert,
  Image,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  View,
} from 'react-native'
import {
  useAddPhoto,
  useMe,
  useRemovePhoto,
  useUpdateProfile,
  useUploadAvatar,
  type MeProfile,
} from '../../src/api/queries'
import { ApiRequestError } from '../../src/api/client'
import { LanguagePicker } from '../../src/components/LanguagePicker'
import { Avatar } from '../../src/components/ui/Avatar'
import { Button } from '../../src/components/ui/Button'
import { Chip } from '../../src/components/ui/Chip'
import { FormField } from '../../src/components/ui/FormField'
import { CountryPicker } from '../../src/components/CountryPicker'
import { Screen } from '../../src/components/ui/Screen'
import { colors, font, layout, radius, spacing } from '../../src/lib/theme'

const GENDER_LABELS: Record<Gender, string> = {
  female: 'Female',
  male: 'Male',
  other: 'Other',
  undisclosed: 'Prefer not to say',
}

/** What the picker returns has no mime type on every platform; infer from the extension. */
function contentTypeFor(uri: string): string {
  const extension = uri.split('?')[0]?.split('.').pop()?.toLowerCase()
  if (extension === 'png') return 'image/png'
  if (extension === 'webp') return 'image/webp'
  return 'image/jpeg'
}

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
export default function EditProfileScreen() {
  const me = useMe()

  if (me.isPending || !me.data) {
    return (
      <Screen>
        <ActivityIndicator style={styles.loading} />
      </Screen>
    )
  }
  return <EditProfileForm profile={me.data} />
}

function EditProfileForm({ profile }: { profile: MeProfile }) {
  const update = useUpdateProfile()
  const uploadAvatar = useUploadAvatar()
  const addPhoto = useAddPhoto()
  const removePhoto = useRemovePhoto()

  const [displayName, setDisplayName] = useState(profile.displayName ?? '')
  const [bio, setBio] = useState(profile?.bio ?? '')
  const [country, setCountry] = useState(profile?.country ?? '')
  const [gender, setGender] = useState<Gender>(profile?.gender ?? 'undisclosed')
  const [native, setNative] = useState<string[]>(profile?.nativeLanguages.map((l) => l.code) ?? [])
  const [learning, setLearning] = useState<{ code: string; level: CefrLevel }[]>(
    profile?.learning.map((l) => ({ code: l.code, level: l.level as CefrLevel })) ?? [],
  )
  const [editing, setEditing] = useState<'none' | 'native' | 'learning'>('none')
  const [error, setError] = useState<string | undefined>()

  const photos = profile.photos ?? []
  const learningCodes = learning.map((l) => l.code)

  async function pick(then: (uri: string, contentType: string) => void): Promise<void> {
    const permission = await ImagePicker.requestMediaLibraryPermissionsAsync()
    if (!permission.granted) {
      Alert.alert('Photos', 'LangX needs permission to open your photo library.')
      return
    }
    const result = await ImagePicker.launchImageLibraryAsync({
      mediaTypes: ['images'],
      allowsEditing: true,
      quality: 0.8,
    })
    const asset = result.assets?.[0]
    if (result.canceled || !asset) return
    then(asset.uri, asset.mimeType ?? contentTypeFor(asset.uri))
  }

  function onUploadError(caught: unknown): void {
    // Storage may simply not be configured yet on this instance; say so rather
    // than showing a generic failure the user cannot act on.
    Alert.alert(
      'Upload failed',
      caught instanceof ApiRequestError && caught.code === 'INTERNAL'
        ? 'Photo storage is not configured on this server yet.'
        : 'Could not upload that image. Try again.',
    )
  }

  async function save(): Promise<void> {
    setError(undefined)
    if (native.some((code) => learningCodes.includes(code))) {
      setError('A language cannot be both native and something you are learning.')
      return
    }
    if (native.length === 0 || learning.length === 0) {
      setError('Pick at least one native language and one you are learning.')
      return
    }
    try {
      await update.mutateAsync({
        displayName: displayName.trim(),
        bio: bio.trim(),
        gender,
        ...(country ? { country } : {}),
        nativeLanguages: native.map((code) => ({ code })),
        learning: learning.map((l, index) => ({ ...l, priority: index + 1 })),
      })
      router.back()
    } catch (caught) {
      setError(caught instanceof ApiRequestError ? caught.message : 'Could not save your profile.')
    }
  }

  return (
    <Screen scroll>
      <Pressable onPress={() => router.back()} hitSlop={12} style={styles.backRow}>
        <Text style={styles.back}>‹ Back</Text>
      </Pressable>
      <Text style={styles.title}>Edit profile</Text>

      <View style={styles.avatarRow}>
        <Avatar url={profile.avatarUrl} name={profile.displayName} size={layout.avatarLarge} />
        <View style={styles.avatarActions}>
          <Button
            label={uploadAvatar.isPending ? 'Uploading…' : 'Change photo'}
            variant="secondary"
            disabled={uploadAvatar.isPending}
            onPress={() =>
              void pick((uri, contentType) =>
                uploadAvatar.mutate({ uri, contentType }, { onError: onUploadError }),
              )
            }
          />
        </View>
      </View>

      <FormField label="Display name" value={displayName} onChangeText={setDisplayName} />
      <FormField
        label="About you"
        value={bio}
        onChangeText={setBio}
        placeholder="What do you like talking about?"
        multiline
      />
      <CountryPicker label="Country" value={country} onChange={setCountry} />

      <Text style={styles.label}>Gender</Text>
      <View style={styles.row}>
        {(Object.keys(GENDER_LABELS) as Gender[]).map((option) => (
          <Chip
            key={option}
            label={GENDER_LABELS[option]}
            selected={gender === option}
            onPress={() => setGender(option)}
          />
        ))}
      </View>

      <Text style={styles.label}>Languages</Text>
      <View style={styles.row}>
        {native.map((code) => (
          <Chip key={code} label={getLanguage(code)?.name ?? code} tone="accent" selected />
        ))}
        {learning.map((l) => (
          <Chip
            key={l.code}
            label={`${getLanguage(l.code)?.name ?? l.code} · ${l.level}`}
            tone="accent"
          />
        ))}
      </View>
      <View style={styles.row}>
        <Chip
          label="Edit native"
          onPress={() => setEditing(editing === 'native' ? 'none' : 'native')}
          selected={editing === 'native'}
        />
        <Chip
          label="Edit learning"
          onPress={() => setEditing(editing === 'learning' ? 'none' : 'learning')}
          selected={editing === 'learning'}
        />
      </View>

      {editing !== 'none' ? (
        <View style={styles.pickerPane}>
          <LanguagePicker
            selected={editing === 'native' ? native : learningCodes}
            disabledCodes={editing === 'native' ? learningCodes : native}
            max={5}
            onToggle={(code) => {
              if (editing === 'native') {
                setNative((current) =>
                  current.includes(code) ? current.filter((c) => c !== code) : [...current, code],
                )
              } else {
                setLearning((current) =>
                  current.some((l) => l.code === code)
                    ? current.filter((l) => l.code !== code)
                    : [...current, { code, level: 'A1' }],
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
                    {CEFR_LEVELS.map((level) => (
                      <Chip
                        key={level}
                        label={level}
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
        Photos ({photos.length}/{PLAN_LIMITS.free.maxPhotos})
      </Text>
      <View style={styles.gallery}>
        {photos.map((photo) => (
          <Pressable
            key={photo.url}
            onLongPress={() =>
              Alert.alert('Remove photo', 'Remove this photo from your profile?', [
                { text: 'Cancel', style: 'cancel' },
                {
                  text: 'Remove',
                  style: 'destructive',
                  onPress: () => removePhoto.mutate(photo.url),
                },
              ])
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
                addPhoto.mutate({ uri, contentType }, { onError: onUploadError }),
              )
            }
          >
            <Text style={styles.photoAddLabel}>{addPhoto.isPending ? '…' : '+'}</Text>
          </Pressable>
        ) : null}
      </View>
      <Text style={styles.hint}>Long-press a photo to remove it.</Text>

      {error ? <Text style={styles.error}>{error}</Text> : null}
      <Button label="Save" loading={update.isPending} onPress={save} style={styles.save} />
    </Screen>
  )
}

const styles = StyleSheet.create({
  loading: { marginTop: spacing.xxl },
  backRow: { paddingTop: spacing.md },
  back: { ...font.body, color: colors.textMuted },
  title: { ...font.title, color: colors.text, marginBottom: spacing.lg, marginTop: spacing.xs },
  avatarRow: {
    alignItems: 'center',
    flexDirection: 'row',
    gap: spacing.lg,
    marginBottom: spacing.lg,
  },
  avatarActions: { flex: 1 },
  label: { ...font.label, color: colors.text, marginBottom: spacing.sm, marginTop: spacing.lg },
  row: { flexDirection: 'row', flexWrap: 'wrap', gap: spacing.xs },
  pickerPane: { height: 320, marginTop: spacing.md },
  levels: {
    borderTopColor: colors.border,
    borderTopWidth: 1,
    maxHeight: 140,
    paddingTop: spacing.sm,
  },
  levelRow: { marginBottom: spacing.sm },
  levelLang: { ...font.caption, color: colors.textMuted, marginBottom: spacing.xs },
  gallery: { flexDirection: 'row', flexWrap: 'wrap', gap: spacing.sm },
  photo: { backgroundColor: colors.surface, borderRadius: radius.md, height: 96, width: 96 },
  photoAdd: {
    alignItems: 'center',
    borderColor: colors.border,
    borderStyle: 'dashed',
    borderWidth: 1,
    justifyContent: 'center',
  },
  photoAddLabel: { color: colors.textMuted, fontSize: 28 },
  hint: { ...font.caption, color: colors.textMuted, marginTop: spacing.xs },
  error: { ...font.caption, color: colors.danger, marginTop: spacing.md },
  save: { marginBottom: spacing.xxl, marginTop: spacing.lg },
})

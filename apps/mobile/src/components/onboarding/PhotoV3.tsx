import Feather from '@expo/vector-icons/Feather'
import { BIO_MAX_LENGTH } from '@langx/shared'
import { Pressable, ScrollView, Text, View } from 'react-native'
import { useT } from '../../i18n'
import { makeStyles, useTheme } from '../../lib/theme'
import { Avatar } from '../ui/Avatar'
import { Button } from '../ui/Button'
import { Screen } from '../ui/Screen'
import { FieldV3, WizardHeaderV3, WizardTitle, useWizardStyles } from './WizardV3'

/** The face's size, as drawn. */
const FACE = 128

/**
 * Step 5 in the redesign's look: the face drawn for this account, large, with
 * the way to replace it beside it twice — the camera on the face, and a
 * button that says so — and the bio under it. Both halves stay skippable, and
 * skipping is a full-size button rather than a link: "not now" is an answer
 * this step has to make as easy as "yes".
 *
 * No way back, as today: the username behind this screen is claimed.
 */
export function PhotoV3({
  avatarUrl,
  displayName,
  seed,
  uploading,
  photoLabel,
  onPickPhoto,
  bio,
  onBio,
  saving,
  onFinish,
}: {
  avatarUrl: string | undefined
  displayName: string
  seed: string | undefined
  uploading: boolean
  /** "Add a photo", "Change photo" or "Uploading…" — the route decides which. */
  photoLabel: string
  onPickPhoto: () => void
  bio: string
  onBio: (bio: string) => void
  saving: boolean
  onFinish: (save: boolean) => void
}) {
  const t = useT()
  const styles = useStyles()
  const wizard = useWizardStyles()
  const { v3 } = useTheme()

  return (
    <Screen fluid ground={v3.colors.bg}>
      <ScrollView
        style={styles.scroll}
        contentContainerStyle={wizard.column}
        keyboardShouldPersistTaps="handled"
        automaticallyAdjustKeyboardInsets
      >
        <WizardHeaderV3 step="photo" />
        <WizardTitle title={t('onboarding.photoTitle')} body={t('onboarding.photoBody')} />

        <View style={styles.faceRow}>
          <View style={styles.face}>
            {/* `Avatar` already walks photo → drawn face → initials. */}
            <Avatar url={avatarUrl} name={displayName} seed={seed} size={FACE} />
            <Pressable
              accessibilityRole="button"
              accessibilityLabel={photoLabel}
              accessibilityState={{ disabled: uploading, busy: uploading }}
              disabled={uploading}
              onPress={onPickPhoto}
              style={({ pressed }) => [styles.camera, pressed && styles.pressed]}
            >
              <Feather name="camera" size={v3.icon.lg} color={v3.colors.pillText} />
            </Pressable>
          </View>
          <View style={styles.faceSide}>
            {/* Only while it is the face on screen; a photo speaks for itself. */}
            {avatarUrl ? null : <Text style={styles.drawn}>{t('onboarding.drawnFace')}</Text>}
            <Button
              variant="ink"
              size="small"
              icon="image"
              label={photoLabel}
              loading={uploading}
              onPress={onPickPhoto}
              style={styles.addPhoto}
            />
          </View>
        </View>

        <View style={styles.bio}>
          <FieldV3
            label={t('onboarding.aboutYouOptional')}
            value={bio}
            onChangeText={onBio}
            placeholder={t('onboarding.bioPrompt')}
            multiline
            maxLength={BIO_MAX_LENGTH}
            autoCorrect
          />
        </View>

        <View style={wizard.footer}>
          <Button
            label={t('onboarding.startUsing')}
            icon="check"
            loading={saving}
            disabled={uploading}
            onPress={() => onFinish(true)}
          />
          <Button variant="secondary" label={t('common.skip')} onPress={() => onFinish(false)} />
        </View>
      </ScrollView>
    </Screen>
  )
}

const useStyles = makeStyles(({ v3 }) => ({
  scroll: { flex: 1 },
  faceRow: {
    alignItems: 'center',
    flexDirection: 'row',
    gap: v3.space[16],
    marginTop: v3.space[8],
  },
  face: { height: FACE, width: FACE },
  // On the face's edge, ringed in the ground so it reads as a button sitting
  // on the picture rather than a hole in it.
  camera: {
    alignItems: 'center',
    backgroundColor: v3.colors.pill,
    borderColor: v3.colors.bg,
    borderRadius: v3.radius.pill,
    borderWidth: 4,
    bottom: -4,
    end: -6,
    height: 52,
    justifyContent: 'center',
    position: 'absolute',
    width: 52,
  },
  pressed: { opacity: 0.7 },
  faceSide: { alignItems: 'flex-start', flex: 1, gap: v3.space[12] },
  drawn: { ...v3.type.caption, color: v3.colors.muted },
  addPhoto: { width: 'auto' },
  bio: { marginTop: v3.space[12] },
}))

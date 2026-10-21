import { useEffect, useState } from 'react'
import { Text, View } from 'react-native'
import { useT } from '../../i18n'
import { FLAG_KEYS, readJsonFlag, writeJsonFlag } from '../../lib/localFlags'
import { photoNudgeDue, withPhotoNudgeClosed } from '../../lib/photoNudge'
import { makeStyles, useTheme } from '../../lib/theme'
import { Avatar } from '../ui/Avatar'
import { Button } from '../ui/Button'
import { IconButton } from '../ui/IconButton'

/** The face in "what others see", at a list row's size. */
const PREVIEW = 32

/**
 * "Add a photo of you", under the Me hero, for an account still wearing its
 * drawn face.
 *
 * The owner's eyes only: anybody else sees the drawn face like any other,
 * with no note that a photo is missing. Closing it puts it away for a week
 * on this device (`photoNudge.ts`). It states what the face is for and
 * nothing more — no counts, no claims about replies — and it never stands in
 * front of anything.
 *
 * Blue rather than yellow: adding a photo is a suggestion, and the one
 * yellow on a screen is kept for an action that commits something.
 */
export function PhotoNudge({
  accountId,
  name,
  detail,
  seed,
  defaultAvatarRev,
  adding,
  onAddPhoto,
  onPickFace,
}: {
  accountId: string
  name: string
  /** "Spanish, learning English" — the line others see under the name. */
  detail: string | undefined
  seed: string
  defaultAvatarRev: string
  adding: boolean
  onAddPhoto: () => void
  onPickFace: () => void
}) {
  const t = useT()
  const styles = useStyles()
  const { v3 } = useTheme()
  // Undecided until the store has answered, so the card never flashes in
  // and straight back out for somebody who closed it.
  const [due, setDue] = useState<boolean | null>(null)

  useEffect(() => {
    let live = true
    void readJsonFlag<unknown>(FLAG_KEYS.photoNudgeDismissed)
      .catch(() => null)
      .then((stored) => {
        if (live) setDue(photoNudgeDue(stored, accountId, new Date()))
      })
    return () => {
      live = false
    }
  }, [accountId])

  function close(): void {
    setDue(false)
    void readJsonFlag<unknown>(FLAG_KEYS.photoNudgeDismissed)
      .catch(() => null)
      .then((stored) =>
        writeJsonFlag(
          FLAG_KEYS.photoNudgeDismissed,
          withPhotoNudgeClosed(stored, accountId, new Date()),
        ),
      )
      // Not remembered on disk: closed for this run all the same.
      .catch(() => undefined)
  }

  if (!due) return null

  return (
    <View style={styles.wrap}>
      <View style={styles.card}>
        <View style={styles.head}>
          <Text style={styles.title} accessibilityRole="header">
            {t('avatar.default.nudgeTitle')}
          </Text>
          <IconButton
            icon="x"
            iconSize={v3.icon.md}
            color={v3.colors.fg}
            accessibilityLabel={t('avatar.default.nudgeDismiss')}
            onPress={close}
          />
        </View>
        <Text style={styles.body}>{t('avatar.default.nudgeBody')}</Text>
        <Button
          variant="blue"
          icon="camera"
          label={t('avatar.default.nudgeAdd')}
          loading={adding}
          onPress={onAddPhoto}
        />
        <Button
          variant="secondary"
          icon="user"
          label={t('avatar.default.nudgePick')}
          onPress={onPickFace}
        />
      </View>
      <View style={styles.preview}>
        <Text style={styles.previewLabel}>{t('avatar.default.othersSee')}</Text>
        <View style={styles.previewRow}>
          <Avatar seed={seed} name={name} defaultAvatarRev={defaultAvatarRev} size={PREVIEW} />
          <Text style={styles.previewText} numberOfLines={1}>
            <Text style={styles.previewName}>{name}</Text>
            {detail ? ` · ${detail}` : ''}
          </Text>
        </View>
      </View>
    </View>
  )
}

const useStyles = makeStyles(({ v3 }) => ({
  wrap: { gap: v3.space[10] },
  card: {
    backgroundColor: v3.colors.surface,
    borderRadius: v3.radius.block,
    gap: v3.space[12],
    padding: v3.space[16],
  },
  head: { alignItems: 'center', flexDirection: 'row', gap: v3.space[8] },
  title: { ...v3.type.headline, color: v3.colors.fg, flex: 1 },
  body: { ...v3.type.callout, color: v3.colors.fg },
  preview: {
    borderColor: v3.colors.line,
    borderRadius: v3.radius.row,
    borderWidth: 1,
    gap: v3.space[8],
    paddingHorizontal: v3.space[14],
    paddingVertical: v3.space[10],
  },
  previewLabel: { ...v3.type.caption, color: v3.colors.muted },
  previewRow: { alignItems: 'center', flexDirection: 'row', gap: v3.space[10] },
  previewText: { ...v3.type.callout, color: v3.colors.fg, flex: 1 },
  previewName: { fontWeight: '800' },
}))

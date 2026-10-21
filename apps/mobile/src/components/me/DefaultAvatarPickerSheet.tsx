import { defaultAvatarRev, type DefaultAvatar } from '@langx/shared'
import { useEffect, useMemo, useState } from 'react'
import { FlatList, Modal, Pressable, StyleSheet, Text, View } from 'react-native'
import { useSafeAreaInsets } from 'react-native-safe-area-context'
import { usePickDefaultAvatar } from '../../api/queries'
import { useReduceMotion } from '../../hooks/useReduceMotion'
import { useT } from '../../i18n'
import { showAlert } from '../../lib/alert'
import { allFaces, faceFromKey, faceKey, sameFace } from '../../lib/defaultAvatar'
import { makeStyles, useTheme } from '../../lib/theme'
import { Avatar } from '../ui/Avatar'
import { Button } from '../ui/Button'
import { IconButton } from '../ui/IconButton'

/** A face in the grid, as drawn: the flat cut at its normal scale. */
const TILE = 64
/** 144 of them: 160px each is sharp at 64pt, where the screen's own ratio would fetch 480. */
const TILE_PIXELS = 160
const COLUMNS = 4

/**
 * Every drawn face, to choose one instead of the face assigned.
 *
 * All three pools, the person's own first: which pool a face comes from is
 * theirs to decide, and a face picked from another pool stays through a
 * gender change. Each face is shown on the ground it will be saved with, so
 * the face picked is the face seen.
 *
 * A tap selects; "Use this face" saves, so a stray tap in a grid of 144
 * costs nothing. A `Modal`, so it needs no overlay layer; the ✕, the scrim
 * and Android's back each close it.
 */
export function DefaultAvatarPickerSheet({
  visible,
  seed,
  name,
  current,
  onClose,
}: {
  visible: boolean
  /** The signed-in account's id: the URL path the faces are fetched under. */
  seed: string
  name: string
  current: DefaultAvatar
  onClose: () => void
}) {
  const t = useT()
  const styles = useStyles()
  const { v3 } = useTheme()
  const insets = useSafeAreaInsets()
  const reduce = useReduceMotion()
  const pick = usePickDefaultAvatar()
  // Keyed by value, not identity: the caller may build `current` afresh on
  // every render (see `faceKey`), and that must not reset the selection.
  const currentKey = faceKey(current)
  const worn = useMemo(() => faceFromKey(currentKey), [currentKey])
  const [selected, setSelected] = useState<DefaultAvatar>(worn)
  const faces = useMemo(() => allFaces(worn), [worn])

  // Each opening starts from the face worn now.
  useEffect(() => {
    if (visible) setSelected(worn)
  }, [visible, worn])

  async function save(): Promise<void> {
    try {
      await pick.mutateAsync(selected)
      onClose()
    } catch {
      void showAlert(t('avatar.default.pickFailed'))
    }
  }

  return (
    <Modal
      visible={visible}
      transparent
      animationType={reduce ? 'none' : 'slide'}
      statusBarTranslucent
      onRequestClose={onClose}
    >
      <View style={styles.root}>
        <Pressable
          style={[StyleSheet.absoluteFill, v3.elevation.overlay]}
          onPress={onClose}
          accessibilityElementsHidden
          importantForAccessibility="no-hide-descendants"
        />
        <View
          accessibilityViewIsModal
          style={[styles.sheet, { paddingBottom: insets.bottom + v3.space[16] }]}
        >
          <View style={styles.header}>
            <IconButton
              icon="x"
              accessibilityLabel={t('common.close')}
              onPress={onClose}
              style={styles.close}
            />
          </View>
          <Text accessibilityRole="header" style={styles.title}>
            {t('avatar.default.pickTitle')}
          </Text>
          <Text style={styles.lead}>{t('avatar.default.pickBody')}</Text>

          <FlatList
            data={faces}
            numColumns={COLUMNS}
            keyExtractor={(face) => `${face.pool}${face.index}`}
            style={styles.grid}
            columnWrapperStyle={styles.gridRow}
            contentContainerStyle={styles.gridContent}
            /*
             * Counted in rows, not faces: with four columns each "item" the
             * list renders is a row of four. Eight rows is the first screen
             * of faces; past that, rows four at a time and only as scrolling
             * brings them near. The list's default window is 21 screens,
             * which for this grid was all 144 faces the moment it opened.
             */
            initialNumToRender={8}
            maxToRenderPerBatch={4}
            windowSize={3}
            renderItem={({ item }) => {
              const on = sameFace(item, selected)
              return (
                <Pressable
                  accessibilityRole="button"
                  accessibilityLabel={t('avatar.default.tile', { index: item.index })}
                  accessibilityState={{ selected: on }}
                  onPress={() => setSelected(item)}
                  style={[styles.tile, on && styles.tileOn]}
                >
                  <Avatar
                    seed={seed}
                    name={name}
                    defaultAvatarRev={defaultAvatarRev(item)}
                    size={TILE}
                    maxPixels={TILE_PIXELS}
                  />
                </Pressable>
              )
            }}
          />

          <Button
            label={t('avatar.default.useThis')}
            icon="check"
            loading={pick.isPending}
            disabled={sameFace(selected, worn)}
            onPress={() => void save()}
          />
        </View>
      </View>
    </Modal>
  )
}

const useStyles = makeStyles(({ v3 }) => ({
  root: { flex: 1, justifyContent: 'flex-end' },
  // A phone-width column, as `WhatsProSheet` has it: the web build is the same code.
  sheet: {
    alignSelf: 'center',
    backgroundColor: v3.colors.bg,
    borderTopEndRadius: v3.radius.block,
    borderTopStartRadius: v3.radius.block,
    gap: v3.space[12],
    maxHeight: '88%',
    maxWidth: 560,
    paddingHorizontal: v3.space[16],
    paddingTop: v3.space[8],
    width: '100%',
  },
  header: { alignItems: 'center', flexDirection: 'row' },
  close: { marginStart: -v3.space[8] },
  title: { ...v3.type.headline, color: v3.colors.fg },
  lead: { ...v3.type.callout, color: v3.colors.muted },
  grid: { flexGrow: 0, flexShrink: 1 },
  gridRow: { justifyContent: 'space-between' },
  gridContent: { gap: v3.space[12], paddingVertical: v3.space[4] },
  // The ring is drawn by a border the same width either way, so selecting a
  // face does not shift the grid by the ring's width.
  tile: {
    alignItems: 'center',
    borderColor: 'transparent',
    borderRadius: v3.radius.pill,
    borderWidth: 3,
    justifyContent: 'center',
    padding: 2,
  },
  tileOn: { borderColor: v3.colors.blue },
}))

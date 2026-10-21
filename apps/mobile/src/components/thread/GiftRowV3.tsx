import Feather from '@expo/vector-icons/Feather'
import { findCosmetic, type MessageGift } from '@langx/shared'
import { Image } from 'expo-image'
import type { ReactNode, RefObject } from 'react'
import { Pressable, Text, View, type StyleProp, type ViewStyle } from 'react-native'
import { useT } from '../../i18n'
import { openStickerPack } from '../../lib/navigation'
import { stickerAsset } from '../../lib/stickerAssets'
import { cosmeticKey } from '../../lib/storeOffers'
import { makeStyles, useTheme } from '../../lib/theme'
import { Button } from '../ui/Button'

interface GiftRowV3Props {
  gift: MessageGift
  /** Whether the reader gave it — the row's sender. */
  mine: boolean
  /** The other person, for the headline. */
  partnerName: string
  box: RefObject<View | null>
  column: StyleProp<ViewStyle>
  flash: StyleProp<ViewStyle>
  meta: ReactNode
  onLongPress: () => void
}

/**
 * The row a sticker pack gift leaves in the thread (`flags.stickerGifts`).
 *
 * A record like a call's row, and drawn the same way — on the surface grey,
 * no tail, no reply swipe and no reaction — because the server wrote it and
 * nobody said it. Drawn in the v3 look whichever look the thread is in: the
 * row is new, so there is no "today's" version of it to keep.
 *
 * Three stickers from the pack so the reader sees what arrived, and one
 * button, to the pack's page. It says nothing about what the gift cost:
 * that is the giver's business.
 */
export function GiftRowV3({
  gift,
  mine,
  partnerName,
  box,
  column,
  flash,
  meta,
  onLongPress,
}: GiftRowV3Props) {
  const t = useT()
  const styles = useStyles()
  const { v3 } = useTheme()
  const pack = findCosmetic(gift.packId)
  const title = t(cosmeticKey(gift.packId))
  const headline = mine
    ? t('stickerGift.cardFromMe', { name: partnerName })
    : t('stickerGift.cardFromThem', { name: partnerName })
  const preview = (pack?.stickers ?? []).slice(0, 3)

  return (
    <View style={column}>
      <View ref={box} style={[styles.card, flash]}>
        <Pressable
          accessibilityLabel={t('stickerGift.cardAccessibility', { headline, title })}
          onLongPress={onLongPress}
          style={styles.record}
        >
          <View style={styles.icon}>
            <Feather name="gift" size={v3.icon.md} color={v3.colors.fg} />
          </View>
          <View style={styles.text}>
            <Text style={styles.headline}>{headline}</Text>
            <Text style={styles.title}>{title}</Text>
          </View>
        </Pressable>
        {preview.length > 0 ? (
          <View
            style={styles.stickers}
            accessibilityElementsHidden
            importantForAccessibility="no-hide-descendants"
          >
            {preview.map((id) => (
              <Image
                key={id}
                source={stickerAsset(gift.packId, id) ?? null}
                style={styles.sticker}
                contentFit="contain"
              />
            ))}
          </View>
        ) : null}
        <Text style={styles.note}>
          {t(mine ? 'stickerGift.cardTheirs' : 'stickerGift.cardYours')}
        </Text>
        {pack ? (
          <Button
            label={t('stickerGift.seePack')}
            onPress={() => openStickerPack(gift.packId)}
            variant="secondary"
            size="small"
            style={styles.action}
          />
        ) : null}
      </View>
      <View style={styles.meta}>{meta}</View>
    </View>
  )
}

const useStyles = makeStyles(({ v3 }) => ({
  card: {
    backgroundColor: v3.colors.surface,
    borderRadius: v3.radius.row,
    gap: v3.space[12],
    maxWidth: 320,
    padding: v3.space[14],
  },
  record: { alignItems: 'center', flexDirection: 'row', gap: v3.space[12] },
  icon: {
    alignItems: 'center',
    backgroundColor: v3.colors.bg,
    borderRadius: v3.radius.pill,
    height: 40,
    justifyContent: 'center',
    width: 40,
  },
  text: { flexShrink: 1, gap: v3.space[2] },
  headline: { ...v3.type.callout, color: v3.colors.fg, fontWeight: '700' },
  title: { ...v3.type.caption, color: v3.colors.muted },
  stickers: { flexDirection: 'row', gap: v3.space[8] },
  sticker: { height: 64, width: 64 },
  note: { ...v3.type.caption, color: v3.colors.muted },
  action: { alignSelf: 'flex-start' },
  meta: { marginTop: v3.space[4] },
}))

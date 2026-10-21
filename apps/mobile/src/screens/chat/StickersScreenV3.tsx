import Feather from '@expo/vector-icons/Feather'
import { COSMETICS, type Cosmetic } from '@langx/shared'
import { Image } from 'expo-image'
import { useLocalSearchParams } from 'expo-router'
import { Pressable, ScrollView, Text, View } from 'react-native'
import { usePurchase, useWallet } from '../../api/queries'
import { SettingsHeaderV3 } from '../../components/settings/v3/SettingsKitV3'
import { Button } from '../../components/ui/Button'
import { Screen } from '../../components/ui/Screen'
import { Skeleton } from '../../components/ui/Skeleton'
import { useT } from '../../i18n'
import { showAlert } from '../../lib/alert'
import { goBackTo, openStickerPack } from '../../lib/navigation'
import { emitWithAck, getSocket } from '../../lib/socket'
import { stickerAsset, stickerNameKey } from '../../lib/stickerAssets'
import { cosmeticKey } from '../../lib/storeOffers'
import { makeStyles, useTheme } from '../../lib/theme'
import { showToast } from '../../lib/toast'

const PACKS = COSMETICS.filter((cosmetic) => cosmetic.kind === 'stickers')

/**
 * The sticker keyboard in the redesign's look (`V-Stickers`), behind
 * `flags.v3Home`. The same packs, the same buy-on-the-spot and the same send
 * as `stickers.tsx` — read its comments for why a locked pack is shown and
 * bought here. The board changes the chrome only: the big title and a line
 * under it, each pack's name with an Owned or Locked pill, the stickers on
 * grey tiles, and the unlock as a full-width pill. The stickers themselves
 * are the pack's own pictures, untouched.
 */
export function StickersScreenV3() {
  const styles = useStyles()
  const { v3 } = useTheme()
  const t = useT()
  const { id: conversationId } = useLocalSearchParams<{ id: string }>()
  const wallet = useWallet()
  const purchase = usePurchase()
  const owned = wallet.data?.owned ?? []
  const balance = wallet.data?.balance ?? 0

  const back = (): void => goBackTo(`/(app)/chat/${conversationId}`)

  /** Buy the pack, or say why not — `stickers.tsx`'s `unlock`, word for word. */
  async function unlock(pack: Cosmetic): Promise<void> {
    const title = t(cosmeticKey(pack.id))
    if (balance < pack.price) {
      await showAlert(
        t('store.notEnoughTitle'),
        t('store.notEnoughBody', { title, price: pack.price, balance }),
      )
      return
    }
    purchase.mutate(pack.id, {
      onSuccess: () => showToast(t('store.bought', { title })),
      onError: () => void showAlert(t('store.buyFailed'), t('common.retry')),
    })
  }

  async function send(packId: string, stickerId: string): Promise<void> {
    try {
      const socket = await getSocket()
      await emitWithAck(socket, 'message:sticker', { conversationId, packId, stickerId })
      back()
    } catch (caught) {
      void caught
      await showAlert(t('chat.couldNotSend'))
    }
  }

  return (
    <Screen scroll ground={v3.colors.bg}>
      <SettingsHeaderV3 title={t('chat.stickers')} onBack={back} />
      <Text style={styles.hint}>{t('chat.stickersHint')}</Text>
      {wallet.isPending ? (
        <View style={styles.loading}>
          <Skeleton height={120} />
        </View>
      ) : (
        PACKS.map((pack) => {
          const unlocked = owned.includes(pack.id)
          const name = t(cosmeticKey(pack.id))
          return (
            <View key={pack.id} style={styles.pack}>
              <View style={styles.packHead}>
                <Text accessibilityRole="header" style={styles.packName}>
                  {name}
                </Text>
                {/* Tokens are points: the lock is a padlock, never a coin. */}
                <View style={[styles.status, unlocked ? styles.statusOwned : styles.statusLocked]}>
                  <Feather
                    name={unlocked ? 'check' : 'lock'}
                    size={v3.icon.xs}
                    color={unlocked ? v3.colors.correction : v3.colors.fg}
                  />
                  <Text style={[styles.statusLabel, unlocked && styles.statusLabelOwned]}>
                    {t(unlocked ? 'store.owned' : 'store.locked')}
                  </Text>
                </View>
                {/* The pack's own page, where wanting one can see all twelve big before buying. */}
                <Pressable
                  accessibilityRole="link"
                  accessibilityLabel={`${t('stickerPack.seePack')}: ${name}`}
                  hitSlop={8}
                  onPress={() => openStickerPack(pack.id)}
                  style={({ pressed }) => [styles.seePack, pressed && styles.pressed]}
                >
                  <Text style={styles.seePackLabel}>{t('stickerPack.seePack')}</Text>
                </Pressable>
              </View>
              <ScrollView
                horizontal
                showsHorizontalScrollIndicator={false}
                style={styles.strip}
                contentContainerStyle={styles.stripContent}
              >
                {(pack.stickers ?? []).map((stickerId) => {
                  const picture = stickerAsset(pack.id, stickerId)
                  if (!picture) return null
                  return (
                    <Pressable
                      key={stickerId}
                      accessibilityRole="button"
                      accessibilityLabel={t(stickerNameKey(pack.id, stickerId))}
                      disabled={!unlocked}
                      onPress={() => void send(pack.id, stickerId)}
                      style={({ pressed }) => [
                        styles.tile,
                        !unlocked && styles.locked,
                        pressed && styles.pressed,
                      ]}
                    >
                      <Image source={picture} style={styles.picture} contentFit="contain" />
                    </Pressable>
                  )
                })}
              </ScrollView>
              {unlocked ? null : (
                // Neutral, not yellow: the board keeps the screen free of a
                // committing colour, and a buy is not this page's job.
                <Button
                  variant="secondary"
                  icon="lock"
                  label={t('chat.stickerBuy', { price: pack.price })}
                  disabled={purchase.isPending}
                  onPress={() => void unlock(pack)}
                />
              )}
            </View>
          )
        })
      )}
    </Screen>
  )
}

/** The tile's side: the board's 80, the picture a little over half of it. */
const TILE = 80

const useStyles = makeStyles(({ v3 }) => ({
  hint: {
    ...v3.type.callout,
    color: v3.colors.muted,
    marginTop: -v3.space[4],
    paddingStart: v3.space[2],
  },
  loading: { paddingVertical: v3.space[16] },
  pack: { gap: v3.space[10], paddingTop: v3.space[24] },
  packHead: {
    alignItems: 'center',
    flexDirection: 'row',
    gap: v3.space[8],
    paddingStart: v3.space[4],
  },
  packName: { ...v3.type.headline, color: v3.colors.fg, flex: 1 },
  status: {
    alignItems: 'center',
    borderRadius: v3.radius.pill,
    flexDirection: 'row',
    gap: v3.space[4],
    height: 28,
    paddingEnd: v3.space[12],
    paddingStart: v3.space[8],
  },
  statusOwned: { backgroundColor: v3.colors.correctionTint },
  statusLocked: { backgroundColor: v3.colors.line },
  statusLabel: { ...v3.type.label, color: v3.colors.fg },
  statusLabelOwned: { color: v3.colors.correction },
  seePack: { justifyContent: 'center', minHeight: 44, paddingHorizontal: v3.space[4] },
  seePackLabel: { ...v3.type.buttonSmall, color: v3.colors.echoText },
  // Edge to edge: the strip scrolls under the page's gutter (`Screen`'s 20), as the board's does.
  strip: { marginHorizontal: -v3.space[20] },
  stripContent: { gap: v3.space[10], paddingHorizontal: v3.space[20] },
  tile: {
    alignItems: 'center',
    backgroundColor: v3.colors.surface,
    borderRadius: v3.radius.badge,
    height: TILE,
    justifyContent: 'center',
    width: TILE,
  },
  picture: { height: 56, width: 56 },
  locked: { opacity: 0.45 },
  pressed: { opacity: 0.6 },
}))

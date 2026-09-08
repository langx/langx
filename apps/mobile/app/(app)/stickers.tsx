import { COSMETICS, type Cosmetic } from '@langx/shared'
import { useLocalSearchParams } from 'expo-router'
import { Image } from 'expo-image'
import { Pressable, ScrollView, Text, View } from 'react-native'
import { usePurchase, useWallet } from '../../src/api/queries'
import { Button } from '../../src/components/ui/Button'
import { Screen } from '../../src/components/ui/Screen'
import { ScreenHeader } from '../../src/components/ui/ScreenHeader'
import { Skeleton } from '../../src/components/ui/Skeleton'
import { useT } from '../../src/i18n'
import { showAlert } from '../../src/lib/alert'
import { emitWithAck, getSocket } from '../../src/lib/socket'
import { goBackTo } from '../../src/lib/navigation'
import { stickerAsset } from '../../src/lib/stickerAssets'
import { cosmeticKey } from '../../src/lib/storeOffers'
import { makeStyles } from '../../src/lib/theme'
import { showToast } from '../../src/lib/toast'

const PACKS = COSMETICS.filter((cosmetic) => cosmetic.kind === 'stickers')

/**
 * The keyboard: every pack you own, and the ones you do not, greyed with
 * their price.
 *
 * Locked packs are shown rather than hidden, for the reason the attach sheet
 * shows a locked row: somebody who cannot see a thing cannot want it, and a
 * shop nobody browses sells nothing. The price buys the pack here, on the spot,
 * rather than sending somebody off to find it: this is where wanting one
 * happens, and a keyboard that answers "go and look in the wallet" is a
 * keyboard nobody comes back to.
 */
export default function StickersScreen() {
  const styles = useStyles()
  const t = useT()
  const { id: conversationId } = useLocalSearchParams<{ id: string }>()
  const wallet = useWallet()
  const purchase = usePurchase()
  const owned = wallet.data?.owned ?? []
  const balance = wallet.data?.balance ?? 0

  const back = (): void => goBackTo(`/(app)/chat/${conversationId}`)

  /**
   * Buy the pack, or say why not.
   *
   * The button used to push `/(app)/wallet` — the wallet's landing page, not
   * even the store, and the store drew no sticker row to arrive at either. So
   * "Unlock for 1,000 tokens" led to a screen with no packs on it and a pack
   * could not be bought anywhere in the app.
   *
   * A short balance is answered here rather than by a dimmed button: the
   * button is the only thing on the row that explains itself, and one that
   * does nothing when pressed is the bug this replaces. Everything else the
   * server refuses is a refusal the store words the same way.
   */
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
    <Screen scroll>
      <ScreenHeader title={t('chat.stickers')} onBack={back} />
      {wallet.isPending ? (
        <View style={styles.loading}>
          <Skeleton height={120} />
        </View>
      ) : (
        PACKS.map((pack) => {
          const unlocked = owned.includes(pack.id)
          return (
            <View key={pack.id} style={styles.pack}>
              <Text style={styles.packName}>{t(cosmeticKey(pack.id))}</Text>
              <ScrollView horizontal showsHorizontalScrollIndicator={false}>
                <View style={styles.grid}>
                  {(pack.stickers ?? []).map((stickerId) => {
                    const picture = stickerAsset(pack.id, stickerId)
                    if (!picture) return null
                    return (
                      <Pressable
                        key={stickerId}
                        accessibilityRole="button"
                        accessibilityLabel={stickerId}
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
                </View>
              </ScrollView>
              {unlocked ? null : (
                <Button
                  variant="neutral"
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

const useStyles = makeStyles(({ colors, spacing }) => ({
  loading: { padding: spacing.lg },
  pack: { gap: spacing.sm, paddingTop: spacing.lg },
  packName: { color: colors.text, fontSize: 17, fontWeight: '700' },
  grid: { flexDirection: 'row', gap: spacing.sm },
  tile: { alignItems: 'center', justifyContent: 'center', padding: 4 },
  picture: { height: 64, width: 64 },
  locked: { opacity: 0.3 },
  pressed: { opacity: 0.6 },
}))

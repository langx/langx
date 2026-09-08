import { COSMETICS } from '@langx/shared'
import { useLocalSearchParams, router } from 'expo-router'
import { Image } from 'expo-image'
import { Pressable, ScrollView, Text, View } from 'react-native'
import { useWallet } from '../../src/api/queries'
import { Button } from '../../src/components/ui/Button'
import { Screen } from '../../src/components/ui/Screen'
import { ScreenHeader } from '../../src/components/ui/ScreenHeader'
import { Skeleton } from '../../src/components/ui/Skeleton'
import { useT } from '../../src/i18n'
import { showAlert } from '../../src/lib/alert'
import { emitWithAck, getSocket } from '../../src/lib/socket'
import { goBackTo } from '../../src/lib/navigation'
import { stickerAsset } from '../../src/lib/stickerAssets'
import { makeStyles } from '../../src/lib/theme'

const PACKS = COSMETICS.filter((cosmetic) => cosmetic.kind === 'stickers')

/**
 * The keyboard: every pack you own, and the ones you do not, greyed with
 * their price.
 *
 * Locked packs are shown rather than hidden, for the reason the attach sheet
 * shows a locked row: somebody who cannot see a thing cannot want it, and a
 * shop nobody browses sells nothing. Tapping one goes to the wallet, which is
 * where buying already happens — the price is not re-implemented here.
 */
export default function StickersScreen() {
  const styles = useStyles()
  const t = useT()
  const { id: conversationId } = useLocalSearchParams<{ id: string }>()
  const wallet = useWallet()
  const owned = wallet.data?.owned ?? []

  const back = (): void => goBackTo(`/(app)/chat/${conversationId}`)

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
              <Text style={styles.packName}>{pack.label}</Text>
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
                  onPress={() => router.push('/(app)/wallet')}
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

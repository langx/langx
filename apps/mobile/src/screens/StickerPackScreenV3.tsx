import Feather from '@expo/vector-icons/Feather'
import { COSMETICS, type Cosmetic } from '@langx/shared'
import { Image } from 'expo-image'
import { useState } from 'react'
import { Modal, Pressable, ScrollView, Text, View } from 'react-native'
import Svg, { Circle, Path } from 'react-native-svg'
import { useMe, usePurchase, useStickerGiftOptions, useWallet } from '../api/queries'
import { LoadFailed } from '../components/LoadFailed'
import { StickerGiftSheet } from '../components/StickerGiftSheet'
import { useBlackFont } from '../components/onboarding/WizardV3'
import { Button } from '../components/ui/Button'
import { IconButton } from '../components/ui/IconButton'
import { Screen } from '../components/ui/Screen'
import { Skeleton } from '../components/ui/Skeleton'
import { useAppConfig } from '../hooks/useAppConfig'
import { useReduceMotion } from '../hooks/useReduceMotion'
import { useScreenInteractive } from '../hooks/useScreenInteractive'
import { useLocale, useT } from '../i18n'
import { showAlert } from '../lib/alert'
import { track } from '../lib/analytics'
import { authClient } from '../lib/auth-client'
import { shouldGateGuest } from '../lib/guestGate'
import { queryFailed } from '../lib/listState'
import { goBackTo } from '../lib/navigation'
import { requireAccount } from '../lib/requireAccount'
import { packTaglineKey, stickerAsset, stickerNameKey } from '../lib/stickerAssets'
import { cosmeticKey } from '../lib/storeOffers'
import { DISPLAY_FONT, makeStyles, useTheme } from '../lib/theme'
import { showToast } from '../lib/toast'

const STORE = '/(app)/wallet/store'

/** `paper` → the `stickers.paper` pack, or nothing for a name the catalogue does not have. */
export function packFromParam(param: string | undefined): Cosmetic | undefined {
  return COSMETICS.find((c) => c.kind === 'stickers' && c.id === `stickers.${param ?? ''}`)
}

/**
 * The token mark: a four-pointed spark, a point rather than a coin. The store
 * home draws the same path; fold the two together once both have landed.
 */
function TokenGlyph({ size, color }: { size: number; color: string }) {
  return (
    <Svg width={size} height={size} viewBox="0 0 24 24">
      <Path d="M12 2.5l2.4 7.1 7.1 2.4-7.1 2.4-2.4 7.1-2.4-7.1L2.5 12l7.1-2.4z" fill={color} />
    </Svg>
  )
}

/**
 * The cover's paper bunting, from the board: six die-cut flags on a string,
 * in the partner hues. Decoration, so a screen reader skips it.
 */
function Bunting({ ink, ground }: { ink: string; ground: string }) {
  const flags: readonly [string, string, 'dot' | 'diamond'][] = [
    ['M14 7 L44 9 L43 31 L29 39 L15 30 Z', '#ff9f52', 'dot'],
    ['M70 10 L100 11.5 L99.5 33 L85 41 L71 32 Z', '#3b6cf6', 'diamond'],
    ['M126 12 L156 12.5 L156 34 L141 42 L126 34 Z', '#b8e15c', 'dot'],
    ['M202 12.5 L232 12 L232 34 L217 42 L202 34 Z', '#ff8fb1', 'diamond'],
    ['M258 11.5 L288 10 L287 32 L273 41 L258.5 33 Z', '#48d3d0', 'dot'],
    ['M314 9 L344 7 L343 30 L329 39 L315 31 Z', '#bba4ff', 'diamond'],
  ]
  const centres = [29, 85, 141, 217, 273, 329]
  const tops = [20, 21, 22, 22, 21, 20]
  return (
    <Svg
      viewBox="0 0 358 44"
      style={{ aspectRatio: 358 / 44, width: '100%' }}
      accessibilityElementsHidden
      importantForAccessibility="no-hide-descendants"
    >
      <Path d="M0 6 Q179 16 358 6" fill="none" stroke={ink} strokeWidth={1.5} />
      {flags.map(([d, fill, mark], i) => {
        const x = centres[i]!
        const y = tops[i]!
        return [
          <Path key={`f${i}`} d={d} fill={fill} />,
          mark === 'dot' ? (
            <Circle key={`m${i}`} cx={x} cy={y} r={4} fill={ground} />
          ) : (
            <Path
              key={`m${i}`}
              d={`M${x} ${y - 5} L${x + 4} ${y} L${x} ${y + 5} L${x - 4} ${y} Z`}
              fill={ground}
            />
          ),
        ]
      })}
    </Svg>
  )
}

/**
 * A sticker pack's own page, behind `flags.v3Home`
 * (`app/(app)/wallet/stickers/[pack].tsx`), drawn from `V-ShopStickers`:
 * the cover, all twelve stickers, how two of them look in a chat, and the
 * price with the screen's one yellow — Buy.
 *
 * Buying is today's purchase, unchanged: the keyboard's short-balance
 * dialog, the same request, the store's toast and analytics event. Owning
 * the pack takes the yellow away: there is nothing left to commit to.
 */
export function StickerPackScreenV3({ pack }: { pack: Cosmetic }) {
  useScreenInteractive()
  const t = useT()
  const { locale, isRtl } = useLocale()
  const { v3, scheme } = useTheme()
  const styles = useStyles()
  const paper = coverPaper(scheme)
  const black = useBlackFont()
  const reduceMotion = useReduceMotion()
  const { data: session } = authClient.useSession()
  const guest = shouldGateGuest(session?.user)
  const me = useMe()
  const wallet = useWallet()
  const purchase = usePurchase()
  const [focused, setFocused] = useState<string | null>(null)
  /*
   * Giving the pack to a chat partner, behind `flags.stickerGifts`. Off, or
   * for a guest, nothing is fetched and nothing is drawn — the page is
   * exactly what it was. The server decides everything again on the tap.
   */
  const giftsOn = useAppConfig().data?.flags.stickerGifts === true
  const giftOptions = useStickerGiftOptions(pack.id, giftsOn && !guest)
  const giftRefusal = giftOptions.data?.refusal
  const canOfferGift =
    giftsOn &&
    !guest &&
    giftOptions.data !== undefined &&
    (giftRefusal === null || giftRefusal === 'weeklyLimit' || giftRefusal === 'notEnoughTokens')
  const [giving, setGiving] = useState(false)

  const title = t(cosmeticKey(pack.id))
  const stickers = pack.stickers ?? []
  const name = (id: string): string => t(stickerNameKey(pack.id, id))
  const balance = wallet.data?.balance ?? 0
  const owned = wallet.data?.owned.includes(pack.id) ?? false
  const amount = (n: number): string => n.toLocaleString(locale)
  const priceWords = t('wallet.price', { count: pack.price, amount: amount(pack.price) })

  function buy(): void {
    if (guest) {
      void requireAccount(session?.user, { action: 'other' })
      return
    }
    if (balance < pack.price) {
      void showAlert(
        t('store.notEnoughTitle'),
        t('store.notEnoughBody', { title, price: pack.price, balance }),
      )
      return
    }
    purchase.mutate(pack.id, {
      onSuccess: () => {
        track({
          name: 'tokens_spent',
          properties: { sku: pack.id, kind: 'stickers', amount: pack.price },
        })
        showToast(t('store.bought', { title }))
      },
      onError: () => void showAlert(t('store.buyFailed'), t('common.retry')),
    })
  }

  const hero = stickers.slice(0, 2).map((id) => stickerAsset(pack.id, id))
  // The board's pair: a reply of yours and one of theirs, from the middle of
  // the pack rather than the cover's two, so the page shows four, not two.
  const mine = stickers[2]
  const theirs = stickers[5]

  const footer = guest ? (
    <Button label={t('welcome.createAccount')} onPress={buy} />
  ) : !wallet.data ? (
    queryFailed(wallet) || (!me.data && queryFailed(me)) ? (
      <LoadFailed onRetry={() => void wallet.refetch()} />
    ) : (
      <Skeleton height={56} radius={v3.radius.pill} />
    )
  ) : owned ? (
    <View
      style={styles.ownedLine}
      accessible
      accessibilityLabel={t('store.ownedAccessibility', { title })}
    >
      <Feather name="check" size={v3.icon.md} color={v3.colors.correction} />
      <Text style={styles.ownedText}>{t('stickerPack.owned')}</Text>
    </View>
  ) : (
    <>
      <View style={styles.priceRow}>
        <View
          style={styles.price}
          accessible
          accessibilityLabel={priceWords}
          accessibilityRole="text"
        >
          <TokenGlyph size={v3.icon.md} color={v3.colors.blue} />
          <Text style={[styles.priceValue, !black && styles.blackFallback]}>
            {amount(pack.price)}
          </Text>
          <Text style={styles.priceUnit}>{t('stickerPack.tokenUnit', { count: pack.price })}</Text>
        </View>
        <Text style={styles.after}>
          {balance >= pack.price
            ? t('stickerPack.afterBuying', {
                balance: amount(balance),
                after: amount(balance - pack.price),
              })
            : t('stickerPack.shortBy', {
                balance: amount(balance),
                missing: amount(pack.price - balance),
              })}
        </Text>
      </View>
      <Button
        label={t('stickerPack.buy', { title })}
        accessibilityLabel={t('store.buyAccessibility', { title, price: priceWords })}
        loading={purchase.isPending}
        disabled={purchase.isPending}
        onPress={buy}
      />
    </>
  )

  return (
    <Screen fluid ground={v3.colors.bg} style={styles.shell}>
      <View style={styles.header}>
        <IconButton
          icon={isRtl ? 'chevron-right' : 'chevron-left'}
          accessibilityLabel={t('common.backPlain')}
          onPress={() => goBackTo(STORE)}
        />
        {wallet.data && !guest ? (
          <View
            style={styles.balance}
            accessible
            accessibilityLabel={`${t('wallet.balance')}: ${t('wallet.price', { count: balance, amount: amount(balance) })}`}
          >
            <TokenGlyph size={v3.icon.xs} color={v3.colors.blue} />
            <Text style={styles.balanceLabel}>{t('wallet.balance')}</Text>
            <Text style={[styles.balanceValue, !black && styles.blackFallback]}>
              {amount(balance)}
            </Text>
          </View>
        ) : null}
      </View>

      <ScrollView style={styles.fill} contentContainerStyle={styles.content}>
        <View style={styles.cover}>
          <Bunting ink={paper.ink} ground={paper.ground} />
          <View style={styles.coverBody}>
            <View style={styles.coverWords}>
              <Text style={styles.coverKicker}>{t('store.stickerKind')}</Text>
              <Text
                style={[styles.coverTitle, !black && styles.blackFallback]}
                accessibilityRole="header"
              >
                {title}
              </Text>
              <Text style={styles.coverText}>{t(packTaglineKey(pack.id))}</Text>
            </View>
            <View
              style={styles.coverArt}
              accessibilityElementsHidden
              importantForAccessibility="no-hide-descendants"
            >
              {hero[0] ? (
                <Image source={hero[0]} style={styles.heroBig} contentFit="contain" />
              ) : null}
              {hero[1] ? (
                <Image source={hero[1]} style={styles.heroSmall} contentFit="contain" />
              ) : null}
            </View>
          </View>
          <View style={styles.chips}>
            {[
              t('stickerPack.count', { count: stickers.length }),
              t('stickerPack.everyChat'),
              t('stickerPack.yoursToKeep'),
            ].map((chip) => (
              <Text key={chip} style={styles.chip}>
                {chip}
              </Text>
            ))}
          </View>
        </View>

        <View style={styles.section}>
          <View style={styles.sectionHead}>
            <Text
              style={[styles.sectionTitle, !black && styles.blackFallback]}
              accessibilityRole="header"
            >
              {t('stickerPack.inThePack')}
            </Text>
            <Text style={styles.muted}>{t('stickerPack.tapToPreview')}</Text>
          </View>
          <View style={styles.grid}>
            {stickers.map((id) => (
              <Pressable
                key={id}
                accessibilityRole="button"
                accessibilityLabel={t('stickerPack.previewAccessibility', { name: name(id) })}
                onPress={() => setFocused(id)}
                style={({ pressed }) => [styles.tile, pressed && styles.pressed]}
              >
                <Image
                  source={stickerAsset(pack.id, id) ?? null}
                  style={styles.tilePicture}
                  contentFit="contain"
                />
              </Pressable>
            ))}
          </View>
        </View>

        {mine && theirs ? (
          <View style={styles.section}>
            <Text
              style={[styles.sectionTitle, styles.inset, !black && styles.blackFallback]}
              accessibilityRole="header"
            >
              {t('stickerPack.inAChat')}
            </Text>
            <View style={styles.chat}>
              <View style={styles.theirRow}>
                <View style={styles.partner} />
                <Text style={[styles.bubble, styles.theirBubble]}>
                  {t('stickerPack.chatTheirs')}
                </Text>
              </View>
              <Image
                source={stickerAsset(pack.id, mine) ?? null}
                style={styles.mineSticker}
                contentFit="contain"
                accessible
                accessibilityLabel={t('stickerPack.sentByYou', { name: name(mine) })}
              />
              <Text style={[styles.bubble, styles.mineBubble]}>{t('stickerPack.chatMine')}</Text>
              <View style={styles.theirRow}>
                <View style={styles.partner} />
                <Image
                  source={stickerAsset(pack.id, theirs) ?? null}
                  style={styles.theirSticker}
                  contentFit="contain"
                  accessible
                  accessibilityLabel={t('stickerPack.sentByThem', { name: name(theirs) })}
                />
              </View>
            </View>
            <Text style={[styles.muted, styles.inset]}>{t('stickerPack.chatNote')}</Text>
          </View>
        ) : null}
      </ScrollView>

      <View style={styles.footer}>
        {footer}
        {canOfferGift && wallet.data ? (
          <Button
            variant="secondary"
            icon="gift"
            label={t('stickerGift.give')}
            accessibilityLabel={t('stickerGift.giveAccessibility', { title })}
            onPress={() => setGiving(true)}
          />
        ) : null}
      </View>

      {canOfferGift ? (
        <StickerGiftSheet
          visible={giving}
          pack={pack}
          title={title}
          balance={balance}
          options={giftOptions.data}
          onClose={() => setGiving(false)}
        />
      ) : null}

      <Modal
        visible={focused !== null}
        transparent
        animationType={reduceMotion ? 'none' : 'fade'}
        onRequestClose={() => setFocused(null)}
      >
        <Pressable
          style={styles.scrim}
          onPress={() => setFocused(null)}
          accessibilityElementsHidden
          importantForAccessibility="no-hide-descendants"
        />
        <View style={styles.previewWrap} pointerEvents="box-none">
          {focused ? (
            <View style={styles.preview} accessibilityViewIsModal>
              <Image
                source={stickerAsset(pack.id, focused) ?? null}
                style={styles.previewPicture}
                contentFit="contain"
                accessible
                accessibilityLabel={name(focused)}
              />
              <Text style={[styles.previewName, !black && styles.blackFallback]}>
                {name(focused)}
              </Text>
              <Button
                variant="secondary"
                label={t('common.close')}
                onPress={() => setFocused(null)}
                style={styles.previewClose}
              />
            </View>
          ) : null}
        </View>
      </Modal>
    </Screen>
  )
}

/*
 * The cover's paper, from the board. Its own colours rather than tokens: it
 * is the one block on the screen drawn as a material, and a token for a
 * single block would be a name nothing else could use.
 */
function coverPaper(scheme: 'light' | 'dark') {
  const dark = scheme === 'dark'
  return {
    ground: dark ? '#2e2618' : '#f6e7cf',
    ink: dark ? '#f6ecd8' : '#14161b',
    muted: dark ? '#d8c6a4' : '#6b5330',
    chip: dark ? 'rgba(246,236,216,0.12)' : 'rgba(20,22,27,0.07)',
  }
}

const useStyles = makeStyles(({ scheme, v3 }) => {
  const dark = scheme === 'dark'
  const paper = coverPaper(scheme)
  const coverInk = paper.ink
  return {
    shell: { paddingHorizontal: 0 },
    fill: { flex: 1 },
    header: {
      alignItems: 'center',
      flexDirection: 'row',
      justifyContent: 'space-between',
      paddingEnd: v3.space[16],
      paddingStart: v3.space[6],
      paddingVertical: v3.space[6],
    },
    balance: {
      alignItems: 'center',
      backgroundColor: v3.colors.surface,
      borderRadius: v3.radius.pill,
      flexDirection: 'row',
      gap: v3.space[6],
      minHeight: 36,
      paddingHorizontal: v3.space[12],
    },
    balanceLabel: { ...v3.type.caption, color: v3.colors.muted, fontWeight: '600' },
    balanceValue: { ...v3.type.buttonSmall, color: v3.colors.fg, fontFamily: 'Nunito_900Black' },
    blackFallback: { fontFamily: DISPLAY_FONT },
    content: {
      gap: v3.space[24],
      paddingBottom: v3.space[20],
      paddingHorizontal: v3.space[16],
      paddingTop: v3.space[4],
    },
    cover: {
      backgroundColor: paper.ground,
      borderRadius: v3.radius.block,
      overflow: 'hidden',
    },
    coverBody: {
      alignItems: 'center',
      flexDirection: 'row',
      gap: v3.space[8],
      paddingBottom: v3.space[20],
      paddingHorizontal: v3.space[20],
      paddingTop: v3.space[4],
    },
    coverWords: { flex: 1, gap: v3.space[6] },
    coverKicker: {
      ...v3.type.label,
      color: paper.muted,
      letterSpacing: 0.8,
      textTransform: 'uppercase',
    },
    coverTitle: { ...v3.type.title, color: coverInk },
    coverText: { ...v3.type.callout, color: coverInk },
    coverArt: { height: 128, width: 132 },
    heroBig: {
      height: 116,
      position: 'absolute',
      start: 0,
      top: 0,
      transform: [{ rotate: '-8deg' }],
      width: 116,
    },
    heroSmall: {
      bottom: 0,
      end: 0,
      height: 88,
      position: 'absolute',
      transform: [{ rotate: '6deg' }],
      width: 88,
    },
    chips: {
      flexDirection: 'row',
      flexWrap: 'wrap',
      gap: v3.space[8],
      paddingBottom: v3.space[20],
      paddingHorizontal: v3.space[20],
    },
    chip: {
      ...v3.type.caption,
      backgroundColor: paper.chip,
      borderRadius: v3.radius.pill,
      color: coverInk,
      fontWeight: '700',
      overflow: 'hidden',
      paddingHorizontal: v3.space[12],
      paddingVertical: 5,
    },
    section: { gap: v3.space[12] },
    sectionHead: {
      alignItems: 'baseline',
      flexDirection: 'row',
      flexWrap: 'wrap',
      gap: v3.space[8],
      justifyContent: 'space-between',
      paddingHorizontal: v3.space[4],
    },
    sectionTitle: {
      ...v3.type.headline,
      color: v3.colors.fg,
      fontFamily: 'Nunito_900Black',
      fontSize: 20,
      lineHeight: 24,
    },
    muted: { ...v3.type.caption, color: v3.colors.muted },
    inset: { paddingHorizontal: v3.space[4] },
    grid: { flexDirection: 'row', flexWrap: 'wrap', gap: v3.space[12] },
    tile: {
      alignItems: 'center',
      aspectRatio: 1,
      backgroundColor: v3.colors.surface,
      borderRadius: v3.radius.tile,
      flexBasis: '21%',
      flexGrow: 1,
      justifyContent: 'center',
    },
    tilePicture: { height: '88%', width: '88%' },
    pressed: { opacity: 0.6 },
    chat: {
      backgroundColor: v3.colors.surface,
      borderRadius: v3.radius.badge,
      gap: v3.space[10],
      paddingHorizontal: v3.space[14],
      paddingVertical: v3.space[16],
    },
    theirRow: { alignItems: 'flex-end', flexDirection: 'row', gap: v3.space[8] },
    partner: {
      backgroundColor: v3.hues.lilac,
      borderRadius: v3.radius.pill,
      height: 32,
      width: 32,
    },
    bubble: {
      ...v3.type.callout,
      borderRadius: 20,
      maxWidth: 236,
      overflow: 'hidden',
      paddingHorizontal: v3.space[14],
      paddingVertical: v3.space[10],
    },
    theirBubble: {
      backgroundColor: dark ? v3.colors.line : v3.colors.bg,
      borderBottomStartRadius: 6,
      color: v3.colors.fg,
      flexShrink: 1,
    },
    mineBubble: {
      alignSelf: 'flex-end',
      backgroundColor: v3.colors.blue,
      borderBottomEndRadius: 6,
      color: v3.colors.onBlue,
    },
    mineSticker: { alignSelf: 'flex-end', height: 128, width: 128 },
    theirSticker: { height: 94, width: 94 },
    footer: {
      backgroundColor: v3.colors.bg,
      borderTopColor: v3.colors.line,
      borderTopWidth: 1,
      gap: v3.space[10],
      paddingBottom: v3.space[16],
      paddingHorizontal: v3.space[16],
      paddingTop: v3.space[12],
    },
    priceRow: {
      alignItems: 'center',
      flexDirection: 'row',
      flexWrap: 'wrap',
      gap: v3.space[12],
      justifyContent: 'space-between',
      paddingHorizontal: v3.space[4],
    },
    price: { alignItems: 'center', flexDirection: 'row', gap: v3.space[6] },
    priceValue: {
      color: v3.colors.fg,
      fontFamily: 'Nunito_900Black',
      fontSize: 24,
      lineHeight: 28,
    },
    priceUnit: { ...v3.type.callout, color: v3.colors.muted, fontWeight: '600' },
    after: { ...v3.type.caption, color: v3.colors.muted, flexShrink: 1, textAlign: 'right' },
    ownedLine: {
      alignItems: 'center',
      flexDirection: 'row',
      gap: v3.space[8],
      justifyContent: 'center',
      minHeight: 56,
    },
    ownedText: { ...v3.type.callout, color: v3.colors.fg, flexShrink: 1 },
    scrim: { ...v3.elevation.overlay, bottom: 0, end: 0, position: 'absolute', start: 0, top: 0 },
    previewWrap: { alignItems: 'center', flex: 1, justifyContent: 'center', padding: v3.space[24] },
    preview: {
      alignItems: 'center',
      backgroundColor: v3.colors.bg,
      borderRadius: v3.radius.block,
      gap: v3.space[12],
      maxWidth: 360,
      padding: v3.space[24],
      width: '100%',
    },
    previewPicture: { height: 220, width: 220 },
    previewName: { ...v3.type.headline, color: v3.colors.fg, textAlign: 'center' },
    previewClose: { alignSelf: 'stretch' },
  }
})

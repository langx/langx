import type { Cosmetic, StickerGiftOptions, StickerGiftPartnerState } from '@langx/shared'
import { useState } from 'react'
import { Modal, Pressable, ScrollView, Text, View } from 'react-native'
import { ApiRequestError } from '../api/client'
import { useGiveStickerPack } from '../api/queries'
import { useLocale, useT, type MessageKey } from '../i18n'
import { showAlert } from '../lib/alert'
import { makeStyles, useTheme } from '../lib/theme'
import { showToast } from '../lib/toast'
import { newClientId } from '../lib/unsentMessages'
import { Avatar } from './ui/Avatar'
import { Button } from './ui/Button'

type Partner = StickerGiftOptions['partners'][number]

const STATE_KEY: Record<Exclude<StickerGiftPartnerState, 'ready'>, MessageKey> = {
  keepTalking: 'stickerGift.stateKeepTalking',
  recipientOwns: 'stickerGift.stateOwns',
  unavailable: 'stickerGift.stateUnavailable',
}

/** The sentence for a refusal the server gave after the confirmation. */
export function giftRefusalKey(reason: string | undefined): MessageKey {
  switch (reason) {
    case 'keepTalking':
      return 'stickerGift.refusalKeepTalking'
    case 'recipientOwns':
      return 'stickerGift.refusalOwns'
    case 'weeklyLimit':
      return 'stickerGift.refusalWeekly'
    case 'notEnoughTokens':
      return 'stickerGift.refusalTokens'
    case 'unavailable':
      return 'stickerGift.refusalUnavailable'
    default:
      return 'stickerGift.refusalGeneric'
  }
}

/**
 * Give a sticker pack: pick one of the people you talk to, then confirm with
 * the price — two steps in one sheet, behind `flags.stickerGifts`.
 *
 * Rows that cannot be given to stay in the list, greyed, with the reason in
 * words rather than numbers: "keep talking", never "38 more messages". The
 * confirmation carries the screen's one yellow and the honest line — the pack
 * becomes theirs, nothing comes back — which is the sentence the Terms will
 * say once Behic has changed them.
 */
export function StickerGiftSheet({
  visible,
  pack,
  title,
  balance,
  options,
  onClose,
}: {
  visible: boolean
  pack: Cosmetic
  /** The pack's localised name. */
  title: string
  balance: number
  options: StickerGiftOptions | undefined
  onClose: () => void
}) {
  const t = useT()
  const { locale } = useLocale()
  const { v3 } = useTheme()
  const styles = useStyles()
  const give = useGiveStickerPack()
  const [picked, setPicked] = useState<Partner | null>(null)
  // One id per confirmation screen, so a retry of the same tap is the same gift.
  const [clientId, setClientId] = useState(() => newClientId(Date.now(), Math.random()))

  const amount = (n: number): string => n.toLocaleString(locale)
  const price = t('wallet.price', { count: pack.price, amount: amount(pack.price) })
  const partners = options?.partners ?? []

  function close(): void {
    setPicked(null)
    onClose()
  }

  function pick(partner: Partner): void {
    setClientId(newClientId(Date.now(), Math.random()))
    setPicked(partner)
  }

  function confirm(partner: Partner): void {
    give.mutate(
      { conversationId: partner.conversationId, packId: pack.id, clientId },
      {
        onSuccess: () => {
          showToast(t('stickerGift.sent', { name: partner.displayName, title }))
          close()
        },
        onError: (error) => {
          const reason = error instanceof ApiRequestError ? error.reason : undefined
          void showAlert(t('stickerGift.failedTitle'), t(giftRefusalKey(reason)))
        },
      },
    )
  }

  const body = picked ? (
    <>
      <Text style={styles.title} accessibilityRole="header">
        {t('stickerGift.confirmTitle', { title, name: picked.displayName })}
      </Text>
      <View style={styles.person}>
        <Avatar
          url={picked.avatarUrl ?? undefined}
          name={picked.displayName}
          seed={picked.userId}
          size={48}
        />
        <View style={styles.personText}>
          <Text style={styles.name}>{picked.displayName}</Text>
          <Text style={styles.muted}>@{picked.handle}</Text>
        </View>
      </View>
      <View style={styles.priceRow}>
        <Text style={styles.price}>{price}</Text>
        <Text style={styles.muted}>
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
      <Text style={styles.honesty}>{t('stickerGift.honesty')}</Text>
      <Button
        label={t('stickerGift.confirm', { price })}
        loading={give.isPending}
        disabled={give.isPending || balance < pack.price}
        onPress={() => confirm(picked)}
      />
      <Button
        variant="secondary"
        label={t('common.backPlain')}
        disabled={give.isPending}
        onPress={() => setPicked(null)}
      />
    </>
  ) : (
    <>
      <Text style={styles.title} accessibilityRole="header">
        {t('stickerGift.pickTitle', { title })}
      </Text>
      <Text style={styles.muted}>{t('stickerGift.pickNote')}</Text>
      {options?.refusal === 'weeklyLimit' ? (
        <Text style={styles.notice}>{t('stickerGift.weeklyUsed')}</Text>
      ) : partners.length === 0 ? (
        <Text style={styles.notice}>{t('stickerGift.empty')}</Text>
      ) : (
        <ScrollView style={styles.list} contentContainerStyle={styles.listContent}>
          {partners.map((partner) => {
            const ready = partner.state === 'ready'
            const stateWords = partner.state === 'ready' ? null : t(STATE_KEY[partner.state])
            return (
              <Pressable
                key={partner.conversationId}
                accessibilityRole="button"
                accessibilityState={{ disabled: !ready }}
                accessibilityLabel={
                  stateWords
                    ? t('stickerGift.rowAccessibility', {
                        name: partner.displayName,
                        state: stateWords,
                      })
                    : partner.displayName
                }
                disabled={!ready}
                onPress={() => pick(partner)}
                style={({ pressed }) => [
                  styles.row,
                  !ready && styles.rowOff,
                  pressed && styles.pressed,
                ]}
              >
                <Avatar
                  url={partner.avatarUrl ?? undefined}
                  name={partner.displayName}
                  seed={partner.userId}
                  size={40}
                />
                <View style={styles.personText}>
                  <Text style={styles.name}>{partner.displayName}</Text>
                  <Text style={styles.muted}>{stateWords ?? `@${partner.handle}`}</Text>
                </View>
              </Pressable>
            )
          })}
        </ScrollView>
      )}
      {options && options.refusal === null ? (
        <Text style={styles.muted}>
          {t('stickerGift.sendsLeft', { count: options.sendsLeftThisWeek })}
        </Text>
      ) : null}
      <Button variant="secondary" label={t('common.close')} onPress={close} />
    </>
  )

  return (
    <Modal visible={visible} transparent animationType="slide" onRequestClose={close}>
      <Pressable
        style={styles.scrim}
        onPress={close}
        accessibilityElementsHidden
        importantForAccessibility="no-hide-descendants"
      />
      <View style={styles.wrap} pointerEvents="box-none">
        <View style={[styles.sheet, { gap: v3.space[12] }]} accessibilityViewIsModal>
          {body}
        </View>
      </View>
    </Modal>
  )
}

const useStyles = makeStyles(({ v3 }) => ({
  scrim: { ...v3.elevation.overlay, bottom: 0, end: 0, position: 'absolute', start: 0, top: 0 },
  wrap: { flex: 1, justifyContent: 'flex-end' },
  sheet: {
    backgroundColor: v3.colors.bg,
    borderTopEndRadius: v3.radius.block,
    borderTopStartRadius: v3.radius.block,
    maxHeight: '85%',
    paddingBottom: v3.space[24],
    paddingHorizontal: v3.space[16],
    paddingTop: v3.space[20],
  },
  title: { ...v3.type.headline, color: v3.colors.fg },
  muted: { ...v3.type.caption, color: v3.colors.muted },
  notice: { ...v3.type.callout, color: v3.colors.fg, paddingVertical: v3.space[12] },
  list: { flexGrow: 0 },
  listContent: { gap: v3.space[4] },
  row: {
    alignItems: 'center',
    borderRadius: v3.radius.row,
    flexDirection: 'row',
    gap: v3.space[12],
    minHeight: 56,
    paddingHorizontal: v3.space[8],
    paddingVertical: v3.space[8],
  },
  rowOff: { opacity: 0.5 },
  pressed: { backgroundColor: v3.colors.surface },
  person: { alignItems: 'center', flexDirection: 'row', gap: v3.space[12] },
  personText: { flexShrink: 1, gap: v3.space[2] },
  name: { ...v3.type.callout, color: v3.colors.fg, fontWeight: '700' },
  priceRow: {
    alignItems: 'baseline',
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: v3.space[8],
    justifyContent: 'space-between',
  },
  price: { ...v3.type.callout, color: v3.colors.fg, fontWeight: '700' },
  honesty: { ...v3.type.caption, color: v3.colors.fg },
}))

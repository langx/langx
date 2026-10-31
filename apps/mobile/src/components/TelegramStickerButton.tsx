import { Linking } from 'react-native'
import { useAppConfig } from '../hooks/useAppConfig'
import { useT } from '../i18n'
import { Button } from './ui/Button'

/**
 * The public Telegram sets, by catalogue pack id. A pack page shows the
 * button only for an id listed here. The sets are published from the admin
 * bot, not built from this repo; langx.io's Venus page links the same one.
 */
export const TELEGRAM_PACKS: Readonly<Record<string, string>> = {
  'stickers.venus': 'https://t.me/addstickers/venus_langx',
}

/**
 * The pack's Telegram link when "Add to Telegram" can be drawn here, and
 * `undefined` otherwise. Its own hook for the same reason as
 * `useWhatsAppStickerPack`: Venus's questions read the answer the button does.
 */
export function useTelegramStickerPack(packId: string): string | undefined {
  const flagOn = useAppConfig().data?.flags.telegramStickers === true
  return flagOn ? TELEGRAM_PACKS[packId] : undefined
}

/**
 * "Add to Telegram" for a sticker pack, behind `flags.telegramStickers`.
 *
 * A link, not an export: Telegram takes the set from its own servers, so
 * there is nothing to check first. `Linking` rather than `openExternal`,
 * because the in-app browser does not hand a t.me link to the Telegram app;
 * without Telegram the link lands on the set's web page, which says how to get it.
 */
export function TelegramStickerButton({ packId }: { packId: string }) {
  const t = useT()
  const url = useTelegramStickerPack(packId)

  if (url === undefined) return null

  return (
    <Button
      variant="secondary"
      label={t('stickerPack.addToTelegram')}
      onPress={() => {
        // Rejects only on a device with no browser at all: nothing to say.
        Linking.openURL(url).catch(() => {})
      }}
    />
  )
}

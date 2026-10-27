import { useEffect, useState } from 'react'
import { AppState, Platform } from 'react-native'
import { addStickerPackToWhatsApp, isWhatsAppInstalled } from '../../modules/whatsapp-stickers'
import { useAppConfig } from '../hooks/useAppConfig'
import { useT } from '../i18n'
import { showToast } from '../lib/toast'
import { whatsAppPackFor } from '../lib/whatsappStickers'
import { Button } from './ui/Button'

/**
 * The pack's WhatsApp identifier when "Add to WhatsApp" can be drawn here,
 * and `undefined` otherwise: the flag is on, this is not the web, the pack
 * has a WhatsApp export (`WHATSAPP_PACKS`), the binary has the native module,
 * and WhatsApp is on the phone. The last is asked again whenever the app
 * comes back to the front — somebody who installs WhatsApp to use the button
 * should find it there when they return.
 *
 * Its own hook so that words about the button (Venus's questions) read the
 * same answer the button does, and never point at a button that is not
 * there — on the web, above all, where it never draws.
 */
export function useWhatsAppStickerPack(packId: string): string | undefined {
  const flagOn = useAppConfig().data?.flags.whatsappStickers === true
  const identifier = whatsAppPackFor(packId)
  const eligible = Platform.OS !== 'web' && flagOn && identifier !== undefined
  const [installed, setInstalled] = useState(false)

  useEffect(() => {
    if (!eligible) return
    let live = true
    const check = (): void => {
      void isWhatsAppInstalled().then((yes) => {
        if (live) setInstalled(yes)
      })
    }
    check()
    const subscription = AppState.addEventListener('change', (state) => {
      if (state === 'active') check()
    })
    return () => {
      live = false
      subscription.remove()
    }
  }, [eligible])

  return eligible && installed ? identifier : undefined
}

/**
 * "Add to WhatsApp" for a sticker pack, behind `flags.whatsappStickers`.
 * Draws nothing unless `useWhatsAppStickerPack` says it can, so it can sit
 * on any pack's page.
 *
 * Not tied to owning the pack: the packs exported so far are free, and what
 * WhatsApp receives is a copy that never touches the wallet.
 */
export function WhatsAppStickerButton({ packId }: { packId: string }) {
  const t = useT()
  const identifier = useWhatsAppStickerPack(packId)
  const [opening, setOpening] = useState(false)

  if (identifier === undefined) return null

  async function add(id: string): Promise<void> {
    setOpening(true)
    try {
      await addStickerPackToWhatsApp(id)
    } catch {
      showToast(t('stickerPack.addToWhatsAppFailed'))
    } finally {
      setOpening(false)
    }
  }

  return (
    <Button
      variant="secondary"
      label={t('stickerPack.addToWhatsApp')}
      loading={opening}
      disabled={opening}
      onPress={() => add(identifier)}
    />
  )
}

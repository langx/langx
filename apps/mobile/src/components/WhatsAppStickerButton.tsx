import { useEffect, useState } from 'react'
import { AppState, Platform } from 'react-native'
import { addStickerPackToWhatsApp, isWhatsAppInstalled } from '../../modules/whatsapp-stickers'
import { useAppConfig } from '../hooks/useAppConfig'
import { useT } from '../i18n'
import { showToast } from '../lib/toast'
import { whatsAppPacksFor } from '../lib/whatsappStickers'
import { Button } from './ui/Button'

/**
 * "Add to WhatsApp" for a sticker pack, behind `flags.whatsappStickers` — one
 * button per WhatsApp pack, since WhatsApp stops at 30 and a bigger pack is
 * exported in parts. A single part keeps the plain label.
 *
 * Draws nothing unless every one of these holds, so it can sit on any pack's
 * page: the flag is on, this is not the web, the pack has a WhatsApp export
 * (`WHATSAPP_PACKS`), the binary has the native module, and WhatsApp is on
 * the phone. The last is asked again whenever the app comes back to the
 * front — somebody who installs WhatsApp to use the button should find it
 * there when they return.
 *
 * Not tied to owning the pack: the packs exported so far are free, and what
 * WhatsApp receives is a copy that never touches the wallet.
 */
export function WhatsAppStickerButton({ packId }: { packId: string }) {
  const t = useT()
  const flagOn = useAppConfig().data?.flags.whatsappStickers === true
  const identifiers = whatsAppPacksFor(packId)
  const eligible = Platform.OS !== 'web' && flagOn && identifiers.length > 0
  const [installed, setInstalled] = useState(false)
  const [opening, setOpening] = useState<string | null>(null)

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

  if (!eligible || !installed) return null

  async function add(id: string): Promise<void> {
    setOpening(id)
    try {
      await addStickerPackToWhatsApp(id)
    } catch {
      showToast(t('stickerPack.addToWhatsAppFailed'))
    } finally {
      setOpening(null)
    }
  }

  return (
    <>
      {identifiers.map((id, i) => (
        <Button
          key={id}
          variant="secondary"
          label={
            identifiers.length > 1
              ? t('stickerPack.addPartToWhatsApp', { part: i + 1 })
              : t('stickerPack.addToWhatsApp')
          }
          loading={opening === id}
          disabled={opening !== null}
          onPress={() => add(id)}
        />
      ))}
    </>
  )
}

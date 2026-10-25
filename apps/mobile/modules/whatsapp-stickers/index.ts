import { requireOptionalNativeModule } from 'expo'

/**
 * Hands a LangX sticker pack to WhatsApp.
 *
 * The two platforms take a pack in different ways, both from WhatsApp's
 * official sample apps (github.com/WhatsApp/stickers):
 *
 * - **Android** — WhatsApp reads the pack out of our `ContentProvider`
 *   (`StickerContentProvider.kt`) after we send it
 *   `com.whatsapp.intent.action.ENABLE_STICKER_PACK` naming the provider's
 *   authority and the pack.
 * - **iOS** — we put the whole pack, as JSON, on the pasteboard under
 *   `net.whatsapp.third-party.sticker-pack` and open `whatsapp://stickerPack`.
 *
 * Either way WhatsApp then asks the person to confirm. The files and the JSON
 * are written by `scripts/build-whatsapp-stickers.ts` and checked by
 * `src/lib/whatsappStickers.test.ts`; nothing here builds them.
 *
 * `requireOptionalNativeModule`, as every module here: web, and every binary
 * built before this module existed, get `null`, and the button that calls
 * this never draws.
 */
interface WhatsAppStickersNative {
  isWhatsAppInstalled: () => Promise<boolean>
  /** Resolves once WhatsApp has been opened; rejects when it could not be. */
  addStickerPack: (identifier: string) => Promise<void>
}

const native = requireOptionalNativeModule<WhatsAppStickersNative>('WhatsAppStickers')

/** Whether WhatsApp (or WhatsApp Business, on Android) is on this phone. False on web. */
export async function isWhatsAppInstalled(): Promise<boolean> {
  if (!native) return false
  try {
    return await native.isWhatsAppInstalled()
  } catch {
    return false
  }
}

/** Opens WhatsApp on its "add this sticker pack" sheet for `identifier`. */
export async function addStickerPackToWhatsApp(identifier: string): Promise<void> {
  if (!native) throw new Error('WhatsApp stickers are not in this build')
  await native.addStickerPack(identifier)
}

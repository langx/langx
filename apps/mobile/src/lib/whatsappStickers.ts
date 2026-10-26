/**
 * A LangX sticker pack, exported to WhatsApp: its limits, its metadata, and
 * the two shapes WhatsApp reads it in.
 *
 * Pure on purpose. `scripts/build-whatsapp-stickers.ts` uses it to write the
 * files the native module ships, and `whatsappStickers.test.ts` uses it to
 * check those files — so the rules are written once, here, and the Kotlin and
 * Swift halves (`modules/whatsapp-stickers`) only move bytes they are handed.
 *
 * The limits are WhatsApp's own, from the official sample apps
 * (github.com/WhatsApp/stickers: `Limits.swift` on iOS,
 * `StickerPackValidator.java` on Android). WhatsApp re-checks every one of
 * them when the pack arrives and refuses the whole pack over a single
 * sticker, with nothing shown to the person but "could not add" — which is
 * why they are tested here rather than discovered on a phone.
 */

export const WHATSAPP_LIMITS = {
  minStickers: 3,
  maxStickers: 30,
  stickerSide: 512,
  maxStaticStickerBytes: 100 * 1024,
  maxAnimatedStickerBytes: 500 * 1024,
  traySide: 96,
  maxTrayBytes: 50 * 1024,
  minEmojis: 1,
  maxEmojis: 3,
  maxChars: 128,
  maxStaticAccessibilityChars: 125,
} as const

/**
 * The folder, inside the Android assets, that holds `contents.json` and one
 * folder per pack. The Kotlin provider names it too (`ASSET_ROOT`).
 */
export const ANDROID_ASSET_ROOT = 'whatsapp-stickers'

/** The tray icon's file name inside a pack's folder. */
export const TRAY_FILE = 'tray.png'

/**
 * The store listings WhatsApp links a received sticker to. The Android
 * sample refuses an iOS link on any host but `itunes.apple.com`, so the
 * listing in `storeListing.ts` is spelled the old way here.
 */
export const STORE_LINKS = {
  ios: 'https://itunes.apple.com/app/id6474187141',
  android: 'https://play.google.com/store/apps/details?id=tech.newchapter.languageXchange',
} as const

export interface WhatsAppPackInfo {
  /** WhatsApp's key for the pack, with the provider authority. Never change it once shipped. */
  identifier: string
  /** Shown in WhatsApp as is: a proper noun, so not translated. */
  name: string
  publisher: string
  publisherWebsite: string
  privacyPolicyWebsite: string
  licenseAgreementWebsite: string
  /**
   * The set's pictures this pack takes, by file name without extension. The
   * build script exports these and no others, in the set's order.
   */
  stickers: readonly string[]
}

/**
 * The packs this build can hand to WhatsApp, by catalogue id. A pack page
 * shows the button only for an id listed here.
 */
export const WHATSAPP_PACKS: Readonly<Record<string, WhatsAppPackInfo>> = {
  'stickers.venus': {
    identifier: 'venus',
    name: 'Venus',
    publisher: 'LangX',
    publisherWebsite: 'https://langx.io',
    privacyPolicyWebsite: 'https://langx.io/privacy-policy',
    licenseAgreementWebsite: 'https://langx.io/terms',
    /*
     * Venus has sixty and WhatsApp takes thirty a pack. One pack, not two, so
     * these are the thirty: one per meaning, no near-duplicates, the wordless
     * picture where there is one. That leaves out the eight hellos (01-hi
     * says it without words), the thanks in seven languages (39-thanks-en
     * stays, as the words most people read), good night (17-sleepy), well
     * done (10-celebrate), oops (06-sorry), and poses that repeat a mood
     * already here. Swap a sticker by editing this list and re-running the
     * script; 01-hi stays first, as it draws the tray icon.
     */
    stickers: [
      '01-hi',
      '02-love',
      '03-lol',
      '04-ok',
      '05-no',
      '06-sorry',
      '07-crying',
      '08-shocked',
      '09-thinking',
      '10-celebrate',
      '13-squint',
      '14-blep',
      '15-typing',
      '16-boop',
      '17-sleepy',
      '18-diva',
      '19-hamsi',
      '21-empty-bowl',
      '23-knock-off',
      '24-box-hide',
      '25-belly-up',
      '26-zoomies',
      '28-yuck',
      '33-gift',
      '35-offended',
      '36-wasnt-me',
      '37-shy',
      '39-thanks-en',
      '40-good-morning',
      '42-practise',
    ],
  },
}

/** The WhatsApp identifier for a catalogue pack id, or `undefined` when it has no export. */
export function whatsAppPackFor(cosmeticId: string): string | undefined {
  return WHATSAPP_PACKS[cosmeticId]?.identifier
}

export interface StickerFile {
  /** File name inside the pack's folder, `.webp`. */
  file: string
  emojis: string[]
  bytes: Uint8Array
}

export interface BuiltPack {
  info: WhatsAppPackInfo
  tray: Uint8Array
  stickers: StickerFile[]
  /** Changes whenever any picture changes; WhatsApp refetches the pack when it does. */
  imageDataVersion: string
}

/** Width, height and whether it animates, read from a WebP's RIFF header. */
export function webpInfo(
  bytes: Uint8Array,
): { width: number; height: number; animated: boolean } | null {
  const ascii = (at: number, n: number) => String.fromCharCode(...bytes.subarray(at, at + n))
  if (bytes.length < 30 || ascii(0, 4) !== 'RIFF' || ascii(8, 4) !== 'WEBP') return null
  const chunk = ascii(12, 4)
  const u24 = (at: number) => bytes[at]! | (bytes[at + 1]! << 8) | (bytes[at + 2]! << 16)
  if (chunk === 'VP8X') {
    return {
      animated: (bytes[20]! & 0x02) !== 0,
      width: u24(24) + 1,
      height: u24(27) + 1,
    }
  }
  if (chunk === 'VP8 ') {
    // Lossy: a 3-byte frame tag, the start code, then 14-bit width and height.
    return {
      animated: false,
      width: (bytes[26]! | (bytes[27]! << 8)) & 0x3fff,
      height: (bytes[28]! | (bytes[29]! << 8)) & 0x3fff,
    }
  }
  if (chunk === 'VP8L') {
    // Lossless: a signature byte, then 14-bit width-1 and height-1 packed.
    const b = (i: number) => bytes[21 + i]!
    return {
      animated: false,
      width: 1 + (b(0) | ((b(1) & 0x3f) << 8)),
      height: 1 + ((b(1) >> 6) | (b(2) << 2) | ((b(3) & 0x0f) << 10)),
    }
  }
  return null
}

/** Width and height from a PNG's IHDR, or `null` when it is not a PNG. */
export function pngInfo(bytes: Uint8Array): { width: number; height: number } | null {
  const signature = [0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]
  if (bytes.length < 24 || signature.some((v, i) => bytes[i] !== v)) return null
  const u32 = (at: number) =>
    ((bytes[at]! << 24) | (bytes[at + 1]! << 16) | (bytes[at + 2]! << 8) | bytes[at + 3]!) >>> 0
  return { width: u32(16), height: u32(20) }
}

/**
 * Everything WhatsApp would refuse about a pack, as sentences. Empty means it
 * passes. Static packs only: nothing here animates, and WhatsApp forbids
 * mixing the two in one pack.
 */
export function validatePack(pack: BuiltPack): string[] {
  const L = WHATSAPP_LIMITS
  const problems: string[] = []
  const { info } = pack

  // The Android sample's pattern, `[\w-.,'\s]+`, and no "..".
  if (!/^[\w\-.,'\s]+$/.test(info.identifier) || info.identifier.includes('..')) {
    problems.push(`identifier "${info.identifier}" has characters WhatsApp refuses`)
  }
  for (const [field, value] of [
    ['identifier', info.identifier],
    ['name', info.name],
    ['publisher', info.publisher],
  ] as const) {
    if (value.length === 0) problems.push(`${field} is empty`)
    if (value.length > L.maxChars) problems.push(`${field} is over ${L.maxChars} characters`)
  }
  for (const link of [
    info.publisherWebsite,
    info.privacyPolicyWebsite,
    info.licenseAgreementWebsite,
    STORE_LINKS.ios,
    STORE_LINKS.android,
  ]) {
    if (!/^https?:\/\//.test(link)) problems.push(`link ${link} does not start with http(s)`)
  }

  const tray = pngInfo(pack.tray)
  if (!tray) problems.push('tray icon is not a PNG')
  else if (tray.width !== L.traySide || tray.height !== L.traySide) {
    problems.push(`tray icon is ${tray.width}×${tray.height}, not ${L.traySide}×${L.traySide}`)
  }
  if (pack.tray.length > L.maxTrayBytes) {
    problems.push(`tray icon is ${pack.tray.length} bytes, over ${L.maxTrayBytes}`)
  }

  const n = pack.stickers.length
  if (n < L.minStickers || n > L.maxStickers) {
    problems.push(`${n} stickers; WhatsApp takes ${L.minStickers} to ${L.maxStickers}`)
  }
  const names = new Set<string>()
  for (const s of pack.stickers) {
    if (names.has(s.file)) problems.push(`${s.file} appears twice`)
    names.add(s.file)
    if (!s.file.endsWith('.webp')) problems.push(`${s.file} is not a .webp`)
    if (s.emojis.length < L.minEmojis || s.emojis.length > L.maxEmojis) {
      problems.push(`${s.file} has ${s.emojis.length} emojis; WhatsApp takes 1 to 3`)
    }
    if (s.bytes.length > L.maxStaticStickerBytes) {
      problems.push(`${s.file} is ${s.bytes.length} bytes, over ${L.maxStaticStickerBytes}`)
    }
    const webp = webpInfo(s.bytes)
    if (!webp) problems.push(`${s.file} is not a WebP`)
    else {
      if (webp.width !== L.stickerSide || webp.height !== L.stickerSide) {
        problems.push(`${s.file} is ${webp.width}×${webp.height}, not 512×512`)
      }
      if (webp.animated) problems.push(`${s.file} animates in a static pack`)
    }
  }
  return problems
}

/**
 * `contents.json` as the Android provider serves it: the sample app's own
 * format, so `StickerContentProvider.kt` can be read beside the sample's.
 */
export function androidContents(packs: readonly BuiltPack[]) {
  return {
    android_play_store_link: STORE_LINKS.android,
    ios_app_store_link: STORE_LINKS.ios,
    sticker_packs: packs.map((p) => ({
      identifier: p.info.identifier,
      name: p.info.name,
      publisher: p.info.publisher,
      tray_image_file: TRAY_FILE,
      publisher_website: p.info.publisherWebsite,
      privacy_policy_website: p.info.privacyPolicyWebsite,
      license_agreement_website: p.info.licenseAgreementWebsite,
      image_data_version: p.imageDataVersion,
      stickers: p.stickers.map((s) => ({ image_file: s.file, emojis: s.emojis })),
    })),
  }
}

function base64(bytes: Uint8Array): string {
  let binary = ''
  for (let i = 0; i < bytes.length; i += 0x8000) {
    binary += String.fromCharCode(...bytes.subarray(i, i + 0x8000))
  }
  return btoa(binary)
}

/**
 * The JSON the iOS app puts on the pasteboard under
 * `net.whatsapp.third-party.sticker-pack` before opening
 * `whatsapp://stickerPack` — the structure in the iOS sample's README.
 *
 * Built here, ahead of time, and shipped as a file: Swift reads it and hands
 * the bytes over unchanged, so there is no second implementation of the
 * format to drift, and this one is under test.
 */
export function iosPasteboardPayload(pack: BuiltPack) {
  return {
    ios_app_store_link: STORE_LINKS.ios,
    android_play_store_link: STORE_LINKS.android,
    identifier: pack.info.identifier,
    name: pack.info.name,
    publisher: pack.info.publisher,
    // PNG for the tray, WebP for the stickers: the README is explicit about both.
    tray_image: base64(pack.tray),
    stickers: pack.stickers.map((s) => ({ image_data: base64(s.bytes), emojis: s.emojis })),
  }
}

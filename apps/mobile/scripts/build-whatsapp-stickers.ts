/**
 * Turns a finished sticker set into the files the WhatsApp export ships.
 *
 *   cd <folder holding the set>
 *   npx tsx <repo>/apps/mobile/scripts/build-whatsapp-stickers.ts <set-dir> [--pack stickers.venus]
 *
 * `<set-dir>` must sit below the folder the command runs in. It is read and
 * nothing else is, so the one path the script takes from its arguments is held
 * to where it was started — what CodeQL's path-injection check asks for, and
 * cheap for a script that is only ever run by hand.
 *
 * `<set-dir>` is the folder the sticker generator writes: a `stickers.json`
 * listing `{ file, emoji }` in pack order, and the 512 px transparent PNGs
 * under `png/`. Only drawn art goes through here — the pack is public in the
 * repository and in two stores' binaries.
 *
 * Writes, replacing what was there:
 *   - `modules/whatsapp-stickers/android/src/main/assets/whatsapp-stickers/`
 *     `contents.json` and `<identifier>/` with one `.webp` per sticker and
 *     `tray.png` — what `StickerContentProvider.kt` serves to WhatsApp;
 *   - `modules/whatsapp-stickers/ios/Packs/<identifier>.json` — the
 *     pasteboard payload Swift hands to WhatsApp unchanged.
 *
 * Every picture is re-encoded to WebP at the highest quality that stays under
 * WhatsApp's static limit, and the result is checked with `validatePack` —
 * the same rules `whatsappStickers.test.ts` holds the committed files to — so
 * a run that would produce a pack WhatsApp refuses fails here instead.
 *
 * Needs `cwebp` (libwebp) and ImageMagick's `magick` on the PATH.
 *
 * Re-running it is a native change: the files are inside the binary, so new
 * art reaches people with a store build, not an update.
 */
import { execFileSync } from 'node:child_process'
import { createHash } from 'node:crypto'
import fs from 'node:fs'
import os from 'node:os'
import path from 'node:path'
import { fileURLToPath } from 'node:url'
import {
  ANDROID_ASSET_ROOT,
  androidContents,
  type BuiltPack,
  iosPasteboardPayload,
  type StickerFile,
  TRAY_FILE,
  validatePack,
  WHATSAPP_LIMITS,
  WHATSAPP_PACKS,
} from '../src/lib/whatsappStickers'

const MODULE = fileURLToPath(new URL('../modules/whatsapp-stickers', import.meta.url))
const ANDROID_ASSETS = path.join(MODULE, 'android', 'src', 'main', 'assets', ANDROID_ASSET_ROOT)
const IOS_PACKS = path.join(MODULE, 'ios', 'Packs')

/*
 * Aim under the limit, not at it: WhatsApp counts in KB of 1024 and a file a
 * few bytes over is refused whole. Most stickers land far below anyway —
 * WhatsApp's own are about 15 KB.
 */
const TARGET_BYTES = WHATSAPP_LIMITS.maxStaticStickerBytes - 4 * 1024
const QUALITIES = [90, 85, 80, 75, 70, 60, 50, 40]

interface SetEntry {
  file: string
  emoji?: string
  emojis?: string[]
}

function arg(name: string): string | undefined {
  const i = process.argv.indexOf(name)
  return i > 0 ? process.argv[i + 1] : undefined
}

function toWebp(png: string, tmp: string): Uint8Array {
  for (const q of QUALITIES) {
    const out = path.join(tmp, `q${q}.webp`)
    execFileSync('cwebp', [
      '-quiet',
      '-q',
      String(q),
      '-alpha_q',
      '100',
      '-m',
      '6',
      '-metadata',
      'none',
      '-resize',
      String(WHATSAPP_LIMITS.stickerSide),
      String(WHATSAPP_LIMITS.stickerSide),
      png,
      '-o',
      out,
    ])
    const bytes = new Uint8Array(fs.readFileSync(out))
    if (bytes.length <= TARGET_BYTES) return bytes
  }
  throw new Error(`${png} stays over ${TARGET_BYTES} bytes even at quality ${QUALITIES.at(-1)}`)
}

function toTray(png: string, tmp: string): Uint8Array {
  const out = path.join(tmp, TRAY_FILE)
  const side = String(WHATSAPP_LIMITS.traySide)
  execFileSync('magick', [png, '-resize', `${side}x${side}`, '-strip', `PNG32:${out}`])
  return new Uint8Array(fs.readFileSync(out))
}

function main(): void {
  const setArg = process.argv[2]
  const cosmeticId = arg('--pack') ?? 'stickers.venus'
  const info = WHATSAPP_PACKS[cosmeticId]
  if (!setArg || setArg.startsWith('--')) {
    throw new Error('usage: build-whatsapp-stickers.ts <set-dir> [--pack stickers.venus]')
  }
  if (!info) throw new Error(`${cosmeticId} is not in WHATSAPP_PACKS`)

  const root = path.resolve(process.cwd())
  const setDir = path.resolve(root, setArg)
  if (!setDir.startsWith(root + path.sep)) {
    throw new Error(`${setArg} is outside ${root}: run this from the folder that holds the set`)
  }

  const listing = path.join(setDir, 'stickers.json')
  if (!fs.existsSync(listing))
    throw new Error(`${listing} is missing: it gives the order and emojis`)
  const entries = JSON.parse(fs.readFileSync(listing, 'utf8')) as SetEntry[]
  const pngDir = fs.existsSync(path.join(setDir, 'png')) ? path.join(setDir, 'png') : setDir

  const tmp = fs.mkdtempSync(path.join(os.tmpdir(), 'wa-stickers-'))
  try {
    const stickers: StickerFile[] = entries.map((e) => ({
      file: e.file.replace(/\.png$/i, '.webp'),
      emojis: e.emojis ?? (e.emoji ? [e.emoji] : []),
      bytes: toWebp(path.join(pngDir, e.file), tmp),
    }))
    // The first sticker is the pack's face in WhatsApp's tray, as it is the
    // cover in the store.
    const tray = toTray(path.join(pngDir, entries[0]!.file), tmp)

    const hash = createHash('sha256').update(tray)
    for (const s of stickers) hash.update(s.file).update(s.emojis.join(',')).update(s.bytes)
    const pack: BuiltPack = {
      info,
      tray,
      stickers,
      imageDataVersion: hash.digest('hex').slice(0, 12),
    }

    const problems = validatePack(pack)
    if (problems.length > 0)
      throw new Error(`WhatsApp would refuse this pack:\n- ${problems.join('\n- ')}`)

    const packDir = path.join(ANDROID_ASSETS, info.identifier)
    fs.rmSync(packDir, { recursive: true, force: true })
    fs.mkdirSync(packDir, { recursive: true })
    fs.writeFileSync(path.join(packDir, TRAY_FILE), tray)
    for (const s of stickers) fs.writeFileSync(path.join(packDir, s.file), s.bytes)
    // One pack today. A second one means listing both here.
    fs.writeFileSync(
      path.join(ANDROID_ASSETS, 'contents.json'),
      `${JSON.stringify(androidContents([pack]), null, 2)}\n`,
    )

    fs.mkdirSync(IOS_PACKS, { recursive: true })
    fs.writeFileSync(
      path.join(IOS_PACKS, `${info.identifier}.json`),
      JSON.stringify(iosPasteboardPayload(pack)),
    )

    const total = stickers.reduce((n, s) => n + s.bytes.length, 0)
    const largest = Math.max(...stickers.map((s) => s.bytes.length))
    console.log(
      `${info.identifier}: ${stickers.length} stickers, ${(total / 1024).toFixed(0)} KB, ` +
        `largest ${(largest / 1024).toFixed(1)} KB, tray ${(tray.length / 1024).toFixed(1)} KB, ` +
        `version ${pack.imageDataVersion}`,
    )
  } finally {
    fs.rmSync(tmp, { recursive: true, force: true })
  }
}

main()

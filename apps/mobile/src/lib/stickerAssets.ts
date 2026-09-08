/**
 * Sticker id to bundled picture.
 *
 * A literal map, not a computed `require(...)`: Metro resolves asset paths at
 * build time, so a path built from a variable resolves to nothing — the file
 * is simply not in the bundle, and the failure is an empty square on a device
 * rather than an error anywhere a test would see it.
 *
 * `stickerAssets.test.ts` checks this against `COSMETICS`, because an id with
 * no entry here and an entry with no id in the catalogue are both invisible to
 * the compiler.
 */
import book from '../../assets/stickers/starter/book.svg'
import bulb from '../../assets/stickers/starter/bulb.svg'
import clock from '../../assets/stickers/starter/clock.svg'
import confused from '../../assets/stickers/starter/confused.svg'
import correct from '../../assets/stickers/starter/correct.svg'
import heart from '../../assets/stickers/starter/heart.svg'
import listen from '../../assets/stickers/starter/listen.svg'
import party from '../../assets/stickers/starter/party.svg'
import pronounce from '../../assets/stickers/starter/pronounce.svg'
import sparkles from '../../assets/stickers/starter/sparkles.svg'
import thinking from '../../assets/stickers/starter/thinking.svg'
import wave from '../../assets/stickers/starter/wave.svg'

export const STICKER_ASSETS: Record<string, Record<string, number>> = {
  'stickers.starter': {
    book,
    bulb,
    clock,
    confused,
    correct,
    heart,
    listen,
    party,
    pronounce,
    sparkles,
    thinking,
    wave,
  },
}

export function stickerAsset(packId: string, stickerId: string): number | undefined {
  return STICKER_ASSETS[packId]?.[stickerId]
}

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
import again from '../../assets/stickers/practice/again.svg'
import bullseye from '../../assets/stickers/practice/bullseye.svg'
import hourglass from '../../assets/stickers/practice/hourglass.svg'
import practiceThinking from '../../assets/stickers/practice/thinking.svg'
import rocket from '../../assets/stickers/practice/rocket.svg'
import slower from '../../assets/stickers/practice/slower.svg'
import sprout from '../../assets/stickers/practice/sprout.svg'
import star from '../../assets/stickers/practice/star.svg'
import steps from '../../assets/stickers/practice/steps.svg'
import summit from '../../assets/stickers/practice/summit.svg'
import swap from '../../assets/stickers/practice/swap.svg'
import trophy from '../../assets/stickers/practice/trophy.svg'
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
  'stickers.practice': {
    again,
    bullseye,
    hourglass,
    rocket,
    slower,
    sprout,
    star,
    steps,
    summit,
    swap,
    // Renamed on import only: `starter` has a `thinking` too, and two default
    // imports cannot share a binding.
    thinking: practiceThinking,
    trophy,
  },
}

export function stickerAsset(packId: string, stickerId: string): number | undefined {
  return STICKER_ASSETS[packId]?.[stickerId]
}

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
import type { MessageKey } from '../i18n/runtime'
import paperBook from '../../assets/stickers/paper/book.svg'
import cafe from '../../assets/stickers/paper/cafe.svg'
import cay from '../../assets/stickers/paper/cay.svg'
import crane from '../../assets/stickers/paper/crane.svg'
import fixed from '../../assets/stickers/paper/fixed.svg'
import gotit from '../../assets/stickers/paper/gotit.svg'
import hola from '../../assets/stickers/paper/hola.svg'
import merci from '../../assets/stickers/paper/merci.svg'
import nice from '../../assets/stickers/paper/nice.svg'
import night from '../../assets/stickers/paper/night.svg'
import onesec from '../../assets/stickers/paper/onesec.svg'
import sent from '../../assets/stickers/paper/sent.svg'
import checkpoint from '../../assets/stickers/pixel/checkpoint.svg'
import coin from '../../assets/stickers/pixel/coin.svg'
import controller from '../../assets/stickers/pixel/controller.svg'
import flame from '../../assets/stickers/pixel/flame.svg'
import ghost from '../../assets/stickers/pixel/ghost.svg'
import key from '../../assets/stickers/pixel/key.svg'
import levelup from '../../assets/stickers/pixel/levelup.svg'
import potion from '../../assets/stickers/pixel/potion.svg'
import save from '../../assets/stickers/pixel/save.svg'
import shield from '../../assets/stickers/pixel/shield.svg'
import slime from '../../assets/stickers/pixel/slime.svg'
import thumb from '../../assets/stickers/pixel/thumb.svg'
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
  'stickers.paper': {
    // Renamed on import only, as `thinking` is below: `starter` has a `book`.
    book: paperBook,
    cafe,
    cay,
    crane,
    fixed,
    gotit,
    hola,
    merci,
    nice,
    night,
    onesec,
    sent,
  },
  'stickers.pixel': {
    checkpoint,
    coin,
    controller,
    flame,
    ghost,
    key,
    levelup,
    potion,
    save,
    shield,
    slime,
    thumb,
  },
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

/** `stickers.paper` → `Paper`: the pack's half of its message keys. */
function packTier(packId: string): string {
  const tier = packId.split('.')[1] ?? ''
  return tier.charAt(0).toUpperCase() + tier.slice(1)
}

/**
 * A sticker's name, for a screen reader and the pack page: `stickerName.paperHola`.
 *
 * Built, not listed, so `stickerAssets.test.ts` checks every id in the
 * catalogue has one — a missing key would otherwise read the key aloud.
 */
export function stickerNameKey(packId: string, stickerId: string): MessageKey {
  const tier = packTier(packId)
  return `stickerName.${tier.charAt(0).toLowerCase()}${tier.slice(1)}${stickerId.charAt(0).toUpperCase()}${stickerId.slice(1)}` as MessageKey
}

/** The line under a pack's name on its page: `stickerPack.taglinePaper`. */
export function packTaglineKey(packId: string): MessageKey {
  return `stickerPack.tagline${packTier(packId)}` as MessageKey
}

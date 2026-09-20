/**
 * A badge's picture name to the bundled file.
 *
 * A literal map, not a computed `require(...)`: Metro resolves asset paths at
 * build time, so a path built from `badge.icon` resolves to nothing — the file
 * is simply not in the bundle, and the failure is an empty square on a device
 * rather than an error anywhere a test would see it. `stickerAssets.ts` is the
 * same shape for the same reason.
 *
 * The pictures are Fluent UI Emoji's **flat** set, which is what the sticker
 * packs already ship and the licence beside them already covers. Flat rather
 * than colour: Android decodes SVG through `androidsvg`, which supports
 * neither gradients nor filters, and the colour set is built from both.
 *
 * `badgeArt.test.ts` checks this against `BADGES`, because a badge with no
 * picture and a picture no badge names are both invisible to the compiler.
 */
import books from '../../assets/badges/books.svg'
import brain from '../../assets/badges/brain.svg'
import cake from '../../assets/badges/cake.svg'
import candle from '../../assets/badges/candle.svg'
import coin from '../../assets/badges/coin.svg'
import comet from '../../assets/badges/comet.svg'
import crown from '../../assets/badges/crown.svg'
import fire from '../../assets/badges/fire.svg'
import fireworks from '../../assets/badges/fireworks.svg'
import fountainPen from '../../assets/badges/fountain-pen.svg'
import gem from '../../assets/badges/gem.svg'
import globe from '../../assets/badges/globe.svg'
import graduationCap from '../../assets/badges/graduation-cap.svg'
import medal from '../../assets/badges/medal.svg'
import megaphone from '../../assets/badges/megaphone.svg'
import memo from '../../assets/badges/memo.svg'
import moneyBag from '../../assets/badges/money-bag.svg'
import owl from '../../assets/badges/owl.svg'
import pencil from '../../assets/badges/pencil.svg'
import seedling from '../../assets/badges/seedling.svg'
import speakingHead from '../../assets/badges/speaking-head.svg'
import speechBalloon from '../../assets/badges/speech-balloon.svg'
import sparkler from '../../assets/badges/sparkler.svg'
import sun from '../../assets/badges/sun.svg'
import volcano from '../../assets/badges/volcano.svg'

export const BADGE_ART: Record<string, number> = {
  books,
  brain,
  cake,
  candle,
  coin,
  comet,
  crown,
  fire,
  fireworks,
  'fountain-pen': fountainPen,
  gem,
  globe,
  'graduation-cap': graduationCap,
  medal,
  megaphone,
  memo,
  'money-bag': moneyBag,
  owl,
  pencil,
  seedling,
  'speaking-head': speakingHead,
  'speech-balloon': speechBalloon,
  sparkler,
  sun,
  volcano,
}

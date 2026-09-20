/**
 * A badge's **id** to the bundled file it wears.
 *
 * Keyed by id, and that is the load-bearing part. The pictures first shipped
 * keyed by `BadgeDefinition.icon`, with the names written into the catalogue —
 * and `icon` travels in the API's DTO, so the deploy put `candle` in front of
 * every app that had not yet taken the update, which asked a vector font for
 * it and drew the font's missing-glyph box. A shelf of question marks, on
 * builds an over-the-air update cannot always reach. An id is different in
 * kind: it is already the name of the badge itself, it never changes, and a
 * build that does not know one simply has no picture for it — see `BadgeMark`,
 * which leaves the space rather than inventing a mark.
 *
 * A literal map, not a computed `require(...)`: Metro resolves asset paths at
 * build time, so a path built from a string resolves to nothing — the file is
 * simply not in the bundle, and the failure is an empty square on a device
 * rather than an error anywhere a test would see it. `stickerAssets.ts` is the
 * same shape for the same reason.
 *
 * **A ladder's pictures are one idea getting bigger** rather than seven
 * unrelated marks: a candle becomes a bonfire becomes the sun, a pencil
 * becomes a library becomes an owl. A stranger reads the kind from any one of
 * them without being taught the scale, and somebody who has climbed two rungs
 * can see that they climbed — which is the part a shared glyph could not say
 * and the number in the label had to.
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
  'origin.v1': seedling,

  'streak.7': candle,
  'streak.30': fire,
  'streak.100': sparkler,
  'streak.180': fireworks,
  'streak.365': comet,
  'streak.730': volcano,
  'streak.1095': sun,

  'correction.1': pencil,
  'correction.10': memo,
  'correction.100': fountainPen,
  'correction.1000': books,
  'correction.5000': graduationCap,
  'correction.10000': brain,
  'correction.25000': owl,

  'messages.100': speechBalloon,
  'messages.1000': speakingHead,
  'messages.10000': megaphone,
  'messages.50000': globe,

  'tokens.10000': coin,
  'tokens.50000': moneyBag,
  'tokens.250000': gem,

  'veteran.365': cake,
  'veteran.730': medal,
  'veteran.1095': crown,
}

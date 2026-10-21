import { z } from 'zod'
import type { PaidPlanTier } from './limits'

/**
 * The only things token can buy, besides a streak freeze.
 *
 * Deliberately cosmetic and nothing else: the moment token can buy a Pro
 * capability, farming token becomes a substitute for paying, and the
 * subscription is the thing that funds the app. Prices live here, in public,
 * because the enforcement is a server-side atomic balance check — not secrecy.
 */
export const COSMETIC_KINDS = ['frame', 'title', 'stickers'] as const
export type CosmeticKind = (typeof COSMETIC_KINDS)[number]

/**
 * A frame's colour, as a **role** rather than a value.
 *
 * `packages/shared` cannot import the theme — and must not, since the same
 * frame has to read on a white background and a dark one. The mobile side maps
 * these through `frameColors`, which is the only place a hex lives.
 */
export const COSMETIC_TONES = [
  'slate',
  'bronze',
  'silver',
  'gold',
  'sky',
  'mint',
  'ember',
  'violet',
  'midnight',
  'aurora',
  // The six rungs the v3 art drew between today's. Appended rather than
  // interleaved: this list is a set of roles, not the ladder, and the order
  // here means nothing.
  'blush',
  'moss',
  'indigo',
  'plum',
  'vermilion',
  'walnut',
] as const
export type CosmeticTone = (typeof COSMETIC_TONES)[number]

/**
 * A condition beyond the price.
 *
 * Both fields are **monotonic** — a longest streak and a lifetime count — and
 * that is required rather than incidental: the purchase re-checks what it can
 * inside the atomic update, and a gate that could go down would let an item be
 * owned and then un-ownable.
 */
export interface CosmeticRequirement {
  longestStreak?: number
  corrections?: number
}

export interface Cosmetic {
  id: string
  kind: CosmeticKind
  /** Shown to the user; the client is free to localise by `id`. */
  label: string
  price: number
  /** Frames only. */
  tone?: CosmeticTone
  requires?: CosmeticRequirement
  /**
   * Sticker packs only: the ids in the pack, matching the file names under
   * `apps/mobile/assets/stickers/<pack>/`.
   *
   * A test asserts the two agree. Nothing else can: an id with no file draws
   * an empty bubble, and a file with no id is art nobody can send, and the
   * compiler sees neither.
   */
  stickers?: readonly string[]
}

/**
 * The catalogue, and the only sink the economy has.
 *
 * Prices were raised across the board when this grew. The old six totalled
 * 21,000 — about thirty days for somebody earning well — so a committed user
 * bought the shop out in a month and token stopped having anywhere to go. The
 * ladder below totalled about 393,000, roughly 560 days at the same rate, and
 * about 470,000 once the six art frames were inserted: aspirational without
 * being decorative.
 *
 * It fixes a v1 problem on the way. The largest v1 balance converts to 22,800
 * token; at the old prices a returning user cleared almost the whole
 * catalogue on their first day.
 *
 * **The order of this array is a rule, not a layout.** Each item can only be
 * bought once the one before it in the same `kind` is owned, or any rung above
 * that one — see `ladderOpen` — so inserting a row in the middle inserts a rung, and
 * reordering two rows swaps what has to be earned first. It used to be free to
 * shuffle these; it is not any more. `rules.test.ts` asserts each kind is
 * strictly ascending in price, which is what keeps the ladder and the prices
 * from telling different stories.
 */
export const COSMETICS: readonly Cosmetic[] = [
  /*
   * The labels are the art's names. The ids and tones are not renamed, and
   * must not be: an id is what `profiles.cosmetics` stores, and a tone is what
   * an older client draws when it has no art for a frame — so `frame.slate`
   * stays slate even though it is drawn as cut paper.
   *
   * The six rungs added with the art (washi, lino, indigo, mosaic, seal,
   * marquetry) sit between the old ones by price, which is where the art
   * sheet draws them. See `ladderOpen` for why inserting them strands nobody.
   */
  { id: 'frame.slate', kind: 'frame', label: 'Papel Picado', price: 1000, tone: 'slate' },
  { id: 'frame.washi', kind: 'frame', label: 'Washi Tape', price: 1750, tone: 'blush' },
  { id: 'frame.bronze', kind: 'frame', label: 'Running Stitch', price: 2500, tone: 'bronze' },
  { id: 'frame.lino', kind: 'frame', label: 'Linocut', price: 3250, tone: 'moss' },
  { id: 'frame.sky', kind: 'frame', label: 'Woven Reed', price: 4000, tone: 'sky' },
  { id: 'frame.silver', kind: 'frame', label: 'Origami Fold', price: 6000, tone: 'silver' },
  { id: 'frame.indigo', kind: 'frame', label: 'Indigo Dye', price: 7500, tone: 'indigo' },
  { id: 'frame.mint', kind: 'frame', label: 'Enamel Pin', price: 9000, tone: 'mint' },
  { id: 'frame.mosaic', kind: 'frame', label: 'Mosaic', price: 11_000, tone: 'plum' },
  { id: 'frame.ember', kind: 'frame', label: 'Iznik Tile', price: 13_000, tone: 'ember' },
  { id: 'frame.gold', kind: 'frame', label: 'Khokhloma', price: 18_000, tone: 'gold' },
  { id: 'frame.seal', kind: 'frame', label: 'Seal and Fret', price: 21_500, tone: 'vermilion' },
  { id: 'frame.violet', kind: 'frame', label: 'Qalam', price: 25_000, tone: 'violet' },
  { id: 'frame.marquetry', kind: 'frame', label: 'Marquetry', price: 30_000, tone: 'walnut' },
  { id: 'frame.midnight', kind: 'frame', label: 'Night Hoop', price: 35_000, tone: 'midnight' },
  /**
   * The one nobody can simply save up for.
   *
   * A year without missing a day *and* five thousand corrections written — the
   * top rung of `TOKEN_RULES.streakMilestones` and of the correction badge
   * thresholds, so the shop and the badge screen tell one story. v1's longest
   * streak ever was 446 days, which is what makes the first half real.
   *
   * Price and gate agree by construction: 5,000 corrections is 50,000 token
   * earned on its own, so anybody who qualifies can already afford it. The
   * gate decides *who*, the price decides *when*.
   */
  {
    id: 'frame.aurora',
    kind: 'frame',
    label: 'Aurora Glass',
    price: 50_000,
    tone: 'aurora',
    requires: { longestStreak: 365, corrections: 5000 },
  },
  { id: 'title.beginner', kind: 'title', label: 'Beginner', price: 1500 },
  { id: 'title.learner', kind: 'title', label: 'Learner', price: 3000 },
  { id: 'title.helper', kind: 'title', label: 'Helper', price: 5000 },
  { id: 'title.tutor', kind: 'title', label: 'Tutor', price: 8000 },
  { id: 'title.mentor', kind: 'title', label: 'Mentor', price: 12_000 },
  { id: 'title.linguist', kind: 'title', label: 'Linguist', price: 15_000 },
  { id: 'title.polyglot', kind: 'title', label: 'Polyglot', price: 17_000 },
  { id: 'title.scholar', kind: 'title', label: 'Scholar', price: 20_000 },
  { id: 'title.master', kind: 'title', label: 'Master', price: 50_000 },
  { id: 'title.legend', kind: 'title', label: 'Legend', price: 100_000 },
  /**
   * The starter pack: Pip, a speech bubble with a face, saying the everyday
   * things — hello, I am listening, I get it, thank you.
   *
   * Priced at the bottom of the frame ladder rather than beside it: a pack is
   * something you use in every conversation, and pricing the first one out of
   * a new account's reach would mean nobody ever finds out stickers exist.
   *
   * Redrawn for v3, so all twelve are ours. Until then half of this pack and
   * half of `practice` were Microsoft's Fluent Emoji; the ids are unchanged, so
   * a message sent before the redraw shows the new picture.
   */
  /**
   * The second pack, and the one that proves packs are not a ladder: it is
   * priced the same as the first because neither is a rung above the other,
   * and somebody who wants this one should not have to buy that one first.
   *
   * Where `starter` is what you say *in* a conversation, these are about the
   * practice itself — slow down, again, let us switch languages, we got there —
   * drawn as embroidered felt merit badges.
   *
   * **1,000, though it is now all our own art.** Every pack drawn whole was
   * priced at 1,500, and the v3 redraw made this one of them. It stays at
   * 1,000 because `starter` and `practice` are the two entry packs: the price
   * somebody new can reach first, in either flavour. Changing it would also
   * change what the token site and the docs promise.
   */
  {
    id: 'stickers.practice',
    kind: 'stickers',
    label: 'Practice stickers',
    price: 1000,
    stickers: [
      'slower',
      'again',
      'swap',
      'sprout',
      'steps',
      'summit',
      'rocket',
      'trophy',
      'star',
      'thinking',
      'hourglass',
      'bullseye',
    ],
  },
  {
    id: 'stickers.starter',
    kind: 'stickers',
    label: 'Starter stickers',
    price: 1000,
    stickers: [
      'wave',
      'listen',
      'thinking',
      'correct',
      'pronounce',
      'confused',
      'book',
      'bulb',
      'clock',
      'heart',
      'party',
      'sparkles',
    ],
  },
  /**
   * The third pack, and the first drawn in a different language: twelve
   * symbols in an 8-bit game's vocabulary — an extra life, a checkpoint, a
   * save, a level up — on sixteen-by-sixteen grids, drawn as fuse beads.
   *
   * **All twelve are ours.** The art is generated from
   * `tools/pixel-stickers/build-stickers.mjs`, where each sticker is a grid of
   * characters; edit that and re-run it rather than editing the SVGs. The
   * sticker `coin` is drawn as a heart since the v3 redraw and keeps its id,
   * because sent messages store it.
   *
   * **Dearer than the two entry packs, and still not a rung above them.**
   * `isLadderKind` leaves stickers out, so `previousCosmetic` returns nothing
   * for every pack and this one can be bought first, alone, or never. A reader
   * who finds 1,000/1,000/1,500 in the shop and reads a ladder into it is
   * reading something that is not there.
   */
  {
    id: 'stickers.pixel',
    kind: 'stickers',
    label: 'Pixel stickers',
    price: 1500,
    stickers: [
      'levelup',
      'coin',
      'checkpoint',
      'flame',
      'key',
      'save',
      'potion',
      'shield',
      'thumb',
      'controller',
      'slime',
      'ghost',
    ],
  },
  /**
   * The fourth pack, and the first with words on it: greetings and quick
   * replies paired with everyday things, cut from coloured paper — "¡Hola!"
   * on a speech bubble, "Çay?" on a tea glass, "Fixed it" on a pencil.
   *
   * Drawn for the v3 store (the board "Sticker pack"), so all twelve are ours
   * and the pack adds no licence. The lettering is outlined into paths, not
   * set as SVG `<text>`, so no device needs Nunito to draw it.
   *
   * 1,500, as pixel is; 1,000 is kept for the two entry packs. Still not a
   * rung — `isLadderKind` leaves stickers out.
   */
  {
    id: 'stickers.paper',
    kind: 'stickers',
    label: 'Paper Talk',
    price: 1500,
    stickers: [
      'hola',
      'crane',
      'nice',
      'gotit',
      'cafe',
      'cay',
      'sent',
      'merci',
      'onesec',
      'book',
      'fixed',
      'night',
    ],
  },
]

/** Progress against a gate: what the client draws and the server checks. */
export interface CosmeticProgress {
  longestStreak: number
  corrections: number
}

/** Whether a gate is met. No requirement is not a failed one. */
export function meetsRequirement(
  requires: CosmeticRequirement | undefined,
  progress: CosmeticProgress,
): boolean {
  if (!requires) return true
  if (requires.longestStreak !== undefined && progress.longestStreak < requires.longestStreak) {
    return false
  }
  if (requires.corrections !== undefined && progress.corrections < requires.corrections) {
    return false
  }
  return true
}

export function findCosmetic(id: string): Cosmetic | undefined {
  return COSMETICS.find((c) => c.id === id)
}

/**
 * The rung below this one, or nothing if it is the first.
 *
 * Frames and titles are two ladders, not one list, so "the one before" is
 * scoped to the kind — buying a frame has never had anything to do with
 * owning a title and still does not.
 *
 * Derived from the array rather than from the price, even though the two
 * agree and a test says so. A price comparison would quietly turn two items
 * priced the same into an unbuyable pair, and it would make a repricing
 * silently reorder what has to be earned first. The order is the rule; the
 * prices are how it is explained.
 */
/**
 * Whether a kind is climbed or merely shopped.
 *
 * Frames and titles are ranks: the order is the rule, the prices explain it,
 * and each one is earned by owning the one below. A sticker pack is content —
 * making somebody buy the cats before the flowers would be an order with
 * nothing behind it — so packs are bought in any order and at any time.
 *
 * Named rather than inlined because three things have to agree about it: the
 * purchase gate, the shop's layout, and the test that keeps prices climbing.
 */
export function isLadderKind(kind: CosmeticKind): boolean {
  return kind !== 'stickers'
}

/**
 * The kinds you can be wearing.
 *
 * A frame and a title are worn one at a time, so owning a second changes
 * nothing until it is chosen — that choice is `equipped`. A sticker pack is
 * not worn: owning it opens its keyboard, and owning two opens both. There is
 * nothing to select, which is why `equippedSchema` does not list it.
 */
export const EQUIPPABLE_KINDS = ['frame', 'title'] as const
export type EquippableKind = (typeof EQUIPPABLE_KINDS)[number]

export function previousCosmetic(cosmetic: Cosmetic): Cosmetic | undefined {
  if (!isLadderKind(cosmetic.kind)) return undefined
  const ladder = COSMETICS.filter((c) => c.kind === cosmetic.kind)
  const index = ladder.findIndex((c) => c.id === cosmetic.id)
  return index > 0 ? ladder[index - 1] : undefined
}

/**
 * The ids any one of which opens this rung: the rung below it, and every rung
 * above that one except this one itself. Empty when nothing is below.
 *
 * **Owning any frame above a rung counts as owning that rung.** The rule
 * arrived with six rungs inserted between existing ones: without it,
 * somebody who already owns Woven Reed would find Linocut, the new rung under
 * it, locked behind the Running Stitch they never bought. Owning something
 * dearer is proof enough of having climbed that far, and nothing above it is
 * reachable for less than the rung costs — so the rule hands nobody a
 * shortcut, it only stops an insertion from stranding people.
 *
 * It also means a gift above a rung (the Pro welcome pack names its frames by
 * id) keeps opening the rungs around it, however many are inserted later.
 *
 * A list rather than a yes/no so the server can put it in its atomic filter
 * as `$in` — the read and the write ask the same question.
 */
export function ladderOpeners(cosmetic: Cosmetic): readonly string[] {
  const previous = previousCosmetic(cosmetic)
  if (!previous) return []
  const ladder = COSMETICS.filter((c) => c.kind === cosmetic.kind)
  const from = ladder.findIndex((c) => c.id === previous.id)
  return ladder
    .slice(from)
    .filter((c) => c.id !== cosmetic.id)
    .map((c) => c.id)
}

/** Whether the ladder lets `owned` buy this rung (see `ladderOpeners`). */
export function ladderOpen(cosmetic: Cosmetic, owned: readonly string[]): boolean {
  const openers = ladderOpeners(cosmetic)
  return openers.length === 0 || openers.some((id) => owned.includes(id))
}

/**
 * What subscribing includes, once, per tier.
 *
 * **Items, not token.** Granting token for money is the one thing every public
 * claim about this economy rules out — `token-messaging-brief.md` says "there
 * is no way to buy tokens, with money or anything else", the in-app disclaimer
 * says it, and `legal/promise-change.md` says it in a document not yet
 * published. Handing out the things token buys keeps all three true.
 *
 * It also keeps the leaderboard honest, which a token grant could not: a
 * balance is `tokenAggregates.all` minus spending, and that aggregate is
 * exactly what the all-time table ranks. There is no way to credit a balance
 * without moving somebody up a table other people are climbing by writing
 * corrections.
 *
 * Nothing here is Pro-only in itself — every item is buyable with token by
 * anyone. Subscribing skips the saving, it does not unlock a shelf.
 */
export interface WelcomePack {
  cosmetics: readonly string[]
  streakFreezes: number
}

/**
 * The **first** rungs of each ladder, not a handful picked from up it.
 *
 * These used to be `frame.bronze` and `frame.bronze/silver/gold` — the 2nd,
 * 4th and 7th frames, plus the 2nd title. That was fine while the catalogue
 * was a shelf. Now that it is a ladder it would have handed somebody the
 * rungs above ones they did not own, which is either incoherent or a debt,
 * depending on how strictly the gate is read.
 *
 * Starting at the bottom makes the two possible readings of the gate — "own
 * the one below" and "own everything below" — the same rule, by induction.
 * There is only one sentence to explain: you buy them in order.
 *
 * Since the art frames were inserted between rungs, these four are no longer
 * the first four: Washi Tape and Linocut sit between them. The ids were kept
 * on purpose — the pack is named by id so that inserting rungs does not change
 * what it grants — and `ladderOpen` keeps every rung up to and just past the
 * pack's top open to whoever holds it.
 *
 * Existing subscribers keep what they were given; `welcomePackAt` latches per
 * tier and is never re-run. They are the reason the gate is written as *own
 * the one below* rather than *own everything below*: somebody holding gold
 * without silver must still be able to move, and asking them to go back and
 * buy the rungs under a gift would turn a gift into a bill.
 */
export const PRO_WELCOME_PACKS: Readonly<Record<PaidPlanTier, WelcomePack>> = {
  /**
   * What Polyglot's pack was. Fluent's was the first two frames; an ex-Fluent
   * subscriber is handed the difference once by `scripts/merge-pro-tiers.ts`,
   * with no freezes, since they already had those.
   */
  pro: {
    cosmetics: [
      'frame.slate',
      'frame.bronze',
      'frame.sky',
      'frame.silver',
      'title.beginner',
      'title.learner',
    ],
    streakFreezes: 2,
  },
}

/**
 * What a tier's pack adds on top of one already granted.
 *
 * Somebody who had the old, smaller Fluent pack should be handed the
 * difference, not the whole thing again; re-subscribing should hand over
 * nothing. Both fall out of "grant what this tier includes and you do not already own",
 * which is also why the caller can be idempotent without a second latch per
 * item.
 */
export function welcomePackDelta(tier: PaidPlanTier, owned: readonly string[]): readonly string[] {
  const ownedSet = new Set(owned)
  return PRO_WELCOME_PACKS[tier].cosmetics.filter((id) => !ownedSet.has(id))
}

/** Everything token can be spent on: the freeze plus the cosmetics catalogue. */
export const STREAK_FREEZE_SKU = 'streakFreeze'

export const purchaseSchema = z.object({
  /** `streakFreeze`, or a cosmetic id from `COSMETICS`. */
  sku: z.string().trim().min(1),
})
export type PurchaseInput = z.infer<typeof purchaseSchema>

/**
 * Which cosmetic is *worn*, as opposed to owned.
 *
 * Ownership is a set; this is the choice. Without it a second frame is a
 * purchase that changes nothing, which makes the catalogue above pointless
 * past the first item.
 */
export const equippedSchema = z.object({ frame: z.string(), title: z.string() }).partial()
export type Equipped = z.infer<typeof equippedSchema>

/**
 * What to draw when nothing has been chosen: the most expensive owned item of
 * that kind.
 *
 * So somebody who bought a frame before choosing was a thing still sees it,
 * and a first purchase is visible without a second step. An explicit choice
 * overrides it.
 */
export function defaultEquipped(owned: readonly string[], kind: CosmeticKind): string | undefined {
  return COSMETICS.filter((c) => c.kind === kind && owned.includes(c.id)).sort(
    (a, b) => b.price - a.price,
  )[0]?.id
}

/** What is actually drawn: the explicit choice, or the fallback above. */
export function wornCosmetic(
  equipped: Equipped | undefined,
  owned: readonly string[],
  kind: CosmeticKind,
): Cosmetic | undefined {
  const chosen = kind === 'frame' ? equipped?.frame : equipped?.title
  // A chosen id that is not owned is never drawn. The server refuses to write
  // one, but a stale client or an older document must not paint it either.
  const id = chosen && owned.includes(chosen) ? chosen : defaultEquipped(owned, kind)
  return id ? findCosmetic(id) : undefined
}

/**
 * The tone to draw around somebody's face: the worn frame's, or — when what
 * they wear or own is a frame this build's catalogue has never heard of — a
 * string no tone matches, which the app draws as a plain ink ring.
 *
 * The catalogue reaches a client by OTA and the purchases by the API, and the
 * API deploys first: an account can wear a frame bought on a newer build
 * before this one knows its id. `wornCosmetic` finds nothing for that id and
 * would draw no frame at all, which reads as having lost something paid for.
 * A ring in ink still says "this person wears a frame".
 */
export function wornFrameTone(
  equipped: Equipped | undefined,
  owned: readonly string[],
): string | undefined {
  const worn = wornCosmetic(equipped, owned, 'frame')
  if (worn?.tone) return worn.tone
  const chosen = equipped?.frame
  const unknown =
    (chosen && owned.includes(chosen) && !findCosmetic(chosen)) ||
    owned.some((id) => id.startsWith('frame.') && !findCosmetic(id))
  return unknown ? UNKNOWN_FRAME_TONE : undefined
}

/** Not a tone, on purpose: see `wornFrameTone`. */
export const UNKNOWN_FRAME_TONE = 'unknown'

export const walletSchema = z.object({
  /** All-time token earned. Never decreases — it is what the leaderboard ranks. */
  earned: z.number().int(),
  /** All-time token spent. */
  spent: z.number().int(),
  /** `earned - spent`, what a purchase can draw on. */
  balance: z.number().int(),
  /** Banked streak freezes, consumed automatically when a single day is missed. */
  streakFreezes: z.number().int(),
  owned: z.array(z.string()),
  equipped: equippedSchema.optional(),
  /**
   * The hourly gift: when the next one can be opened, or `null` when it can be
   * opened now. Carried on the wallet so the store needs no second request.
   */
  gift: z.object({ nextAt: z.string().datetime().nullable() }),
})
export type Wallet = z.infer<typeof walletSchema>

/** `POST /me/wallet/gift` */
export const giftClaimSchema = z.object({
  /** What the gift held. Zero is a real outcome, not an error. */
  amount: z.number().int().nonnegative(),
  nextAt: z.string().datetime(),
  wallet: walletSchema,
})
export type GiftClaim = z.infer<typeof giftClaimSchema>

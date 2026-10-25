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
import marginCaret from '../../assets/stickers/margin/caret.svg'
import marginStrike from '../../assets/stickers/margin/strike.svg'
import marginSwap from '../../assets/stickers/margin/swap.svg'
import marginCircle from '../../assets/stickers/margin/circle.svg'
import marginSquiggle from '../../assets/stickers/margin/squiggle.svg'
import marginTick from '../../assets/stickers/margin/tick.svg'
import marginSp from '../../assets/stickers/margin/sp.svg'
import marginNice from '../../assets/stickers/margin/nice.svg'
import marginClose from '../../assets/stickers/margin/close.svg'
import marginRedpen from '../../assets/stickers/margin/redpen.svg'
import marginTape from '../../assets/stickers/margin/tape.svg'
import marginGoldstar from '../../assets/stickers/margin/goldstar.svg'
import polyglotAnnyeong from '../../assets/stickers/polyglot/annyeong.svg'
import polyglotNamaste from '../../assets/stickers/polyglot/namaste.svg'
import polyglotPrivet from '../../assets/stickers/polyglot/privet.svg'
import polyglotKonnichiwa from '../../assets/stickers/polyglot/konnichiwa.svg'
import polyglotShukran from '../../assets/stickers/polyglot/shukran.svg'
import polyglotDanke from '../../assets/stickers/polyglot/danke.svg'
import polyglotGrazie from '../../assets/stickers/polyglot/grazie.svg'
import polyglotXiexie from '../../assets/stickers/polyglot/xiexie.svg'
import polyglotKalimera from '../../assets/stickers/polyglot/kalimera.svg'
import polyglotSuerte from '../../assets/stickers/polyglot/suerte.svg'
import polyglotBonnechance from '../../assets/stickers/polyglot/bonnechance.svg'
import polyglotKolaygelsin from '../../assets/stickers/polyglot/kolaygelsin.svg'
import deskFlashcard from '../../assets/stickers/desk/flashcard.svg'
import deskHighlighter from '../../assets/stickers/desk/highlighter.svg'
import deskSticky from '../../assets/stickers/desk/sticky.svg'
import deskNotebook from '../../assets/stickers/desk/notebook.svg'
import deskPencil from '../../assets/stickers/desk/pencil.svg'
import deskHeadphones from '../../assets/stickers/desk/headphones.svg'
import deskDictionary from '../../assets/stickers/desk/dictionary.svg'
import deskTimer from '../../assets/stickers/desk/timer.svg'
import deskCoffee from '../../assets/stickers/desk/coffee.svg'
import deskLamp from '../../assets/stickers/desk/lamp.svg'
import deskPlant from '../../assets/stickers/desk/plant.svg'
import deskWashi from '../../assets/stickers/desk/washi.svg'
import nightowlOwl from '../../assets/stickers/nightowl/owl.svg'
import nightowlMoon from '../../assets/stickers/nightowl/moon.svg'
import nightowlGm from '../../assets/stickers/nightowl/gm.svg'
import nightowlGn from '../../assets/stickers/nightowl/gn.svg'
import nightowlTwoclocks from '../../assets/stickers/nightowl/twoclocks.svg'
import nightowlGlobe from '../../assets/stickers/nightowl/globe.svg'
import nightowlPlane from '../../assets/stickers/nightowl/plane.svg'
import nightowlLatecall from '../../assets/stickers/nightowl/latecall.svg'
import nightowlYawn from '../../assets/stickers/nightowl/yawn.svg'
import nightowlSnooze from '../../assets/stickers/nightowl/snooze.svg'
import nightowlCandle from '../../assets/stickers/nightowl/candle.svg'
import nightowlShootingstar from '../../assets/stickers/nightowl/shootingstar.svg'
import qalamReed from '../../assets/stickers/qalam/reed.svg'
import qalamDivit from '../../assets/stickers/qalam/divit.svg'
import qalamInkpot from '../../assets/stickers/qalam/inkpot.svg'
import qalamDrop from '../../assets/stickers/qalam/drop.svg'
import qalamDots from '../../assets/stickers/qalam/dots.svg'
import qalamEbru from '../../assets/stickers/qalam/ebru.svg'
import qalamBrush from '../../assets/stickers/qalam/brush.svg'
import qalamSeal from '../../assets/stickers/qalam/seal.svg'
import qalamNib from '../../assets/stickers/qalam/nib.svg'
import qalamBlot from '../../assets/stickers/qalam/blot.svg'
import qalamQuill from '../../assets/stickers/qalam/quill.svg'
import qalamWax from '../../assets/stickers/qalam/wax.svg'
import tableSimit from '../../assets/stickers/table/simit.svg'
import tableDumplings from '../../assets/stickers/table/dumplings.svg'
import tableTacos from '../../assets/stickers/table/tacos.svg'
import tableCroissant from '../../assets/stickers/table/croissant.svg'
import tableSushi from '../../assets/stickers/table/sushi.svg'
import tableSamosa from '../../assets/stickers/table/samosa.svg'
import tableArepa from '../../assets/stickers/table/arepa.svg'
import tablePho from '../../assets/stickers/table/pho.svg'
import tableBaklava from '../../assets/stickers/table/baklava.svg'
import tableMochi from '../../assets/stickers/table/mochi.svg'
import tablePaella from '../../assets/stickers/table/paella.svg'
import tableCheers from '../../assets/stickers/table/cheers.svg'
import venusHi from '../../assets/stickers/venus/hi.webp'
import venusLove from '../../assets/stickers/venus/love.webp'
import venusLol from '../../assets/stickers/venus/lol.webp'
import venusOk from '../../assets/stickers/venus/ok.webp'
import venusNo from '../../assets/stickers/venus/no.webp'
import venusSorry from '../../assets/stickers/venus/sorry.webp'
import venusCrying from '../../assets/stickers/venus/crying.webp'
import venusShocked from '../../assets/stickers/venus/shocked.webp'
import venusThinking from '../../assets/stickers/venus/thinking.webp'
import venusCelebrate from '../../assets/stickers/venus/celebrate.webp'
import venusProud from '../../assets/stickers/venus/proud.webp'
import venusBlink from '../../assets/stickers/venus/blink.webp'
import venusSquint from '../../assets/stickers/venus/squint.webp'
import venusBlep from '../../assets/stickers/venus/blep.webp'
import venusTyping from '../../assets/stickers/venus/typing.webp'
import venusBoop from '../../assets/stickers/venus/boop.webp'
import venusSleepy from '../../assets/stickers/venus/sleepy.webp'
import venusDiva from '../../assets/stickers/venus/diva.webp'
import venusThanks from '../../assets/stickers/venus/thanks.webp'
import venusMorning from '../../assets/stickers/venus/morning.webp'
import venusGoodnight from '../../assets/stickers/venus/goodnight.webp'
import venusPractise from '../../assets/stickers/venus/practise.webp'
import venusHello from '../../assets/stickers/venus/hello.webp'
import venusHola from '../../assets/stickers/venus/hola.webp'
import venusOla from '../../assets/stickers/venus/ola.webp'
import venusBonjour from '../../assets/stickers/venus/bonjour.webp'
import venusHallo from '../../assets/stickers/venus/hallo.webp'
import venusMerhaba from '../../assets/stickers/venus/merhaba.webp'
import venusPrivet from '../../assets/stickers/venus/privet.webp'
import venusMarhaban from '../../assets/stickers/venus/marhaban.webp'
import venusHamsi from '../../assets/stickers/venus/hamsi.webp'
import venusTreat from '../../assets/stickers/venus/treat.webp'
import venusEmptybowl from '../../assets/stickers/venus/emptybowl.webp'
import venusChicken from '../../assets/stickers/venus/chicken.webp'
import venusKnockoff from '../../assets/stickers/venus/knockoff.webp'
import venusBoxhide from '../../assets/stickers/venus/boxhide.webp'
import venusBellyup from '../../assets/stickers/venus/bellyup.webp'
import venusZoomies from '../../assets/stickers/venus/zoomies.webp'
import venusMeantit from '../../assets/stickers/venus/meantit.webp'
import venusYuck from '../../assets/stickers/venus/yuck.webp'
import venusNotes from '../../assets/stickers/venus/notes.webp'
import venusKnead from '../../assets/stickers/venus/knead.webp'
import venusStartle from '../../assets/stickers/venus/startle.webp'
import venusHunt from '../../assets/stickers/venus/hunt.webp'
import venusGift from '../../assets/stickers/venus/gift.webp'
import venusGroom from '../../assets/stickers/venus/groom.webp'
import venusOffended from '../../assets/stickers/venus/offended.webp'
import venusWasntme from '../../assets/stickers/venus/wasntme.webp'
import venusShy from '../../assets/stickers/venus/shy.webp'
import venusListening from '../../assets/stickers/venus/listening.webp'
import venusWelldone from '../../assets/stickers/venus/welldone.webp'
import venusMissyou from '../../assets/stickers/venus/missyou.webp'
import venusOops from '../../assets/stickers/venus/oops.webp'
import venusGracias from '../../assets/stickers/venus/gracias.webp'
import venusObrigada from '../../assets/stickers/venus/obrigada.webp'
import venusMerci from '../../assets/stickers/venus/merci.webp'
import venusDanke from '../../assets/stickers/venus/danke.webp'
import venusTesekkurler from '../../assets/stickers/venus/tesekkurler.webp'
import venusSpasibo from '../../assets/stickers/venus/spasibo.webp'
import venusShukran from '../../assets/stickers/venus/shukran.webp'

export const STICKER_ASSETS: Record<string, Record<string, number>> = {
  // WebP rather than SVG: see the raster rule in `stickerAssets.test.ts`.
  'stickers.venus': {
    hi: venusHi,
    love: venusLove,
    lol: venusLol,
    ok: venusOk,
    no: venusNo,
    sorry: venusSorry,
    crying: venusCrying,
    shocked: venusShocked,
    thinking: venusThinking,
    celebrate: venusCelebrate,
    proud: venusProud,
    blink: venusBlink,
    squint: venusSquint,
    blep: venusBlep,
    typing: venusTyping,
    boop: venusBoop,
    sleepy: venusSleepy,
    diva: venusDiva,
    thanks: venusThanks,
    morning: venusMorning,
    goodnight: venusGoodnight,
    practise: venusPractise,
    hello: venusHello,
    hola: venusHola,
    ola: venusOla,
    bonjour: venusBonjour,
    hallo: venusHallo,
    merhaba: venusMerhaba,
    privet: venusPrivet,
    marhaban: venusMarhaban,
    hamsi: venusHamsi,
    treat: venusTreat,
    emptybowl: venusEmptybowl,
    chicken: venusChicken,
    knockoff: venusKnockoff,
    boxhide: venusBoxhide,
    bellyup: venusBellyup,
    zoomies: venusZoomies,
    meantit: venusMeantit,
    yuck: venusYuck,
    notes: venusNotes,
    knead: venusKnead,
    startle: venusStartle,
    hunt: venusHunt,
    gift: venusGift,
    groom: venusGroom,
    offended: venusOffended,
    wasntme: venusWasntme,
    shy: venusShy,
    listening: venusListening,
    welldone: venusWelldone,
    missyou: venusMissyou,
    oops: venusOops,
    gracias: venusGracias,
    obrigada: venusObrigada,
    merci: venusMerci,
    danke: venusDanke,
    tesekkurler: venusTesekkurler,
    spasibo: venusSpasibo,
    shukran: venusShukran,
  },
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
  // The packs added with the v3 store import every picture under a
  // pack-prefixed name: seventy-two short ids would otherwise collide with
  // the older packs' bindings (`swap`, `nice`, `star`, ...) one by one.
  'stickers.margin': {
    caret: marginCaret,
    strike: marginStrike,
    swap: marginSwap,
    circle: marginCircle,
    squiggle: marginSquiggle,
    tick: marginTick,
    sp: marginSp,
    nice: marginNice,
    close: marginClose,
    redpen: marginRedpen,
    tape: marginTape,
    goldstar: marginGoldstar,
  },
  'stickers.polyglot': {
    annyeong: polyglotAnnyeong,
    namaste: polyglotNamaste,
    privet: polyglotPrivet,
    konnichiwa: polyglotKonnichiwa,
    shukran: polyglotShukran,
    danke: polyglotDanke,
    grazie: polyglotGrazie,
    xiexie: polyglotXiexie,
    kalimera: polyglotKalimera,
    suerte: polyglotSuerte,
    bonnechance: polyglotBonnechance,
    kolaygelsin: polyglotKolaygelsin,
  },
  'stickers.desk': {
    flashcard: deskFlashcard,
    highlighter: deskHighlighter,
    sticky: deskSticky,
    notebook: deskNotebook,
    pencil: deskPencil,
    headphones: deskHeadphones,
    dictionary: deskDictionary,
    timer: deskTimer,
    coffee: deskCoffee,
    lamp: deskLamp,
    plant: deskPlant,
    washi: deskWashi,
  },
  'stickers.nightowl': {
    owl: nightowlOwl,
    moon: nightowlMoon,
    gm: nightowlGm,
    gn: nightowlGn,
    twoclocks: nightowlTwoclocks,
    globe: nightowlGlobe,
    plane: nightowlPlane,
    latecall: nightowlLatecall,
    yawn: nightowlYawn,
    snooze: nightowlSnooze,
    candle: nightowlCandle,
    shootingstar: nightowlShootingstar,
  },
  'stickers.qalam': {
    reed: qalamReed,
    divit: qalamDivit,
    inkpot: qalamInkpot,
    drop: qalamDrop,
    dots: qalamDots,
    ebru: qalamEbru,
    brush: qalamBrush,
    seal: qalamSeal,
    nib: qalamNib,
    blot: qalamBlot,
    quill: qalamQuill,
    wax: qalamWax,
  },
  'stickers.table': {
    simit: tableSimit,
    dumplings: tableDumplings,
    tacos: tableTacos,
    croissant: tableCroissant,
    sushi: tableSushi,
    samosa: tableSamosa,
    arepa: tableArepa,
    pho: tablePho,
    baklava: tableBaklava,
    mochi: tableMochi,
    paella: tablePaella,
    cheers: tableCheers,
  },
}

/*
 * Stickers a pack no longer offers, drawn as the one that replaced them.
 * Venus shipped with a Turkish copy of six words; the pack is international
 * now, but messages already sent still name the old ids, and an id with no
 * picture draws as the word "Sticker" in somebody's chat history.
 *
 * `tesekkurler` is not here: it came back as a live id when every language
 * got its own thanks, so a message that sent the old one draws the new
 * Turkish thanks — the same word, redrawn.
 */
const RETIRED_STICKERS: Record<string, Record<string, string>> = {
  'stickers.venus': {
    tamam: 'ok',
    okay: 'ok',
    gunaydin: 'morning',
    iyigeceler: 'goodnight',
    pratik: 'practise',
  },
}

export function stickerAsset(packId: string, stickerId: string): number | undefined {
  const pictures = STICKER_ASSETS[packId]
  return pictures?.[stickerId] ?? pictures?.[RETIRED_STICKERS[packId]?.[stickerId] ?? '']
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

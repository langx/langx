/**
 * Draws the forgetting curve as a PNG, one per locale, for an announcement to
 * carry.
 *
 * The same picture the app draws behind "What is this?" in the Echo header —
 * `EchoAboutSheet.tsx`, whose `curve()` is copied below unchanged so the two
 * cannot diverge into two different claims about the same schedule. A message
 * that shows one shape and a tab that shows another would be worse than the
 * message having no picture at all.
 *
 * Output is `<dir>/<locale>.png`, beside the `<locale>.txt` bodies
 * `send-announcement.ts` reads. That script uploads whichever of them exist.
 *
 * Usage:
 *   cd apps/api && pnpm exec tsx scripts/render-echo-chart.ts \
 *     --out announcements/echo
 *
 * Reads nothing and writes only files: no database, no network, no env.
 */
import { mkdirSync, writeFileSync } from 'node:fs'
import { join } from 'node:path'
import { SUPPORTED_LOCALES, type Locale } from '@langx/shared'
import { renderCard, type CardNode } from '../src/modules/cards/render'

/** One column per drawn point, across the week the chart covers. */
const COLUMNS = 40
const DAYS = 7

/** Copied from `EchoAboutSheet.tsx`. Same numbers, same shape, same reasons. */
function curve(reviews: number[], stability: number[]): number[] {
  return Array.from({ length: COLUMNS }, (_, index) => {
    const day = (index / (COLUMNS - 1)) * DAYS
    let last = 0
    reviews.forEach((at, i) => {
      if (day >= at) last = i
    })
    return Math.exp(-(day - (reviews[last] ?? 0)) / (stability[last] ?? 1))
  })
}

/** Met once and never again: gone before the week is out. */
const WITHOUT = curve([0], [0.55])
/** The same word, reviewed on the first, second and fourth day. */
const WITH = curve([0, 1, 3], [0.55, 2, 12])

/** `theme/tokens.ts`, light. A card is the app's colours leaving the app. */
const PAPER = '#ffffff'
const FILL = '#f4f5f7'
const INK = '#17191c'
const MUTED = '#62676d'
const FAINT = '#9aa1a7'
const ACCENT = '#3b6cf6'

const CHART_HEIGHT = 120
const BAR_GAP = 5

/**
 * The four strings on the picture, per locale.
 *
 * A copy of `echo.aboutTitle`, `aboutBody`, `aboutWithout` and `aboutWith`
 * from `apps/mobile/src/i18n/messages/`, and deliberately a copy: importing
 * the catalogue across the two packages would put eight mobile files inside
 * the API's typecheck, so that editing a screen's wording could fail the
 * server's build. What a copy risks instead is drift, and drift here is
 * harmless — a rendered PNG is frozen the moment the announcement goes out,
 * and nothing in the app ever reads these.
 */
const COPY: Record<Locale, { title: string; body: string; without: string; with: string }> = {
  en: {
    title: 'How Echo works',
    body: 'Echo brings a sentence back just before you would forget it. Remember it, and the next wait is longer.',
    without: 'Without review',
    with: 'With Echo',
  },
  tr: {
    title: 'Echo nasıl çalışır',
    body: 'Echo bir cümleyi tam unutacağın anda geri getirir. Hatırlarsan bir sonraki bekleme uzar.',
    without: 'Tekrar olmadan',
    with: 'Echo ile',
  },
  es: {
    title: 'Cómo funciona Echo',
    body: 'Echo trae una frase de vuelta justo antes de que la olvides. Si la recuerdas, la siguiente espera es más larga.',
    without: 'Sin repaso',
    with: 'Con Echo',
  },
  ru: {
    title: 'Как работает Echo',
    body: 'Echo возвращает фразу прямо перед тем, как ты её забудешь. Вспомнил — следующий перерыв длиннее.',
    without: 'Без повторения',
    with: 'С Echo',
  },
  /*
   * The one locale that does not say `Echo` on the picture.
   *
   * Two reasons, and they agree. The Arabic app calls the tab `صدى`, which is
   * the word an Arabic reader will be looking for on their own screen. And a
   * Latin word inside a right-to-left line comes back from satori's reorder
   * with its letters backwards — `ohcE` — which no amount of spacing fixes.
   */
  ar: {
    title: 'كيف يعمل صدى',
    body: 'يعيد صدى الجملة قبل أن تنساها بقليل. وإذا تذكّرتها طالت المدة التالية.',
    without: 'بلا مراجعة',
    with: 'مع صدى',
  },
  fr: {
    title: 'Comment fonctionne Echo',
    body: 'Echo ramène une phrase juste avant que tu ne l’oublies. Si tu t’en souviens, l’attente suivante s’allonge.',
    without: 'Sans révision',
    with: 'Avec Echo',
  },
  de: {
    title: 'So funktioniert Echo',
    body: 'Echo holt einen Satz zurück, kurz bevor du ihn vergisst. Erinnerst du dich, wird die nächste Pause länger.',
    without: 'Ohne Wiederholung',
    with: 'Mit Echo',
  },
  'pt-BR': {
    title: 'Como o Echo funciona',
    body: 'O Echo traz uma frase de volta pouco antes de você esquecer. Se lembrar, a próxima espera fica maior.',
    without: 'Sem revisão',
    with: 'Com o Echo',
  },
}

function el(type: string, props: CardNode['props']): CardNode {
  return { type, props }
}

/**
 * Arabic, with every space made a thin one.
 *
 * satori 0.33 loses ordinary spaces when it reorders a right-to-left line —
 * not all of them and not predictably, so `بلا مراجعة` comes back as one
 * word. U+2009 survives the reorder and measures close enough to a space at
 * this size; U+00A0 does not work, it pulls the Latin word into the Arabic run
 * and reverses its letters. Checked by rendering, which is the only way to
 * check it: nothing throws either way.
 */
function thin(text: string): string {
  return text.replace(/ /g, '\u2009')
}

/**
 * One curve, as bars — the shape the sheet draws, for the same reason: a
 * polyline would need a path and satori lays out boxes.
 */
function drawCurve(points: number[], colour: string): CardNode {
  return el('div', {
    style: {
      display: 'flex',
      alignItems: 'flex-end',
      gap: BAR_GAP,
      height: CHART_HEIGHT,
      marginTop: 10,
    },
    children: points.map((point, index) =>
      el('div', {
        key: index,
        style: {
          flex: 1,
          borderRadius: 3,
          backgroundColor: colour,
          // 6 rather than 0, as in the app: a curve that has reached nothing
          // should still show where the floor is.
          height: Math.max(6, point * CHART_HEIGHT),
        },
      }),
    ),
  })
}

function chart(locale: Locale, rtl: boolean): CardNode {
  const copy = COPY[locale]
  const say = (text: string): string => (rtl ? thin(text) : text)
  const label = { fontSize: 24, fontWeight: 600, letterSpacing: 0.4, flexShrink: 0 }
  return el('div', {
    style: {
      display: 'flex',
      flexDirection: 'column',
      width: '100%',
      height: '100%',
      padding: 48,
      backgroundColor: PAPER,
      /*
       * Arabic asks for its own face first, and the order is load-bearing:
       * with Nunito first, satori hands it the spaces — it has that glyph and
       * not the letters around it — and every run boundary that creates comes
       * back from the bidi reorder with the space swallowed, so the words run
       * together. Asking for Noto first keeps a line in one run, and the Latin
       * word in the middle of it still falls back to Nunito.
       */
      fontFamily: rtl ? 'Noto Sans Arabic, Nunito' : 'Nunito',
      // The text starts on the side its reader starts on. Set on the text
      // blocks themselves rather than here: `alignItems` on this column would
      // shrink the chart card to its content and leave the bars, which are
      // `flex: 1` inside it, nothing to divide.
      textAlign: rtl ? 'right' : 'left',
    },
    children: [
      /*
       * `flexShrink: 0` on every text block, or a body that wraps to two lines
       * is laid out as one and the title lands on top of it. Yoga sizes a text
       * node before it knows how wide the line will be, and shrinking is what
       * lets the measured height be thrown away.
       */
      el('div', {
        style: { fontSize: 44, fontWeight: 800, color: INK, flexShrink: 0, lineHeight: 1.2 },
        children: say(copy.title),
      }),
      el('div', {
        style: {
          fontSize: 24,
          fontWeight: 600,
          color: MUTED,
          marginTop: 10,
          lineHeight: 1.35,
          flexShrink: 0,
        },
        children: say(copy.body),
      }),
      el('div', {
        style: {
          display: 'flex',
          flexDirection: 'column',
          flexShrink: 0,
          marginTop: 24,
          padding: 32,
          borderRadius: 28,
          backgroundColor: FILL,
        },
        children: [
          el('div', { style: { ...label, color: FAINT }, children: say(copy.without) }),
          drawCurve(WITHOUT, FAINT),
          el('div', {
            style: { ...label, color: ACCENT, marginTop: 26 },
            children: say(copy.with),
          }),
          drawCurve(WITH, ACCENT),
        ],
      }),
    ],
  })
}

async function main(): Promise<void> {
  const index = process.argv.indexOf('--out')
  const dir = index === -1 ? undefined : process.argv[index + 1]
  if (!dir) throw new Error('usage: --out <dir>')

  mkdirSync(dir, { recursive: true })
  for (const locale of SUPPORTED_LOCALES as readonly Locale[]) {
    const png = await renderCard(chart(locale, locale === 'ar'), 'wide')
    const path = join(dir, `${locale}.png`)
    writeFileSync(path, png)
    console.log(`${path}  ${(png.length / 1024).toFixed(0)} KB`)
  }
}

main().catch((error: unknown) => {
  console.error(error)
  process.exit(1)
})

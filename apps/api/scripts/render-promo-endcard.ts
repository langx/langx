/**
 * Draws the last two seconds of a promo video: the mark, the name, and the
 * one thing the viewer is asked to do.
 *
 * It lives here rather than in `tools/promo-video/` because `renderCard` and
 * the Nunito faces are this package's, and a second copy of satori in a tools
 * directory would be a megabyte of dependency for one PNG. Same arrangement as
 * `render-echo-chart.ts`, which draws an announcement's picture the same way.
 *
 * Usage:
 *   cd apps/api && pnpm exec tsx scripts/render-promo-endcard.ts \
 *     --out ../../tools/promo-video/out/raw/endcard.png
 *
 * Reads nothing and writes one file: no database, no network, no env.
 */
import { mkdirSync, writeFileSync } from 'node:fs'
import { dirname } from 'node:path'
import { loadBadge, renderCard, type CardNode } from '../src/modules/cards/render'

/** `theme/tokens.ts`. A promo card is the app's colours leaving the app. */
const INK = '#17191c'
const PAPER = '#ffffff'
const PRIMARY = '#ffc409'
const FAINT = '#9aa1a7'

/**
 * The keyword is the whole mechanism: Instagram suppresses posts carrying a
 * link, so the link moves to a DM, and a DM may only be sent in reply to
 * something the person did. The word they type is that something.
 */
const KEYWORD = 'LANGX'

function el(type: string, props: CardNode['props']): CardNode {
  return { type, props }
}

/**
 * No emoji anywhere on this card, deliberately. satori matches glyphs against
 * the fonts it is handed and Nunito has none, so an emoji comes out as tofu —
 * the same reason `design.ts` draws its symbols as paths. ffmpeg's `drawtext`
 * fails the same way on the video's own captions, so the rule holds for the
 * whole pipeline: type, not emoji.
 */
function endCard(badge: string): CardNode {
  return el('div', {
    style: {
      width: '1080px',
      height: '1920px',
      display: 'flex',
      flexDirection: 'column',
      alignItems: 'center',
      justifyContent: 'center',
      backgroundColor: INK,
      fontFamily: 'Nunito',
    },
    children: [
      el('img', { src: badge, width: 260, height: 260, style: { marginBottom: '56px' } }),
      el('div', {
        style: { fontSize: '108px', fontWeight: 800, color: PAPER, letterSpacing: '-2px' },
        children: 'LangX',
      }),
      el('div', {
        style: { fontSize: '40px', fontWeight: 600, color: FAINT, marginTop: '12px' },
        children: 'Language exchange with real people',
      }),
      el('div', {
        style: {
          display: 'flex',
          marginTop: '140px',
          fontSize: '62px',
          fontWeight: 800,
          color: PAPER,
        },
        children: [
          el('span', { children: 'Comment ' }),
          el('span', { style: { color: PRIMARY }, children: KEYWORD }),
        ],
      }),
      el('div', {
        style: { fontSize: '46px', fontWeight: 600, color: PAPER, marginTop: '18px' },
        children: "and I'll send you the link",
      }),
    ],
  })
}

function outPath(args: string[]): string {
  const index = args.indexOf('--out')
  const value = index === -1 ? undefined : args[index + 1]
  if (!value) throw new Error('--out <file.png> is required')
  return value
}

async function main(): Promise<void> {
  const out = outPath(process.argv.slice(2))
  const png = await renderCard(endCard(await loadBadge()), 'story')
  mkdirSync(dirname(out), { recursive: true })
  writeFileSync(out, png)
  console.log(`endcard: ${out} (${png.length} bytes)`)
}

main().catch((error: unknown) => {
  console.error(error)
  process.exit(1)
})

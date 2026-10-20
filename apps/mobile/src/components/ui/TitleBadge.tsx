import type { ReactNode } from 'react'
import { StyleSheet, Text, View } from 'react-native'
import Svg, { Circle, Path, Rect } from 'react-native-svg'
import { cosmeticLabel, useLocale, useT } from '../../i18n'
import { DISPLAY_FONT, useTheme } from '../../lib/theme'
import { TITLE_ART, titleArtKey, type TitleKey } from '../../lib/titleArt'

/** The profile's and v3 Me's cut, and the thread band's. */
export type TitleBadgeSize = 'full' | 'compact'

const HEIGHT: Record<TitleBadgeSize, number> = { full: 32, compact: 24 }
const FONT: Record<
  TitleBadgeSize,
  { fontSize: number; lineHeight: number; letterSpacing: number }
> = {
  full: { fontSize: 13, lineHeight: 16, letterSpacing: 1.2 },
  compact: { fontSize: 11, lineHeight: 14, letterSpacing: 0.7 },
}

/**
 * An end cap: a motif drawn in the board's own units, so its paths are the
 * board's paths. `box` is the slice of the board's 176 × 52 badge it covers —
 * x, y, width, height — and the cap is drawn as tall as the badge.
 */
interface Cap {
  box: readonly [number, number, number, number]
  art: ReactNode
}

const DIAMOND = 'M4 0 L8 5 L4 10 L0 5 Z'

/*
 * The motifs, start and end, from the titles board. Each is its own small
 * picture rather than one drawing stretched to the word: a title's width
 * depends on the language it is read in — "Yeni başlayan" is twice "Tutor" —
 * and only the body between the caps can grow without distorting the art.
 */
const CAPS: Record<TitleKey, { start: Cap; end?: Cap }> = {
  beginner: {
    start: {
      box: [6, 7, 28, 40],
      art: (
        <>
          <Circle cx={22} cy={27} r={3.6} fill="none" stroke="#5f6f92" strokeWidth={1.6} />
          <Path
            d="M19 26 C13 20 10 22 8.5 15"
            fill="none"
            stroke="#5f6f92"
            strokeWidth={1.4}
            strokeLinecap="round"
          />
        </>
      ),
    },
    end: {
      box: [140, 7, 20, 40],
      art: <Path d="M150 13 l4 4 l-4 4 l-4 -4 Z M150 33 l4 4 l-4 4 l-4 -4 Z" fill="#5f6f92" />,
    },
  },
  learner: {
    start: {
      box: [10, 7, 28, 40],
      art: (
        <>
          <Circle cx={24} cy={27} r={11} fill="#f4e8c8" stroke="#a98348" strokeWidth={1.5} />
          <Path d="M24 34 L24 25" stroke="#4f7d2e" strokeWidth={2} strokeLinecap="round" />
          <Path d="M24 28 C19.5 28 17.5 24.5 17.5 21 C21 21 24 23.5 24 27 Z" fill="#5c8f3a" />
          <Path d="M24 25.5 C28.5 25.5 30.5 22 30.5 18.5 C27 18.5 24 21 24 24.5 Z" fill="#7aae4f" />
        </>
      ),
    },
    end: {
      box: [142, 7, 26, 40],
      art: (
        <>
          {[0, 1, 2].flatMap((row) =>
            [0, 1, 2].map((col) => (
              <Rect
                key={`${row}${col}`}
                x={146 + col * 6}
                y={17 + row * 7}
                width={6}
                height={7}
                fill={(row + col) % 2 === 0 ? '#a77f45' : '#ecd59f'}
              />
            )),
          )}
          <Rect
            x={145.4}
            y={16.4}
            width={19.2}
            height={22.2}
            rx={2.5}
            fill="none"
            stroke="#8c6a38"
            strokeWidth={1.2}
          />
        </>
      ),
    },
  },
  helper: {
    start: {
      box: [18, 7, 22, 40],
      art: (
        <Path
          d="M24 22 l10 10 M34 22 l-10 10"
          stroke="#8fe0c4"
          strokeWidth={2.2}
          strokeLinecap="round"
        />
      ),
    },
    end: {
      box: [136, 7, 22, 40],
      art: (
        <Path
          d="M142 22 l10 10 M152 22 l-10 10"
          stroke="#8fe0c4"
          strokeWidth={2.2}
          strokeLinecap="round"
        />
      ),
    },
  },
  // The ribbon's folded tails, drawn inside the body rather than past it, so
  // the badge's box is the badge.
  tutor: {
    start: {
      box: [4, 7, 22, 40],
      art: <Path d="M4 13 L22 13 L22 41 L4 41 L11 27 Z" fill="#1d3f73" />,
    },
    end: {
      box: [150, 7, 22, 40],
      art: <Path d="M172 13 L154 13 L154 41 L172 41 L165 27 Z" fill="#1d3f73" />,
    },
  },
  mentor: {
    start: {
      box: [10, 7, 28, 40],
      art: (
        <>
          <Path
            d="M24 17 L34 27 L24 37 L14 27 Z"
            fill="#154f54"
            stroke="#8fd6d0"
            strokeWidth={1.4}
            strokeLinejoin="round"
          />
          <Path d="M24 22 L29 27 L24 32 L19 27 Z" fill="#b6ece6" />
        </>
      ),
    },
    end: {
      box: [138, 7, 28, 40],
      art: (
        <>
          <Path
            d="M152 17 L162 27 L152 37 L142 27 Z"
            fill="#154f54"
            stroke="#8fd6d0"
            strokeWidth={1.4}
            strokeLinejoin="round"
          />
          <Path d="M152 22 L157 27 L152 32 L147 27 Z" fill="#b6ece6" />
        </>
      ),
    },
  },
  linguist: {
    start: { box: [8, 7, 30, 40], art: <Quatrefoil cx={23} /> },
    end: { box: [138, 7, 30, 40], art: <Quatrefoil cx={153} /> },
  },
  polyglot: {
    start: {
      box: [12, 7, 30, 40],
      art: (
        <>
          <Path
            d="M18 19 Q18 16 21 16 L35 16 Q38 16 38 19 L38 29 Q38 32 35 32 L27 32 L22 37 L23 32 L21 32 Q18 32 18 29 Z"
            fill="#fbfaf5"
            stroke="#e2bd55"
            strokeWidth={1.2}
          />
          <Path d="M23 24 L33 24" stroke="#0c5235" strokeWidth={1.8} strokeLinecap="round" />
        </>
      ),
    },
  },
  scholar: {
    start: {
      box: [10, 7, 32, 40],
      art: (
        <Path
          d="M14 21 Q20 18 26 21 L26 34 Q20 31 14 34 Z M26 21 Q32 18 38 21 L38 34 Q32 31 26 34 Z"
          fill="none"
          stroke="#e0b54a"
          strokeWidth={1.7}
          strokeLinejoin="round"
        />
      ),
    },
    end: {
      box: [140, 7, 24, 40],
      art: (
        <>
          <Circle cx={152} cy={27} r={8} fill="#b8322a" stroke="#e0b54a" strokeWidth={1.4} />
          <Path
            d="M152 21.5 L153.5 25.5 L157.5 27 L153.5 28.5 L152 32.5 L150.5 28.5 L146.5 27 L150.5 25.5 Z"
            fill="#f2d27a"
          />
        </>
      ),
    },
  },
  master: {
    start: {
      box: [12, 7, 26, 40],
      art: (
        <>
          <Path d="M16 27 C22 19 28 35 34 27" fill="none" stroke="#e0a526" strokeWidth={1.8} />
          <Circle cx={20} cy={22} r={3} fill="#d62b1f" />
          <Circle cx={26} cy={24.5} r={3} fill="#d62b1f" />
        </>
      ),
    },
    end: {
      box: [138, 7, 26, 40],
      art: (
        <>
          <Path d="M160 27 C154 19 148 35 142 27" fill="none" stroke="#e0a526" strokeWidth={1.8} />
          <Circle cx={156} cy={22} r={3} fill="#d62b1f" />
          <Circle cx={150} cy={24.5} r={3} fill="#d62b1f" />
        </>
      ),
    },
  },
  // Aurora Glass's panes, still: the frame is the one thing that moves.
  legend: {
    start: {
      box: [4, 7, 34, 40],
      art: (
        <>
          <Path d="M4 7 L38 7 L31 27 L4 27 Z" fill="#42d8c8" stroke="#23262d" strokeWidth={2} />
          <Path d="M4 27 L31 27 L38 47 L4 47 Z" fill="#bba4ff" stroke="#23262d" strokeWidth={2} />
        </>
      ),
    },
    end: {
      box: [138, 7, 34, 40],
      art: (
        <>
          <Path
            d="M172 7 L138 7 L145 27 L172 27 Z"
            fill="#74b9ff"
            stroke="#23262d"
            strokeWidth={2}
          />
          <Path
            d="M172 27 L145 27 L138 47 L172 47 Z"
            fill="#5fdc98"
            stroke="#23262d"
            strokeWidth={2}
          />
        </>
      ),
    },
  },
}

/** Linguist's tile block: a blue square with a quatrefoil of white dots. */
function Quatrefoil({ cx }: { cx: number }) {
  return (
    <>
      <Rect x={cx - 12} y={14} width={24} height={26} rx={4} fill="#17408c" />
      <Circle cx={cx} cy={20.5} r={2.4} fill="#f1efe6" />
      <Circle cx={cx} cy={33.5} r={2.4} fill="#f1efe6" />
      <Circle cx={cx - 6.5} cy={27} r={2.4} fill="#f1efe6" />
      <Circle cx={cx + 6.5} cy={27} r={2.4} fill="#f1efe6" />
      <Circle cx={cx} cy={27} r={1.8} fill="#e0a12e" />
    </>
  )
}

function CapArt({ cap, height }: { cap: Cap; height: number }) {
  const [x, y, w, h] = cap.box
  return (
    <Svg width={(height * w) / h} height={height} viewBox={`${x} ${y} ${w} ${h}`}>
      {cap.art}
    </Svg>
  )
}

/**
 * Small capitals that respect the language: Turkish capitalises a dotted i
 * as İ, which `toUpperCase` alone does not know, and a locale argument to
 * `toLocaleUpperCase` is not something every JavaScript engine honours.
 */
function capitals(label: string, locale: string): string {
  const source = locale === 'tr' ? label.replace(/i/g, 'İ').replace(/ı/g, 'I') : label
  return source.toUpperCase()
}

/**
 * A worn title, drawn as the badge the v3 board draws: a body in the title's
 * own material, a motif in each end cap, the word in small capitals between.
 * Under `flags.v3Home` only — the current look keeps `CosmeticTitle`.
 *
 * `compact` is the thread band's cut, 24 high: the start motif alone, so it
 * fits beside a name on a phone's narrowest width.
 *
 * Read as "Title: Scholar" — one element, because the motifs are decoration
 * and the word without its kind would be read as part of the name.
 *
 * Nothing moves. `locked` dims the art for a title not yet bought, as the
 * board's collection does; nothing in this PR draws one, but the store's
 * collection will want it and the dimming belongs with the art.
 */
export function TitleBadge({
  id,
  size = 'full',
  locked = false,
}: {
  id: string
  size?: TitleBadgeSize
  locked?: boolean
}) {
  const t = useT()
  const { locale, isRtl } = useLocale()
  const { scheme } = useTheme()
  // Every title the catalogue sells has art (`titleArt.test.ts`), and the
  // worn one comes from `wornCosmetic`, which knows only that catalogue.
  const key = titleArtKey(id)
  if (!key) return null
  const label = cosmeticLabel(t, id)
  const art = TITLE_ART[key]
  const caps = CAPS[key]
  const height = HEIGHT[size]
  const compact = size === 'compact'
  const edgeWidth = compact ? Math.min(art.edgeWidth ?? 1, 2) : (art.edgeWidth ?? 1)
  const inset = Math.round(height * 0.14)
  const end = !compact && art.end ? caps.end : undefined
  // Letter-spacing pulls Arabic's joined letters apart, so the RTL script
  // gets none; capitals mean nothing there either.
  const font = { ...FONT[size], ...(isRtl ? { letterSpacing: 0 } : {}) }

  return (
    <View
      accessible
      accessibilityRole="text"
      accessibilityLabel={t('cosmetics.titleBadgeLabel', { title: label })}
      style={[
        styles.body,
        {
          minHeight: height,
          backgroundColor: art.fill,
          borderColor: art.edge[scheme === 'dark' ? 1 : 0],
          borderWidth: edgeWidth,
          borderTopStartRadius: art.radius[0] * height,
          borderBottomStartRadius: art.radius[0] * height,
          borderTopEndRadius: art.radius[1] * height,
          borderBottomEndRadius: art.radius[1] * height,
          paddingEnd: end ? 0 : height * 0.3,
        },
        locked && { opacity: scheme === 'dark' ? 0.5 : 0.45 },
      ]}
    >
      {art.inner && !compact ? (
        <View
          pointerEvents="none"
          style={[
            StyleSheet.absoluteFill,
            art.inner.style === 'rules'
              ? {
                  borderBottomWidth: 1,
                  borderColor: art.inner.color,
                  borderTopWidth: 1,
                  marginHorizontal: inset,
                  marginVertical: inset - edgeWidth,
                }
              : {
                  borderColor: art.inner.color,
                  borderRadius: Math.max(0, Math.max(...art.radius) * height - inset),
                  borderStyle: art.inner.style === 'stitch' ? 'dashed' : 'solid',
                  borderWidth: art.inner.style === 'stitch' ? 1.5 : 1,
                  margin: inset - edgeWidth,
                },
          ]}
        />
      ) : null}
      <CapArt cap={caps.start} height={height - edgeWidth * 2} />
      <View
        style={[
          styles.word,
          art.plaque && {
            backgroundColor: art.plaque.fill,
            borderColor: art.plaque.border,
            borderRadius: height * 0.14,
            borderWidth: 1.5,
            marginVertical: inset - edgeWidth,
            alignSelf: 'stretch',
          },
        ]}
      >
        <Text
          numberOfLines={1}
          // Grows with the reader's text size, to a point: past it the word
          // would outgrow the caps drawn for it.
          maxFontSizeMultiplier={1.4}
          style={[styles.text, font, { color: art.text }]}
        >
          {capitals(label, locale)}
        </Text>
      </View>
      {end ? <CapArt cap={end} height={height - edgeWidth * 2} /> : null}
    </View>
  )
}

const styles = StyleSheet.create({
  body: {
    alignItems: 'center',
    alignSelf: 'flex-start',
    flexDirection: 'row',
    maxWidth: '100%',
    overflow: 'hidden',
  },
  word: { flexShrink: 1, justifyContent: 'center', paddingHorizontal: 6 },
  text: { fontFamily: DISPLAY_FONT, textAlign: 'center' },
})

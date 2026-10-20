/**
 * Each title's badge, from the v3 titles board: the body's colours, how its
 * ends are shaped, and what runs inside its edge. The end-cap motifs
 * themselves are drawn in `TitleBadge`, which needs `react-native-svg`; this
 * file stays plain data so `titleArt.test.ts` can measure it.
 *
 * The art keeps one set of colours in both schemes, as the board does — a
 * badge is an object, like a pin on a jacket, and it does not change colour
 * when the lights go down. What changes is the `edge`, the one-pixel line
 * round the body: it is picked per scheme so the badge's outline holds 3:1
 * against every ground it is drawn on, the screen's and the partner hues the
 * thread band and v3 Me put behind it. Either the fill or the edge has to
 * hold it; `titleArt.test.ts` measures both, and the word against its fill.
 */

/** The variant part of a title id: `title.scholar` → `scholar`. */
export type TitleKey =
  | 'beginner'
  | 'learner'
  | 'helper'
  | 'tutor'
  | 'mentor'
  | 'linguist'
  | 'polyglot'
  | 'scholar'
  | 'master'
  | 'legend'

export interface TitleArt {
  fill: string
  /** The word's colour, on `fill` — or on `plaque` where there is one. */
  text: string
  /** The outline: light scheme, then dark. */
  edge: readonly [string, string]
  /** Wider for the two whose border is part of the art. */
  edgeWidth?: number
  /** Corner radius as a share of the badge's height, start end then end. */
  radius: readonly [number, number]
  /** A line inset inside the edge: a ring, a stitch, or two rules. */
  inner?: { color: string; style: 'ring' | 'stitch' | 'rules' }
  /** A ground of its own behind the word, inside the body (Legend's glass). */
  plaque?: { fill: string; border: string }
  /** Whether the end cap carries a motif. Polyglot's is its gloss alone. */
  end: boolean
}

export const TITLE_ART: Readonly<Record<TitleKey, TitleArt>> = {
  // A luggage tag: a rounded start for the string's end, a hole and two studs.
  beginner: {
    fill: '#efe8d8',
    text: '#3f4a63',
    edge: ['#3f4a63', '#3f4a63'],
    radius: [0.5, 0.12],
    end: true,
  },
  // Kraft paper: a sprout at the start, a checkered stamp at the end.
  learner: {
    fill: '#d8b779',
    text: '#3d2a12',
    edge: ['#5e431c', '#5e431c'],
    radius: [0.2, 0.2],
    end: true,
  },
  // Felt with a running stitch round it and a cross-stitch at each end.
  helper: {
    fill: '#9a5530',
    text: '#fff4e4',
    edge: ['#5e2f17', '#5e2f17'],
    radius: [0.3, 0.3],
    inner: { color: '#fbe6c8', style: 'stitch' },
    end: true,
  },
  // A ribbon: folded tails and two tape rules.
  tutor: {
    fill: '#3474c8',
    text: '#ffffff',
    edge: ['#1d3f73', '#1d3f73'],
    radius: [0.08, 0.08],
    inner: { color: '#ead39f', style: 'rules' },
    end: true,
  },
  // Glazed teal: a ring of lighter glaze and a set stone at each end.
  mentor: {
    fill: '#24767c',
    text: '#f2fbfa',
    edge: ['#0f3e42', '#0f3e42'],
    radius: [0.3, 0.3],
    inner: { color: '#8fd6d0', style: 'ring' },
    end: true,
  },
  // Blue-and-white tile: a quatrefoil block at each end, a double border.
  linguist: {
    fill: '#f1efe6',
    text: '#173d85',
    edge: ['#17408c', '#17408c'],
    edgeWidth: 2,
    radius: [0.25, 0.25],
    inner: { color: '#1f4fa8', style: 'ring' },
    end: true,
  },
  // An enamel pill in a gold rim, with a speech bubble.
  polyglot: {
    fill: '#0c5235',
    text: '#fbf3d6',
    edge: ['#c9a23a', '#c9a23a'],
    edgeWidth: 3,
    radius: [0.5, 0.5],
    end: false,
  },
  // Navy with gilt rules, an open book and a wax seal.
  scholar: {
    fill: '#1a2347',
    text: '#f2d27a',
    edge: ['#1a2347', '#e0b54a'],
    radius: [0.17, 0.17],
    inner: { color: '#e0b54a', style: 'rules' },
    end: true,
  },
  // Black lacquer with gold scrolls and red berries, as Khokhloma.
  master: {
    fill: '#17110e',
    text: '#f2c45a',
    edge: ['#17110e', '#e0a526'],
    radius: [0.19, 0.19],
    inner: { color: '#e0a526', style: 'ring' },
    end: true,
  },
  // Aurora Glass: four panes at each end and a cream plaque for the word.
  legend: {
    fill: '#23262d',
    text: '#14161b',
    edge: ['#23262d', '#bba4ff'],
    radius: [0.22, 0.22],
    plaque: { fill: '#fbf6e8', border: '#e8b94a' },
    end: true,
  },
}

/** `title.scholar` → `scholar`; nothing for an id this build has no art for. */
export function titleArtKey(id: string): TitleKey | undefined {
  const variant = id.startsWith('title.') ? id.slice('title.'.length) : ''
  return variant in TITLE_ART ? (variant as TitleKey) : undefined
}

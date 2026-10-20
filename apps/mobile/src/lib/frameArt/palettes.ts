import type { CosmeticTone } from '@langx/shared'

/**
 * Each frame's colours, light and dark, from the v3 frame art master sheet.
 *
 * Its own table rather than `frameColors`: a frame drawn as art has three to
 * nine colours, and `frameColors` is the one ring colour per tone that a build
 * without the art (or with the flag off) draws. The tone is still each frame's
 * main colour, so the two tell the same story.
 *
 * Dark mode has no white grounds — porcelain, paper and the glass's backlight
 * are tinted — and each frame's outer edge (`edge`, light then dark) holds 3:1
 * against both schemes' grounds and surfaces; `frameArt.test.ts` measures it.
 */
export const ART_PALETTES = {
  papel: {
    light: { outer: '#4f5866', inner: '#8a9199', paper: '#efe9dc' },
    dark: { outer: '#9aa1a9', inner: '#5d6674', paper: '#cfc6b2' },
    edge: ['#4f5866', '#9aa1a9'],
  },
  washi: {
    light: { tape: '#e86f8f', deep: '#b84a68', paper: '#f6ecdc' },
    dark: { tape: '#f290aa', deep: '#c25a78', paper: '#d4c8b2' },
    edge: ['#b84a68', '#f290aa'],
  },
  stitch: {
    light: { felt: '#a9713e', thread: '#fbe6c8', cross: '#8fe0c4' },
    dark: { felt: '#c98c53', thread: '#fff0da', cross: '#9fe8cf' },
    edge: ['#a9713e', '#c98c53'],
  },
  lino: {
    light: { ink: '#5d8a3a', paper: '#f1ead8' },
    dark: { ink: '#84b85c', paper: '#cbbfa5' },
    edge: ['#5d8a3a', '#84b85c'],
  },
  woven: {
    light: { sky: '#3b8ef6', reed: '#e1c58e', dark: '#8a6a33' },
    dark: { sky: '#7cb0f9', reed: '#cdb27a', dark: '#a07c3e' },
    edge: ['#8a6a33', '#a07c3e'],
  },
  origami: {
    light: {
      paper: '#eef0f4',
      silver: '#9aa3ab',
      edge: '#6f7886',
      branch: '#5b3a26',
      leaf: '#d8402a',
      leafDk: '#9e2a1c',
    },
    dark: {
      paper: '#d3d8e0',
      silver: '#8f98a6',
      edge: '#c2c9d0',
      branch: '#a8826a',
      leaf: '#ff6b4f',
      leafDk: '#c94a3c',
    },
    edge: ['#6f7886', '#c2c9d0'],
  },
  indigo: {
    light: { cloth: '#3349a8', deep: '#1e2c6e', resist: '#e3e9f8', bleed: '#8ea0dc' },
    dark: { cloth: '#6f84e0', deep: '#3f52b0', resist: '#d2daf2', bleed: '#a8b6ee' },
    edge: ['#3349a8', '#6f84e0'],
  },
  enamel: {
    light: { rim: '#a8801f', gold: '#e2bd55', enamel: '#12a37a', deep: '#0b6b50' },
    dark: { rim: '#e2bd55', gold: '#f0cf6e', enamel: '#34c796', deep: '#14855f' },
    edge: ['#a8801f', '#e2bd55'],
  },
  mosaic: {
    light: {
      grout: '#d9cfbf',
      plum: '#9b3f7a',
      cream: '#f3e9d6',
      gold: '#c9902a',
      edge: '#6e2a56',
    },
    dark: { grout: '#4a3f45', plum: '#d070ae', cream: '#cfc3ab', gold: '#e6b04c', edge: '#d070ae' },
    edge: ['#6e2a56', '#d070ae'],
  },
  iznik: {
    light: { ground: '#f7f2e7', cobalt: '#1d4fa3', ember: '#e2662c', jade: '#2aa5a0' },
    dark: { ground: '#d6ccb6', cobalt: '#3a6fd0', ember: '#ff8a52', jade: '#239a95' },
    edge: ['#1d4fa3', '#3a6fd0'],
  },
  khokhloma: {
    light: { lacquer: '#17110e', gold: '#d4a017', berry: '#d62b1f', berryHi: '#ffd9b0' },
    dark: { lacquer: '#17110e', gold: '#f0bd3a', berry: '#e8402f', berryHi: '#ffe2c4' },
    edge: ['#17110e', '#f0bd3a'],
  },
  seal: {
    light: { lacquer: '#1c1412', gold: '#d4a017', ver: '#d0381f', paper: '#f3e6cf' },
    dark: { lacquer: '#1c1412', gold: '#f0bd3a', ver: '#ff6b4f', paper: '#f1dfc2' },
    edge: ['#1c1412', '#f0bd3a'],
  },
  qalam: {
    light: { lacquer: '#151022', gold: '#d4a017', ink: '#7a5af8', inkHi: '#c7b8ff' },
    dark: { lacquer: '#151022', gold: '#f0bd3a', ink: '#9b83ff', inkHi: '#d9cfff' },
    edge: ['#151022', '#f0bd3a'],
  },
  marquetry: {
    light: { wood: '#7a4a2a', maple: '#ecd3a0', cherry: '#b5703f', gold: '#c9a23a' },
    dark: { wood: '#6e4429', maple: '#dcc28d', cherry: '#c08a5e', gold: '#e8c26a' },
    edge: ['#7a4a2a', '#e8c26a'],
  },
  hoop: {
    light: {
      fabric: '#2b3350',
      line: '#7d8ac4',
      wood: '#c88f52',
      woodHi: '#e7bb85',
      woodDk: '#8f5e2e',
      star: '#f2c45a',
      moon: '#f3ead2',
      clamp: '#b9bcc6',
      clampDk: '#6f7482',
    },
    dark: {
      fabric: '#262e4a',
      line: '#7d8ac4',
      wood: '#d39a5c',
      woodHi: '#efc690',
      woodDk: '#9c6a37',
      star: '#f5cd68',
      moon: '#e6dcc0',
      clamp: '#c3c6cf',
      clampDk: '#7c8190',
    },
    edge: ['#8f5e2e', '#d39a5c'],
  },
  glass: {
    light: {
      lead: '#23262d',
      back: '#f4f1e6',
      gold: '#c99a2e',
      goldHi: '#e8b94a',
      gem: '#3b6cf6',
      halo: '#12b5a8',
      text: '#f3d58a',
    },
    dark: {
      lead: '#23262d',
      back: '#d9d4c4',
      gold: '#e8b94a',
      goldHi: '#f3cd6a',
      gem: '#3b6cf6',
      halo: '#42d8c8',
      text: '#f3d58a',
    },
    edge: ['#23262d', '#e8b94a'],
  },
} as const

/** Aurora Glass's panes, in the order the bands cycle through them. */
export const GLASS_HUES = {
  light: ['#12b5a8', '#74b9ff', '#5fdc98', '#bba4ff', '#ff9fc4', '#9be7ff', '#ffcf6b'],
  dark: ['#42d8c8', '#8cc6ff', '#74e4a8', '#c6b3ff', '#ffb0cf', '#adeeff', '#ffd77f'],
} as const

export type ArtKey = keyof typeof ART_PALETTES

/** A frame's colour roles, as plain strings so light and dark share one shape. */
export type ArtPalette<K extends ArtKey> = Readonly<
  Record<keyof (typeof ART_PALETTES)[K]['light'], string>
>

/**
 * Which drawing a tone gets. Keyed by tone rather than by id because a tone is
 * what reaches `Avatar` — the leaderboard sends it from the API as a bare
 * string — and every frame has a tone of its own.
 */
export const ART_FOR_TONE: Readonly<Record<CosmeticTone, ArtKey>> = {
  slate: 'papel',
  blush: 'washi',
  bronze: 'stitch',
  moss: 'lino',
  sky: 'woven',
  silver: 'origami',
  indigo: 'indigo',
  mint: 'enamel',
  plum: 'mosaic',
  ember: 'iznik',
  gold: 'khokhloma',
  vermilion: 'seal',
  violet: 'qalam',
  walnut: 'marquetry',
  midnight: 'hoop',
  aurora: 'glass',
}

/** The art for a tone, or nothing for a tone this build has never heard of. */
export function artForTone(tone: string): ArtKey | undefined {
  return Object.prototype.hasOwnProperty.call(ART_FOR_TONE, tone)
    ? ART_FOR_TONE[tone as CosmeticTone]
    : undefined
}

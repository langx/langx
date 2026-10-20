import type { ColorScheme } from './theme/tokens'
import type { Rarity } from './storeHome'

/*
 * The redesign's store colours that are not v3 tokens, from `V-Shop`,
 * `V-ShopFrames` and `V-ShopFrameDetail`. A table of their own, as the frame
 * art's palettes are: they belong to the store's objects rather than to the
 * app, and no other screen should reach for them.
 */

/** A rarity chip: its ground and its ink, each at 4.5:1 or more. */
export const RARITY_COLORS: Readonly<
  Record<ColorScheme, Readonly<Record<Rarity, { bg: string; fg: string }>>>
> = {
  light: {
    common: { bg: '#e4e3dc', fg: '#3d414a' },
    rare: { bg: '#dcebff', fg: '#1d4fa3' },
    epic: { bg: '#ebe4ff', fg: '#5338b8' },
    legendary: { bg: '#d3f4ef', fg: '#0b6a62' },
  },
  dark: {
    common: { bg: '#2a2d33', fg: '#d5d8de' },
    rare: { bg: '#17304d', fg: '#9cc8ff' },
    epic: { bg: '#2a2350', fg: '#cbbaff' },
    legendary: { bg: '#0f3a37', fg: '#6ff0e0' },
  },
}

/**
 * The featured cards' grounds. The frames' card is lacquer in both schemes —
 * a frame stays the colour it was sold as, and the glass reads on black — and
 * the packs' card is paper, tinted after dark so no ground is pure white.
 */
export const FEATURE_COLORS: Readonly<
  Record<
    ColorScheme,
    {
      lacquer: string
      lacquerEdge: string
      onLacquer: string
      onLacquerMuted: string
      lacquerKicker: string
      lacquerTrack: string
      lacquerFill: string
      paper: string
      onPaper: string
    }
  >
> = {
  light: {
    lacquer: '#1b1d26',
    lacquerEdge: '#1b1d26',
    onLacquer: '#f6f1e4',
    onLacquerMuted: '#cfc9bb',
    lacquerKicker: '#f3d27a',
    lacquerTrack: 'rgba(246, 241, 228, 0.2)',
    lacquerFill: '#42d8c8',
    paper: '#f6e7cf',
    onPaper: '#14161b',
  },
  dark: {
    lacquer: '#1b1d26',
    lacquerEdge: '#2e3140',
    onLacquer: '#f6f1e4',
    onLacquerMuted: '#cfc9bb',
    lacquerKicker: '#f3d27a',
    lacquerTrack: 'rgba(246, 241, 228, 0.2)',
    lacquerFill: '#42d8c8',
    paper: '#2e2618',
    onPaper: '#f6ecd8',
  },
}

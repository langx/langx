import { INLINE_ASSETS, type InlineAsset } from './inlineAssets'

/**
 * The `src` a template or campaign body uses for an image that travels with
 * the mail. `inlineAssets.ts` says why they travel rather than link.
 */
export function inlineSrc(cid: string): string {
  return `cid:${cid}`
}

/** The header mark. */
export const LOGO_SRC = inlineSrc('langx-logo')

/** Whichever inline assets this HTML shows, for the sender to attach. */
export function inlineAssetsFor(html: string): InlineAsset[] {
  return INLINE_ASSETS.filter((asset) => html.includes(inlineSrc(asset.cid)))
}

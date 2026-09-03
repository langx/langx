import { describe, expect, it } from 'vitest'
import { OVERLAY_LAYER } from './overlayLayers'

describe('the root overlays', () => {
  /**
   * The order `app/_layout.tsx` renders them in, held to as numbers — the
   * tree order alone does not decide this on native, which is the whole
   * reason these exist.
   */
  it('stack splash over banner over toast', () => {
    expect(OVERLAY_LAYER.splash).toBeGreaterThan(OVERLAY_LAYER.messageBanner)
    expect(OVERLAY_LAYER.messageBanner).toBeGreaterThan(OVERLAY_LAYER.toast)
  })

  /** Above anything a screen sets for itself; those are single digits. */
  it('sit far above the in-screen z-indexes', () => {
    for (const layer of Object.values(OVERLAY_LAYER)) expect(layer).toBeGreaterThan(10)
  })
})

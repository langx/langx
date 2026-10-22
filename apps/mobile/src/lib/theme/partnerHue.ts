import { partnerHueIndex } from '@langx/shared'
import { PARTNER_HUES, type PartnerHue } from './tokens'

/**
 * The hue a partner is drawn in, from their id — the same one on every
 * screen, on every device, for as long as the id exists.
 *
 * Derived rather than stored. A stored hue would need a field, a migration
 * and an answer for every account made before it, and it would buy nothing:
 * the only promise is that a person's colour does not change, and a pure
 * function of an id that never changes keeps it. Both people in a pair see
 * each other in their own hue, so two partners may share one; the colour
 * tells partners apart within one person's list often enough, and is never
 * the only thing that does — the name is always beside it.
 *
 * The hash is `partnerHueIndex` in `@langx/shared`, where the server's
 * profile card reads it too, so the card is the colour of the Share page.
 */
export function partnerHueFor(id: string): PartnerHue {
  return PARTNER_HUES[partnerHueIndex(id, PARTNER_HUES.length)]!
}

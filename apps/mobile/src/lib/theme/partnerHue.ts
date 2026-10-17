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
 * FNV-1a over the id's UTF-16 code units, then the remainder by six. Not for
 * its quality as a hash: it is short, has no dependency, and gives the same
 * answer on Hermes, V8 and JavaScriptCore, because it only uses 32-bit
 * integer arithmetic that all three define identically.
 */
export function partnerHueFor(id: string): PartnerHue {
  let hash = 0x811c9dc5
  for (let i = 0; i < id.length; i++) {
    hash ^= id.charCodeAt(i)
    hash = Math.imul(hash, 0x01000193)
  }
  // `>>> 0` reads the 32 bits as unsigned, so the remainder is never negative.
  return PARTNER_HUES[(hash >>> 0) % PARTNER_HUES.length]!
}

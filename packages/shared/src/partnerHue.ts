/**
 * Which of `count` hues a person is drawn in, from their id: the arithmetic
 * behind the app's `partnerHueFor`, here so a profile card the server draws
 * is the same colour as the profile's own Share page.
 *
 * FNV-1a over the id's UTF-16 code units, then the remainder by `count`. Not
 * for its quality as a hash: it is short, has no dependency, and gives the
 * same answer on Hermes, V8 and JavaScriptCore, because it only uses 32-bit
 * integer arithmetic that all three define identically.
 */
export function partnerHueIndex(id: string, count: number): number {
  let hash = 0x811c9dc5
  for (let i = 0; i < id.length; i++) {
    hash ^= id.charCodeAt(i)
    hash = Math.imul(hash, 0x01000193)
  }
  // `>>> 0` reads the 32 bits as unsigned, so the remainder is never negative.
  return (hash >>> 0) % count
}

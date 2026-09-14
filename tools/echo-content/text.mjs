/**
 * The one thing both tools have to agree about: what text may be written out.
 *
 * Everything a pack is made of comes off the network — a Tatoeba sentence is
 * whatever somebody typed into Tatoeba — and two places downstream care about
 * its shape rather than its meaning. `phrases.txt` is one phrase per line and
 * `build-pack.mjs` splits each line on a tab, so a sentence carrying either
 * silently becomes two items or grows a part of speech out of nothing. A gloss
 * carrying a control character is junk on a card, in a script whose reader
 * cannot proofread it against anything.
 *
 * So the shape is checked once, here, rather than assumed in both. The length
 * bound is `ECHO_FRONT_MAX_LENGTH`, which is what a card captured from a chat
 * may be — a pack item longer than that would be one nothing else expects.
 */

const MAX_LENGTH = 200

/** Control characters — tab and newline among them — and the delete character. */
// eslint-disable-next-line no-control-regex
const CONTROL = /[\x00-\x1f\x7f]/

export function writable(text) {
  return (
    typeof text === 'string' && text.length > 0 && text.length <= MAX_LENGTH && !CONTROL.test(text)
  )
}

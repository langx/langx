package tech.newchapter.languageXchange.wear

import androidx.compose.ui.graphics.Color

/**
 * The app's dark palette, written out because a Wear module cannot import
 * `src/lib/theme/tokens.ts`.
 *
 * The third transcription of the same numbers — the widget has one and the
 * Apple Watch has one — and it carries the same obligation: the file in
 * `src/lib/theme` is the definition, a colour changed there has to be changed
 * in all three by hand, and nothing checks it.
 *
 * Dark values only. Wear OS draws on black and has no light mode worth the
 * name; an OLED watch face is off pixels, not a white page.
 */
object Palette {
  /** Black rather than `colors.bg`: on a watch, a lit dark grey is wasted battery. */
  val background = Color(0xFF000000)

  /** `colors.fill` — a row card, and the other person's bubble. */
  val fill = Color(0xFF23272D)
  /** `colors.text`. */
  val text = Color(0xFFF2F3F5)
  /** `colors.textMuted`. */
  val textMuted = Color(0xFF9AA1A9)
  /** `colors.primary` — the committing action, and nothing else. */
  val primary = Color(0xFFFFC409)
  /** `colors.primaryText`, the ink that only ever goes on `primary`. */
  val primaryInk = Color(0xFF201900)
  /** `colors.accent` — the unread dot. */
  val accent = Color(0xFF7C9CF9)
  /** `colors.accentBg` — your own side of a thread, as `MessageBubble` has it. */
  val accentBg = Color(0xFF202B45)
  /** `colors.warning` — the one line that says a reply did not go. */
  val warning = Color(0xFFFFA93D)

  /**
   * The colours an avatar circle can be.
   *
   * Picked from a name rather than stored, because the watch is handed names
   * and nothing else — no avatar URLs, which would be other people's
   * photographs sitting in a second place.
   */
  private val avatars =
      listOf(
          Color(0xFFFFC409),
          Color(0xFF7C9CF9),
          Color(0xFF4FC796),
          Color(0xFFA385F1),
          Color(0xFFFFA93D),
      )

  /**
   * Stable per person, and deliberately not random.
   *
   * A name that changed colour between two draws would read as a different
   * person. Summing the code points is enough — this is a decoration, not a
   * hash, and a collision costs two people the same colour on a list of at
   * most ten. Spelled the same way as `Palette.avatar(for:)` on the Apple side
   * so the same person is the same colour on either watch.
   */
  fun avatarFor(name: String): Color = avatars[name.sumOf { it.code } % avatars.size]

  /** The letter on the disc. Empty for a name that is only punctuation. */
  fun initialFor(name: String): String =
      name.firstOrNull { it.isLetterOrDigit() }?.uppercase() ?: ""
}

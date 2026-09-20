import { Pressable, ScrollView } from 'react-native'
import type { ProfileBadge } from '@langx/shared'
import { BadgeMark } from './BadgeMark'
import { makeStyles } from '../lib/theme'
import { useT } from '../i18n'

/**
 * What somebody has earned, above their bio: a scrolling row of marks.
 *
 * **One mark per kind**, which is a rule the server keeps — see
 * `badgeStripMarks`. What is sent is the newest rung of each kind, and since
 * every badge now wears a picture of its own, no two marks on this row repeat.
 *
 * **The pictures stand on their own ground.** There was a filled circle behind
 * each of them, carrying a colour per kind — green for teaching, blue for
 * talking — while the glyph inside was shared by a whole ladder. The picture
 * says both things now, so a second ground under it was a ring of colour
 * around a drawing that already had its own.
 *
 * **There is no "+N" any more, because there is nothing left for it to
 * count.** It used to say how many badges were past the end of the row, back
 * when the row was every rung and the payload was capped. The shelf this
 * opens now draws the tips of the same ladders — `badgeLadderTips` on an
 * earned-only list is this rule by another route — so the row and the page
 * hold the same badges, and any count of the difference is zero. A "+8" over
 * a page with nothing extra on it is a promise the tap breaks.
 *
 * The count a screen reader hears is therefore the marks drawn, not the rungs
 * behind them. The summary stopped sending that second number when the "+N"
 * went: it had no other reader, and a profile paying for a number nothing
 * draws is how a payload grows.
 *
 * **It scrolls, and it is still one button.** Those read as a contradiction
 * and are not: React Native's responder system hands the touch to whichever
 * of the two the finger turns out to mean, so a drag scrolls and a tap opens
 * the shelf. What it does rule out is a target per mark — two nested presses
 * inside a scroll is where that stops being predictable, and every mark opens
 * the same page anyway, so there is nothing to tell apart.
 *
 * **The marks take a fixed 56px** now that the row scrolls. While it did not,
 * width was a budget and the marks divided it with `flex: 1`; inside a
 * horizontal `ScrollView` there is no bounded width to divide, so a flexed
 * child collapses. Fixed is not the compromise here — it is what a scrolling
 * row needs, and it also means a mark is the same size on every phone rather
 * than a function of the screen.
 *
 * The pictures are the same files the badge page draws, so a mark learned on
 * one screen is recognised on the other.
 *
 * Nothing is drawn for somebody with no badges. An empty rail under a profile
 * is not a smaller version of this — it is a sentence about a stranger that
 * nobody asked it to say.
 */
export function BadgeStrip({
  badges,
  onPress,
}: {
  badges: readonly ProfileBadge[]
  onPress: () => void
}) {
  const styles = useStyles()
  const t = useT()

  if (badges.length === 0) return null

  return (
    <ScrollView
      horizontal
      showsHorizontalScrollIndicator={false}
      contentContainerStyle={styles.content}
      style={styles.scroller}
    >
      <Pressable
        accessibilityRole="button"
        accessibilityLabel={t('profile.badgeStrip', { count: badges.length })}
        onPress={onPress}
        style={({ pressed }) => [styles.strip, pressed && styles.pressed]}
      >
        {badges.map((badge) => (
          <BadgeMark key={badge.id} id={badge.id} size={MARK_SIZE} />
        ))}
      </Pressable>
    </ScrollView>
  )
}

/**
 * Bigger than the 28px glyph it replaces and smaller than the 56px circle that
 * held it: a drawing is ink edge to edge where a glyph was a stroke in the
 * middle of a disc, so matching the circle would weigh twice as much on a row
 * that sits under somebody's face.
 */
const MARK_SIZE = 44

const useStyles = makeStyles(({ spacing }) => ({
  // The vertical padding is the scroller's, so the marks do not sit against
  // the stats row above or the bio below while the row slides under them.
  scroller: { paddingVertical: spacing.lg },
  // Lets the last mark reach the right edge rather than stopping at the
  // gutter, which is what makes it read as "there is more" rather than "that
  // is all, oddly indented".
  content: { paddingRight: spacing.lg },
  strip: { alignItems: 'center', flexDirection: 'row', gap: spacing.md },
  pressed: { opacity: 0.6 },
}))

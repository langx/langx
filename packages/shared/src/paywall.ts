/**
 * The numbers the paywall decides by that are not plan limits.
 *
 * Config rather than literals in the screen, for the reason every threshold in
 * this package is: a number that changes what somebody is shown should be
 * changed in one place and read in every other.
 */
export const PAYWALL_RULES = {
  /**
   * The fewest distinct people who viewed somebody's profile this week before
   * the paywall, opened from the viewer list, says how many there were.
   *
   * Below it the line is left out rather than shown small. A count next to a
   * price is social proof, and a small one reads as a quiet app to exactly the
   * person being asked to pay (_The analytics dashboard is private, and that
   * decides the tool_ in `docs/decisions.md`). The count is the person's own —
   * the same number the viewer list already shows them — never anybody's
   * identity and never a figure about other accounts.
   */
  viewerCountMin: 3,
} as const

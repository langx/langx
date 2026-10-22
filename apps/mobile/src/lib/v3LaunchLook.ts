/**
 * Whether the launch path — the welcome screen, the intro, every onboarding
 * step — is drawn in the redesign's look, decided once per launch.
 *
 * It is `flags.v3Home` (`latchV3Home`), with one difference that comes from
 * where these screens sit. A signed-in launch holds the splash until the flag
 * has answered, so the tabs are right from their first frame. A signed-out
 * launch does not hold it, and must not: the welcome screen is the first
 * thing a stranger opens, and nothing on it is worth a wait. So the welcome
 * screen is drawn under the splash before the flag has said anything, and it
 * starts as today's.
 *
 * While the splash still covers it, the look follows the flag — the screen
 * can change underneath without anybody seeing it. The opening is shorter
 * than the flag's own ceiling (`V3_HOME_WAIT_MS`) — a later launch's adds
 * half a second to the boot — so a slow answer can miss it, and that launch
 * starts in today's look. Once the launch is over and a person can see the
 * screen, the look is whatever the flag has said by that moment, and nothing
 * said later moves it: not on this screen, not on the next step. A wizard
 * that changed look halfway through would be worse than either look, for the
 * same reason a bar that rearranged itself would be.
 *
 * Module state, for `latchV3Home`'s reason: the answer outlives the screens
 * that read it. Signing up swaps the welcome group for the onboarding one,
 * and that is not a moment for the look to change either.
 */
let latched: boolean | undefined

export function latchV3LaunchLook(answer: {
  /** `useV3HomeDecision`: `undefined` while the flag has not answered. */
  decision: boolean | undefined
  /** The splash has gone, and the screen behind it is in front of somebody. */
  launchOver: boolean
}): boolean {
  if (latched !== undefined) return latched
  const look = answer.decision ?? false
  if (answer.launchOver) latched = look
  return look
}

/** For tests: forget the answer, as a cold start would. */
export function resetV3LaunchLook(): void {
  latched = undefined
}

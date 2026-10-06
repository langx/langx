import { hasFeature, type PlanTier } from '@langx/shared'
import { effectiveTier } from './entitlement'
import type { Profile } from './profiles'

/**
 * Hidden mode: one switch over four.
 *
 * Under it sit "Show me in Discover" (drawn the other way round, as "hide me
 * from Discover"), `hideOnlineStatus`, `refuseNewChats` and `incognito`. With
 * the switch off all four are off — greyed out on the screen, and off for real
 * on the server. Turned back on, they come back as they were.
 *
 * The four fields keep holding the values that are *in force*, always. That is
 * the whole design: discovery's `$match`, presence, `startConversation` and
 * `recordProfileView` read them exactly as before, nothing that reads them had
 * to learn about this switch, and no index moved. What the switch adds is a
 * place to keep the person's choices while it is off — `hiddenModeChoices`,
 * which only this file writes and no request can name.
 *
 * On the server rather than on the phone because a choice kept on one device
 * is lost on the next, and the switch would then restore something nobody
 * picked.
 */
export interface HiddenModeChoices {
  hideFromDiscover: boolean
  hideOnlineStatus: boolean
  refuseNewChats: boolean
  incognito: boolean
}

type Subject = Pick<Profile, 'settings' | 'privacy' | 'entitlement'>

function choicesInForce(profile: Subject): HiddenModeChoices {
  return {
    hideFromDiscover: profile.settings?.discoverable === false,
    hideOnlineStatus: profile.privacy?.hideOnlineStatus === true,
    refuseNewChats: profile.privacy?.refuseNewChats === true,
    incognito: profile.privacy?.incognito === true,
  }
}

/**
 * Incognito counts only for a plan that has it, the way `recordProfileView`
 * reads it — a lapsed subscription's leftover `true` hides nothing, and must
 * not on its own turn the switch on.
 */
function hidesAnything(choices: HiddenModeChoices, tier: PlanTier): boolean {
  return (
    choices.hideFromDiscover ||
    choices.hideOnlineStatus ||
    choices.refuseNewChats ||
    (choices.incognito && hasFeature(tier, 'incognito'))
  )
}

/**
 * Whether the switch is on, for a profile that may never have stored it.
 *
 * Worked out rather than backfilled, and the reason is the one failure this
 * feature must not have: everybody who switched Discover or their online
 * status off before the switch existed has no `hiddenMode`. Read as off, their
 * settings would draw greyed out and — the moment anything wrote them — be put
 * back on, and an app update would have made them visible. Read as "on if
 * anything is hidden", they open the screen and find it as they left it.
 */
export function effectiveHiddenMode(profile: Subject): boolean {
  return (
    profile.privacy?.hiddenMode ?? hidesAnything(choicesInForce(profile), effectiveTier(profile))
  )
}

/**
 * The writes one profile update implies for the switch and the four under it.
 * Spread after the request's own privacy and settings paths, so where they
 * disagree this wins.
 */
export function hiddenModePaths(
  current: Subject,
  request: { privacy?: Record<string, boolean> | undefined; discoverable?: boolean | undefined },
): Record<string, unknown> {
  const tier = effectiveTier(current)
  const wasOn = effectiveHiddenMode(current)
  const asked = request.privacy?.hiddenMode

  if (asked === false) {
    /*
     * Already off: nothing to keep. Saving here would overwrite the choices
     * kept by the first "off" with the all-visible values in force now, and a
     * retried request would lose them.
     */
    if (!wasOn) return { 'privacy.hiddenMode': false }
    return {
      'privacy.hiddenMode': false,
      'privacy.hiddenModeChoices': choicesInForce(current),
      'settings.discoverable': true,
      'privacy.hideOnlineStatus': false,
      'privacy.refuseNewChats': false,
      'privacy.incognito': false,
    }
  }

  if (asked === true) {
    if (wasOn) return { 'privacy.hiddenMode': true }
    /*
     * Nothing kept, or kept choices that hide nothing: all four, which is what
     * a switch called hidden mode promises. Restoring "nothing hidden" would
     * leave somebody who turned it on exactly as visible as before, with no
     * sign of why. Incognito only on a plan that has it, so a free account
     * does not carry a `true` that would switch on unannounced at a later
     * subscription.
     */
    const kept = current.privacy?.hiddenModeChoices
    const choices: HiddenModeChoices =
      kept && hidesAnything(kept, tier)
        ? kept
        : {
            hideFromDiscover: true,
            hideOnlineStatus: true,
            refuseNewChats: true,
            incognito: hasFeature(tier, 'incognito'),
          }
    return {
      'privacy.hiddenMode': true,
      'settings.discoverable': !choices.hideFromDiscover,
      'privacy.hideOnlineStatus': choices.hideOnlineStatus,
      'privacy.refuseNewChats': choices.refuseNewChats,
      'privacy.incognito': choices.incognito,
    }
  }

  /*
   * One of the four, written directly. With the switch on that is the normal
   * case and needs nothing more. With it off, the screen greys them out and
   * never sends this — but a client from before the switch does, and the
   * rule that "off means nothing is hidden" has to survive it: hiding
   * anything turns the switch on.
   */
  if (wasOn) {
    /*
     * Pinned the first time it is touched while only worked out: otherwise
     * turning off the last thing hidden would make `effectiveHiddenMode` read
     * the switch as off, and a switch nobody touched would flip on its own.
     */
    return current.privacy?.hiddenMode === undefined ? { 'privacy.hiddenMode': true } : {}
  }
  const next: HiddenModeChoices = {
    ...choicesInForce(current),
    ...(request.discoverable !== undefined ? { hideFromDiscover: !request.discoverable } : {}),
    ...(request.privacy?.hideOnlineStatus !== undefined
      ? { hideOnlineStatus: request.privacy.hideOnlineStatus }
      : {}),
    ...(request.privacy?.refuseNewChats !== undefined
      ? { refuseNewChats: request.privacy.refuseNewChats }
      : {}),
    ...(request.privacy?.incognito !== undefined ? { incognito: request.privacy.incognito } : {}),
  }
  return hidesAnything(next, tier) ? { 'privacy.hiddenMode': true } : {}
}

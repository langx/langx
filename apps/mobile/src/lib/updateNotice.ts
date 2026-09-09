import { compareVersions, isVersion } from '@langx/shared'

/**
 * Whether to draw the "a new version is out" banner.
 *
 * Pure, so `vitest.config.ts` reaches it — the same split as `reviewPrompt.ts`:
 * the rule lives here, the storage and the React wiring in `UpdateBanner`.
 *
 * `dismissed` is the version whose banner was dismissed on this device, not a
 * boolean. A boolean would answer the first release and then stay answered
 * forever, which is the one thing a dismissible notice must not do: dismissing
 * 2.2.0 has to say nothing at all about 2.3.0.
 */
export function shouldShowUpdateNotice(params: {
  updateAvailable: boolean
  latest: string
  /** The version dismissed on this device, or null for "never dismissed". */
  dismissed: string | null
}): boolean {
  const { updateAvailable, latest, dismissed } = params
  if (!updateAvailable) return false
  /*
   * Anything unreadable on either side counts as not dismissed. The server has
   * already said something newer exists; a stored value we cannot compare is
   * not grounds for deciding on the user's behalf that they answered it — and
   * the cost of being wrong in this direction is one banner they dismiss
   * again, against a notice that never appears in the other.
   */
  if (!dismissed || !isVersion(dismissed) || !isVersion(latest)) return true
  return compareVersions(dismissed, latest) < 0
}

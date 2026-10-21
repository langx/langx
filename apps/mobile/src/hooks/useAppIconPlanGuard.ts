import { isPaidTier } from '@langx/shared'
import { useEffect } from 'react'
import { useEffectiveTier, useMe } from '../api/queries'
import { currentAppIcon, isSupported, setAppIcon } from '../lib/appIcon'
import { iconAfterPlan, KEEP_PRO_ICON_AFTER_PRO_ENDS } from '../lib/appIconList'

/**
 * What a Pro icon does when Pro ends, at the one place every signed-in launch
 * passes. With `KEEP_PRO_ICON_AFTER_PRO_ENDS` as decided (`true`) this does
 * nothing at all; it exists so that flipping the constant is the whole change.
 */
export function useAppIconPlanGuard({ enabled = true }: { enabled?: boolean } = {}): void {
  const me = useMe()
  const tier = useEffectiveTier()
  const loaded = me.data !== undefined
  const paid = isPaidTier(tier)

  useEffect(() => {
    if (KEEP_PRO_ICON_AFTER_PRO_ENDS || !enabled || !isSupported()) return
    const next = iconAfterPlan(currentAppIcon(), { loaded, paid })
    if (next) void setAppIcon(next)
  }, [enabled, loaded, paid])
}

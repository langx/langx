import { useCallback, useEffect, useRef } from 'react'
import { isPressedChange } from '../lib/changeHaptic'
import { selection } from '../lib/haptics'

/**
 * One selection tick when `value` changes because this control was pressed —
 * see `lib/changeHaptic.ts` for why it waits for the change rather than
 * buzzing on the press. Returns the function the control calls as it is
 * pressed.
 *
 * `value` is a string so a set of choices can be compared as one: a
 * segmented control passes its selection joined.
 */
export function useChangeHaptic(value: string): () => void {
  const pressedAt = useRef<number | null>(null)
  const previous = useRef(value)

  useEffect(() => {
    if (value === previous.current) return
    previous.current = value
    if (isPressedChange(pressedAt.current, Date.now())) void selection()
    pressedAt.current = null
  }, [value])

  return useCallback(() => {
    pressedAt.current = Date.now()
  }, [])
}

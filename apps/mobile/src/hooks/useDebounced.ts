import { useEffect, useState } from 'react'

/**
 * A value that only catches up once it has stopped changing.
 *
 * For a search box: the input stays responsive because it renders the raw
 * value, while the query key follows this one — so typing "behic" is one
 * request rather than five, and the five would arrive out of order anyway.
 *
 * Deliberately not a debounced *callback*. A callback has to be stable or the
 * timer resets on every render, which is the version of this that silently
 * never fires.
 */
export function useDebounced<T>(value: T, delayMs = 300): T {
  const [settled, setSettled] = useState(value)

  useEffect(() => {
    const timer = setTimeout(() => setSettled(value), delayMs)
    return () => clearTimeout(timer)
  }, [value, delayMs])

  return settled
}

import { useEffect, useRef, useState } from 'react'
import { Text, type StyleProp, type TextProps, type TextStyle } from 'react-native'

export interface CountUpProps extends Omit<TextProps, 'style' | 'children'> {
  value: number
  /**
   * Where the first count starts. 0 by default — the recap's numbers, the
   * gift's amount. A balance passes the value it last showed, so it rolls
   * only by what changed; passing `value` itself shows it without a count.
   */
  from?: number
  locale: string
  reduce: boolean
  /** ms. The recap's 900 unless a caller has its own token for it. */
  duration?: number
  delay?: number
  /** Drawn before the number and counted with it: the gift's "+". */
  prefix?: string
  style?: StyleProp<TextStyle>
}

/**
 * A number that counts to itself, ease-out cubic. When `value` changes later
 * it counts on from whatever it is showing, so a second change mid-roll turns
 * round where the eye is rather than jumping back to `from`.
 *
 * The one per-frame React render it allows, and bounded on purpose. A string
 * cannot be animated on the UI thread without the `TextInput` trick, which
 * the web build does not honour, so the count is a `requestAnimationFrame`
 * on the JS thread. What keeps it cheap: it runs only for `duration`, it sets
 * state only when the rounded number moves (a +13 gift renders 13 times, not
 * 36), and it is one short `Text` — never a whole screen. Screen readers get
 * the final value from the first frame, never a number in flight.
 *
 * Tabular figures, so the digits do not jostle the text beside them while
 * they change.
 */
export function CountUp({
  value,
  from = 0,
  locale,
  reduce,
  duration = 900,
  delay = 0,
  prefix = '',
  style,
  ...rest
}: CountUpProps) {
  const [shown, setShown] = useState(reduce ? value : from)
  // What is on screen right now, read when a new count starts.
  const current = useRef(shown)

  useEffect(() => {
    const show = (next: number): void => {
      current.current = next
      setShown(next)
    }
    const start = current.current
    if (reduce || start === value) {
      show(value)
      return
    }
    let frame = 0
    const began = Date.now() + delay
    const tick = (): void => {
      const t = Math.min(1, Math.max(0, (Date.now() - began) / duration))
      const next = Math.round(start + (value - start) * (1 - (1 - t) ** 3))
      // A bail-out of React's own when the number has not moved this frame.
      if (next !== current.current) show(next)
      if (t < 1) frame = requestAnimationFrame(tick)
    }
    frame = requestAnimationFrame(tick)
    return () => cancelAnimationFrame(frame)
  }, [value, reduce, delay, duration])

  return (
    <Text
      numberOfLines={1}
      {...rest}
      accessibilityLabel={`${prefix}${value.toLocaleString(locale)}`}
      style={[{ fontVariant: ['tabular-nums'] }, style]}
    >
      {prefix}
      {shown.toLocaleString(locale)}
    </Text>
  )
}

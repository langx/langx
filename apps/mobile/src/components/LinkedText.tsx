import { findLinks } from '@langx/shared'
import { useMemo } from 'react'
import { Text, type StyleProp, type TextStyle } from 'react-native'
import { openExternal } from '../lib/openExternal'
import { makeStyles } from '../lib/theme'

interface LinkedTextProps {
  children: string
  style: StyleProp<TextStyle>
  /**
   * The bubble's own long press. A link is the innermost thing under the
   * finger, so without it holding a link would open nothing at all — the same
   * trap `MessageBubble` describes for a card's buttons.
   */
  onLongPress?: () => void
}

/**
 * A message's text with its addresses tappable.
 *
 * Nested `Text` rather than a row of views, so a link wraps mid-line like the
 * words around it and the whole thing still selects as one string. A tap
 * opens the in-app browser (a new tab on the web) — the chat stays where it
 * was underneath.
 */
export function LinkedText({ children, style, onLongPress }: LinkedTextProps) {
  const styles = useStyles()
  const parts = useMemo(() => {
    const links = findLinks(children)
    if (links.length === 0) return null
    const out: { at: number; text: string; href?: string }[] = []
    let at = 0
    for (const link of links) {
      if (link.start > at) out.push({ at, text: children.slice(at, link.start) })
      out.push({ at: link.start, text: children.slice(link.start, link.end), href: link.href })
      at = link.end
    }
    if (at < children.length) out.push({ at, text: children.slice(at) })
    return out
  }, [children])

  if (!parts) return <Text style={style}>{children}</Text>
  return (
    <Text style={style}>
      {parts.map(({ at, text, href }) =>
        href ? (
          <Text
            key={at}
            accessibilityRole="link"
            style={styles.link}
            onPress={() => {
              void openExternal(href)
            }}
            {...(onLongPress ? { onLongPress } : {})}
          >
            {text}
          </Text>
        ) : (
          <Text key={at}>{text}</Text>
        ),
      )}
    </Text>
  )
}

const useStyles = makeStyles(({ colors }) => ({
  link: { color: colors.accent, textDecorationLine: 'underline' },
}))

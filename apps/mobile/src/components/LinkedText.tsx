import { useMemo } from 'react'
import { Text, type StyleProp, type TextStyle } from 'react-native'
import { internalTarget } from '../lib/internalLink'
import { linkedParts } from '../lib/linkedParts'
import { openPost, openProfile } from '../lib/navigation'
import { openExternal } from '../lib/openExternal'
import { makeStyles } from '../lib/theme'

interface LinkedTextProps {
  children: string
  style: StyleProp<TextStyle>
  /**
   * The route a profile or post opened from here comes back to — the thread
   * this text is in. Required rather than defaulted: a guessed way back is
   * the kind of wrong nobody notices until they press it.
   */
  from: string
  /**
   * The bubble's own long press. A link is the innermost thing under the
   * finger, so without it holding a link would open nothing at all — the same
   * trap `MessageBubble` describes for a card's buttons.
   */
  onLongPress?: () => void
}

/**
 * Follows one tapped run.
 *
 * A link to our own web build opens the screen it names rather than the
 * browser: the web build answers on the same paths, so the in-app browser
 * would load a second copy of the app inside this one — on a phone, one that
 * is not signed in.
 */
function follow(target: { href: string } | { handle: string }, from: string): void {
  if ('handle' in target) {
    openProfile(target.handle, from)
    return
  }
  const internal = internalTarget(target.href)
  if (internal?.kind === 'profile') openProfile(internal.handle, from)
  else if (internal?.kind === 'post') openPost(internal.id, from)
  else void openExternal(target.href)
}

/**
 * A message's text with its addresses and `@handle`s tappable.
 *
 * Nested `Text` rather than a row of views, so a link wraps mid-line like the
 * words around it and the whole thing still selects as one string. A tap on
 * an outside address opens the in-app browser (a new tab on the web) — the
 * chat stays where it was underneath.
 */
export function LinkedText({ children, style, from, onLongPress }: LinkedTextProps) {
  const styles = useStyles()
  const parts = useMemo(() => linkedParts(children), [children])

  if (!parts) return <Text style={style}>{children}</Text>
  return (
    <Text style={style}>
      {parts.map((part) =>
        'href' in part || 'handle' in part ? (
          <Text
            key={part.at}
            accessibilityRole="link"
            style={'handle' in part ? styles.mention : styles.link}
            onPress={() => follow(part, from)}
            {...(onLongPress ? { onLongPress } : {})}
          >
            {part.text}
          </Text>
        ) : (
          <Text key={part.at}>{part.text}</Text>
        ),
      )}
    </Text>
  )
}

const useStyles = makeStyles(({ colors }) => ({
  link: { color: colors.accent, textDecorationLine: 'underline' },
  // A name rather than an address, so it reads as one: no underline.
  mention: { color: colors.accent, fontWeight: '600' },
}))

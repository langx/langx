import { useMemo, useState } from 'react'
import { Text, type StyleProp, type TextStyle } from 'react-native'
import { useT } from '../i18n'
import { internalTarget } from '../lib/internalLink'
import { linkedParts, type LinkedRun } from '../lib/linkedParts'
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
 * A message's text with its addresses and `@handle`s tappable, and its
 * `*bold*`, `_italic_`, `~strikethrough~` and `||spoiler||` drawn.
 *
 * Nested `Text` rather than a row of views, so a link wraps mid-line like the
 * words around it and the whole thing still selects as one string. A tap on
 * an outside address opens the in-app browser (a new tab on the web) — the
 * chat stays where it was underneath.
 */
export function LinkedText({ children, style, from, onLongPress }: LinkedTextProps) {
  const parts = useMemo(() => linkedParts(children), [children])

  if (!parts) return <Text style={style}>{children}</Text>
  return (
    <Text style={style}>
      {parts.map((part) =>
        'spoiler' in part ? (
          <Spoiler key={part.at} runs={part.spoiler} from={from} onLongPress={onLongPress} />
        ) : (
          <Run key={part.at} run={part} from={from} onLongPress={onLongPress} />
        ),
      )}
    </Text>
  )
}

interface RunProps {
  run: LinkedRun
  from: string
  onLongPress: (() => void) | undefined
}

function Run({ run, from, onLongPress }: RunProps) {
  const styles = useStyles()
  const emphasis = run.style ? styles[run.style] : undefined
  if ('href' in run || 'handle' in run) {
    return (
      <Text
        accessibilityRole="link"
        style={['handle' in run ? styles.mention : styles.link, emphasis]}
        onPress={() => follow(run, from)}
        {...(onLongPress ? { onLongPress } : {})}
      >
        {run.text}
      </Text>
    )
  }
  return <Text style={emphasis}>{run.text}</Text>
}

/**
 * Words the sender covered, drawn as a solid bar until tapped.
 *
 * The words are still laid out underneath in a transparent colour, so the bar
 * is as long as what it hides and opening it moves nothing. Opening is local
 * to this reader and this bubble: nothing is sent, and a bubble scrolled far
 * enough away to be recycled comes back covered, which is what a spoiler is
 * for. A link inside does nothing while covered — the tap opens the spoiler,
 * not the address nobody has read yet.
 */
function Spoiler({ runs, from, onLongPress }: Omit<RunProps, 'run'> & { runs: LinkedRun[] }) {
  const styles = useStyles()
  const t = useT()
  const [open, setOpen] = useState(false)

  if (open) {
    return (
      <Text>
        {runs.map((run) => (
          <Run key={run.at} run={run} from={from} onLongPress={onLongPress} />
        ))}
      </Text>
    )
  }
  return (
    <Text
      accessibilityRole="button"
      accessibilityLabel={t('chat.spoiler')}
      style={styles.spoiler}
      onPress={() => setOpen(true)}
      {...(onLongPress ? { onLongPress } : {})}
    >
      {runs.map((run) => run.text).join('')}
    </Text>
  )
}

const useStyles = makeStyles(({ colors }) => ({
  link: { color: colors.accent, textDecorationLine: 'underline' },
  // A name rather than an address, so it reads as one: no underline.
  mention: { color: colors.accent, fontWeight: '600' },
  bold: { fontWeight: '700' },
  italic: { fontStyle: 'italic' },
  strike: { textDecorationLine: 'line-through' },
  spoiler: { color: 'transparent', backgroundColor: colors.textMuted },
}))

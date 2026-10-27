import { Nunito_900Black } from '@expo-google-fonts/nunito/900Black'
import type Feather from '@expo/vector-icons/Feather'
import { useFonts } from 'expo-font'
import { useState } from 'react'
import { Text, View } from 'react-native'
import { DISPLAY_FONT, makeStyles, useTheme } from '../../lib/theme'
import { Button } from '../ui/Button'
import { useToneField, type ProductMark, type ProductTone } from './tone'

type Glyph = keyof typeof Feather.glyphMap

/**
 * How far the product's name grows with the reader's text size. iOS grows
 * its own titles about half as far as body text at the largest sizes, for the
 * same reason: a word already this big is legible, and past about twice its
 * size a name like "Transparency" no longer fits the field and breaks in the
 * middle. The lines under it grow in full.
 */
const TITLE_MAX_SCALE = 2

/**
 * The action's label stops at the same 2×. At the largest size "introduction"
 * alone is wider than the pill on a 375pt phone and breaks in the middle; at
 * 2× it fits whole. A longer word — a German compound — still breaks, inside
 * the pill rather than past it (`Button`).
 */
const ACTION_MAX_SCALE = 2

/**
 * The mark's square. Not text, so it keeps its size at every text size. A
 * third of the field on a 375pt phone: big enough to be the first thing seen
 * and to be known before a word is read, small enough that the name and the
 * action still land on the first screen of the smallest phone.
 */
export const HERO_MARK = 112

interface ProductHeroProps {
  tone: ProductTone
  /** The product's own mark, never a stock glyph standing in for one (`ProductMark`). */
  mark: ProductMark
  /** The product's name. The page's heading, so it is read first. */
  title: string
  /** The one promise, in a line: what it is and what it does for you. */
  body: string
  /**
   * Short facts, in a quiet line under the promise: "In-app points", "Can't
   * be bought", "Can't be traded"; "Beta"; "Updated 4 minutes ago". Each one
   * a fact, never a slogan.
   */
  facts?: readonly string[]
  /**
   * The page's one action, as the ink pill. Not the yellow: a product page
   * describes, and the committing action, if one comes, belongs to the screen
   * it opens.
   */
  action?: { label: string; onPress: () => void; icon?: Glyph }
}

/**
 * The top of every product page: the product's own mark, large, on a quiet
 * wash of its colour; its name; one line; one action.
 *
 * The mark leads because it is what a person already knows — the spark beside
 * every balance, Venus's face on Home — so the page is recognised before a
 * word is read. Everything else is centred under it and set no louder than it
 * needs to be, and nothing on the field is there to decorate: no chips, no
 * second colour, no glyph that is not the product's own.
 *
 * The action hugs its label rather than spanning the field. A bar across the
 * field would be the heaviest shape in it, and the mark is meant to be.
 */
export function ProductHero({ tone, mark: Mark, title, body, facts, action }: ProductHeroProps) {
  const styles = useStyles()
  const { v3 } = useTheme()
  const field = useToneField(tone)
  // Loaded here rather than at the root, as every screen that draws it does:
  // a cold start should not wait for a face most launches never show.
  const [black] = useFonts({ Nunito_900Black })

  return (
    <View style={[styles.field, { backgroundColor: field }]}>
      {/* The name below says what this is; the mark is the picture of it. */}
      <View
        style={styles.mark}
        accessibilityElementsHidden
        importantForAccessibility="no-hide-descendants"
      >
        <Mark size={HERO_MARK} color={v3.colors.fg} />
      </View>
      <View style={styles.words}>
        <Text
          style={[styles.title, !black && styles.titleFallback]}
          accessibilityRole="header"
          maxFontSizeMultiplier={TITLE_MAX_SCALE}
        >
          {title}
        </Text>
        <Text style={styles.body}>{body}</Text>
        {facts && facts.length > 0 ? <Facts facts={facts} /> : null}
      </View>
      {action ? (
        <Button
          label={action.label}
          variant="ink"
          size="medium"
          {...(action.icon ? { icon: action.icon } : {})}
          maxFontSizeMultiplier={ACTION_MAX_SCALE}
          onPress={action.onPress}
          style={styles.action}
        />
      ) : null}
    </View>
  )
}

/**
 * The facts, with a dot between two that share a line and none where the
 * line breaks. A dot on the end of each fact would hang at the edge of every
 * wrapped line ("Can't be bought ·"), and the line wraps in most languages and
 * at every large text size. So each fact reports the line it landed on, and
 * the dot before it is drawn only when the fact before it is on the same one.
 *
 * The dot is drawn, not typed: a screen reader reads each fact as its own
 * item and never says it. It sits in the gap between two facts rather than
 * taking room of its own, so showing it cannot push a fact onto the next line.
 */
function Facts({ facts }: { facts: readonly string[] }) {
  const styles = useStyles()
  const [lines, setLines] = useState<readonly number[]>([])

  return (
    <View style={styles.facts}>
      {facts.map((fact, index) => (
        <View
          key={fact}
          style={styles.fact}
          onLayout={(event) => {
            const y = Math.round(event.nativeEvent.layout.y)
            setLines((current) => {
              if (current[index] === y) return current
              const next = [...current]
              next[index] = y
              return next
            })
          }}
        >
          {index > 0 && lines[index] !== undefined && lines[index] === lines[index - 1] ? (
            <View style={styles.dotSlot}>
              <View style={styles.dot} />
            </View>
          ) : null}
          <Text style={styles.factText}>{fact}</Text>
        </View>
      ))}
    </View>
  )
}

/** The dot between two facts. */
const DOT = 4

/** About thirty-five characters of body text: the promise's longest line. */
const PROMISE_MEASURE = 280

const useStyles = makeStyles(({ v3 }) => ({
  field: {
    alignItems: 'center',
    borderRadius: v3.radius.hero,
    paddingHorizontal: v3.space[20],
    paddingVertical: v3.space[32],
  },
  mark: {
    alignItems: 'center',
    height: HERO_MARK,
    justifyContent: 'center',
    marginBottom: v3.space[24],
    width: HERO_MARK,
  },
  words: { alignSelf: 'stretch', gap: v3.space[8] },
  title: { ...v3.type.title, color: v3.colors.fg, textAlign: 'center' },
  // ExtraBold at Black's size until Black has loaded, so the line does not
  // reflow when the face arrives — only thickens.
  titleFallback: { fontFamily: DISPLAY_FONT },
  // Held to a short measure. A centred line reads best at about thirty-five
  // characters, and without one the promise breaks wherever the phone's width
  // runs out — on a wide phone that left a lone "the app." under a full line.
  body: {
    ...v3.type.body,
    alignSelf: 'center',
    color: v3.colors.fg,
    maxWidth: PROMISE_MEASURE,
    textAlign: 'center',
  },
  facts: {
    columnGap: v3.space[20],
    flexDirection: 'row',
    flexWrap: 'wrap',
    justifyContent: 'center',
    rowGap: v3.space[2],
  },
  // `maxWidth`: at the largest text sizes one fact is wider than the field,
  // and it should wrap in place rather than run off the edge.
  fact: { maxWidth: '100%' },
  factText: { ...v3.type.label, color: v3.colors.muted, textAlign: 'center' },
  // In the middle of the gap before its fact, and of the fact's height. A
  // fact never wraps inside itself while it shares a line — wrapping means it
  // took the whole width — so its middle is its one line's, at any text size.
  dotSlot: {
    bottom: 0,
    justifyContent: 'center',
    position: 'absolute',
    start: -(v3.space[20] + DOT) / 2,
    top: 0,
  },
  dot: { backgroundColor: v3.colors.muted, borderRadius: v3.radius.pill, height: DOT, width: DOT },
  // `width: 'auto'` undoes the button's own full-width default; `maxWidth`
  // keeps a label grown past the field inside it.
  action: { marginTop: v3.space[24], maxWidth: '100%', width: 'auto' },
}))

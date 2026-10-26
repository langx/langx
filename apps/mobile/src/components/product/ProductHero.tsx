import { Nunito_900Black } from '@expo-google-fonts/nunito/900Black'
import Feather from '@expo/vector-icons/Feather'
import { useFonts } from 'expo-font'
import type { ReactElement } from 'react'
import { Text, View } from 'react-native'
import { DISPLAY_FONT, makeStyles, useTheme } from '../../lib/theme'
import { Button } from '../ui/Button'
import { useToneColors, type ProductTone } from './tone'

type Glyph = keyof typeof Feather.glyphMap

/**
 * How far the product's name grows with the reader's text size. iOS grows
 * its own titles about half as far as body text at the largest sizes, for the
 * same reason: a word already this big is legible, and past about twice its
 * size a name like "Transparency" no longer fits the block and breaks in the
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

interface ProductHeroProps {
  tone: ProductTone
  /**
   * A Feather glyph, set in an ink disc in the tone's colour — `award` for
   * LangX Token, `bar-chart-2` for Transparency. Or a ready element, for a
   * mark that is a picture of its own: Venus's face.
   */
  mark: Glyph | ReactElement
  /** The product's name. The page's heading, so it is read first. */
  title: string
  /**
   * Short facts as pills under the name: "Beta"; "In-app points", "Can't be
   * bought", "Can't be traded". Each one a fact, never a slogan.
   */
  tags?: readonly string[]
  /** One line on what it is. */
  body: string
  /** A quieter line under it: "Part of Pro", "Updated 4 minutes ago". */
  note?: string
  /**
   * The ink pill on the hero's colour. Not the yellow: a product page
   * describes, and the one committing action on it, if it has one, belongs
   * to the page.
   */
  action?: { label: string; onPress: () => void; icon?: Glyph }
}

/**
 * The top of every product page: the product's colour, its mark and its name.
 *
 * One block in the tone, as `HeroTile` is for a figure — this one is for a
 * name, so it carries words where that carries a number. What is on it takes
 * the tone's own text colour (`useToneColors`), so the page picks a colour and
 * never a text colour.
 */
export function ProductHero({ tone, mark, title, tags, body, note, action }: ProductHeroProps) {
  const styles = useStyles()
  const { v3 } = useTheme()
  const { ground, on } = useToneColors(tone)
  // Loaded here rather than at the root, as every screen that draws it does:
  // a cold start should not wait for a face most launches never show.
  const [black] = useFonts({ Nunito_900Black })

  return (
    <View style={[styles.hero, { backgroundColor: ground }]}>
      {typeof mark === 'string' ? (
        <View style={styles.disc}>
          <Feather name={mark} size={v3.icon.xxl} color={ground} />
        </View>
      ) : (
        mark
      )}
      <View style={styles.words}>
        <Text
          style={[styles.title, !black && styles.titleFallback, { color: on }]}
          accessibilityRole="header"
          maxFontSizeMultiplier={TITLE_MAX_SCALE}
        >
          {title}
        </Text>
        {tags && tags.length > 0 ? (
          <View style={styles.tags}>
            {tags.map((tag) => (
              <View key={tag} style={styles.tag}>
                <Text style={[styles.tagText, { color: on }]}>{tag}</Text>
              </View>
            ))}
          </View>
        ) : null}
        <Text style={[styles.body, { color: on }]}>{body}</Text>
        {note ? <Text style={[styles.note, { color: on }]}>{note}</Text> : null}
      </View>
      {action ? (
        <Button
          label={action.label}
          variant="hue"
          size="medium"
          {...(action.icon ? { icon: action.icon } : {})}
          maxFontSizeMultiplier={ACTION_MAX_SCALE}
          onPress={action.onPress}
        />
      ) : null}
    </View>
  )
}

/** The mark's disc. Not text, so it keeps its size whatever the reader's text size. */
const DISC = 56

const useStyles = makeStyles(({ v3 }) => ({
  hero: {
    borderRadius: v3.radius.hero,
    gap: v3.space[16],
    paddingHorizontal: v3.space[20],
    paddingVertical: v3.space[20],
  },
  // Ink in both schemes, like everything on a hue; the glyph takes the hero's
  // own colour, so the mark reads as cut out of the block.
  disc: {
    alignItems: 'center',
    backgroundColor: v3.colors.ink,
    borderRadius: v3.radius.pill,
    height: DISC,
    justifyContent: 'center',
    width: DISC,
  },
  words: { gap: v3.space[8] },
  title: v3.type.title,
  // ExtraBold at Black's size until Black has loaded, so the line does not
  // reflow when the face arrives — only thickens.
  titleFallback: { fontFamily: DISPLAY_FONT },
  tags: { flexDirection: 'row', flexWrap: 'wrap', gap: v3.space[6] },
  // Ink washed over the tone rather than an outline: a chip on a coloured
  // block, as the call stage draws its own.
  // `maxWidth`: at the largest text sizes one fact is wider than the block,
  // and it should wrap inside its pill rather than run off the hero's edge.
  // `radius.icon` rather than `pill` for the same case: 12 is half a one-line
  // tag at the default size (a 16pt line, 4 above and below), so there it is
  // the same pill, but a fact wrapped onto two lines keeps rounded corners
  // instead of becoming a stadium whose curves crowd its first and last letters.
  tag: {
    backgroundColor: v3.colors.hueWash,
    borderRadius: v3.radius.icon,
    maxWidth: '100%',
    paddingHorizontal: v3.space[10],
    paddingVertical: v3.space[4],
  },
  tagText: v3.type.label,
  body: { ...v3.type.body, fontWeight: '600' },
  note: { ...v3.type.caption, fontWeight: '600' },
}))

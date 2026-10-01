import Feather from '@expo/vector-icons/Feather'
import { recapHighlights } from '@langx/shared'
import { Text, View, type TextStyle } from 'react-native'
import type { TranslateFn } from '../../i18n'
import {
  isYearRecap,
  numeralSize,
  recapCalendar,
  recapLabel,
  yearCalendar,
  type RecapSlide,
  type StoryRecap,
} from '../../lib/recapStory'
import { palettes, type ColorScheme } from '../../lib/theme'
import { Avatar } from '../ui/Avatar'
import { CountUp, Disc, Pop, RISE_DELAYS, Rise } from './motion'

/**
 * The six slides of "Your Month", as designed in Claude Design.
 *
 * Each slide owns one ground colour and one number. The grounds are the
 * light scheme's brand colours in **both** schemes — a story is a poster,
 * and a poster that goes grey after dark is a different poster — with one
 * exception: the white Echo slide, which would be a flashlight at night, takes
 * the dark ground and the dark scheme's blue.
 */

const light = palettes.light.colors
const dark = palettes.dark.colors

export interface SlideLook {
  ground: string
  /** Text, the progress fill, the close glyph. */
  ink: string
  /** Kickers and small print. */
  muted: string
  /** The big numeral, where it is not `ink`. */
  numeral: string
  /** The unfilled part of a progress bar. */
  track: string
  /** Behind the close button. */
  chrome: string
  /** The status bar's style over this ground. */
  bar: 'light' | 'dark'
  /**
   * The two arcs alone on a coloured ground, the yellow tile on white or
   * near-black — where the arcs' own black or white half would vanish.
   */
  mark: 'arcs' | 'tile'
}

// Derived from the ink rather than tokens of their own: a track and a chip
// are the ink at low strength, whichever ink the ground asks for.
const ON_DARK = {
  muted: 'rgba(255, 255, 255, 0.78)',
  track: 'rgba(255, 255, 255, 0.35)',
  chrome: 'rgba(255, 255, 255, 0.18)',
  bar: 'light',
  mark: 'arcs',
} as const
const ON_LIGHT = {
  track: 'rgba(23, 25, 28, 0.18)',
  chrome: 'rgba(23, 25, 28, 0.08)',
  bar: 'dark',
  mark: 'arcs',
} as const

export function slideLook(slide: RecapSlide, scheme: ColorScheme): SlideLook {
  switch (slide) {
    case 'intro':
      return {
        ground: light.primary,
        ink: light.primaryText,
        muted: light.primaryTextMuted,
        numeral: light.primaryText,
        ...ON_LIGHT,
      }
    case 'corrections':
      // A correction is green everywhere in the app, never blue.
      return {
        ground: light.success,
        ink: light.textInverse,
        numeral: light.textInverse,
        ...ON_DARK,
      }
    case 'echo':
      return scheme === 'dark'
        ? {
            ...ON_DARK,
            ground: dark.bg,
            ink: dark.text,
            muted: dark.textMuted,
            numeral: dark.accent,
            mark: 'tile',
          }
        : {
            ground: light.bg,
            ink: light.text,
            muted: light.textMuted,
            numeral: light.accent,
            ...ON_LIGHT,
            mark: 'tile',
          }
    case 'streak':
      // Dark ink on the orange: white on it fails contrast at body size.
      return {
        ground: light.streak,
        ink: light.primaryText,
        muted: light.primaryTextMuted,
        numeral: light.primaryText,
        ...ON_LIGHT,
      }
    case 'messages':
    case 'summary':
      return {
        ground: light.accent,
        ink: light.textInverse,
        numeral: light.textInverse,
        ...ON_DARK,
      }
  }
}

/** What every slide needs to lay itself out. */
export interface SlideProps {
  recap: StoryRecap
  look: SlideLook
  t: TranslateFn
  locale: string
  rtl: boolean
  reduce: boolean
  /** Scale against the 390×844 the design was drawn at. */
  k: number
  /** The width text can use. */
  width: number
  /** Nunito Black once it has loaded, the display face until then. */
  black: string
  display: string
  /** The headline: the month's name, or on a year's story the year. */
  month: string
  /** Beside the kicker; empty on a year's story, where it is the headline. */
  year: string
}

function kicker(props: SlideProps, text: string): TextStyle & { text: string } {
  return {
    text: props.rtl ? text : text.toLocaleUpperCase(props.locale),
    color: props.look.muted,
    fontFamily: props.display,
    fontSize: 13 * props.k,
    // Tracking only where there are capitals to track: spaced-out Arabic
    // breaks the joins between its letters.
    letterSpacing: props.rtl ? 0 : 1.8 * props.k,
  }
}

function Kicker({ props, text }: { props: SlideProps; text: string }) {
  const { text: shown, ...style } = kicker(props, text)
  return (
    <Rise delay={RISE_DELAYS[0]} reduce={props.reduce}>
      <Text style={style}>{shown}</Text>
    </Rise>
  )
}

/** The slide's number: as large as the design's 150pt, or as the screen allows. */
function BigNumber({ props, value, color }: { props: SlideProps; value: number; color?: string }) {
  const size = numeralSize(value.toLocaleString(props.locale), props.width, 150 * props.k)
  return (
    <Rise delay={RISE_DELAYS[1]} reduce={props.reduce} style={{ marginTop: 'auto' }}>
      <CountUp
        value={value}
        locale={props.locale}
        reduce={props.reduce}
        delay={RISE_DELAYS[1]}
        style={{
          color: color ?? props.look.numeral,
          fontFamily: props.black,
          fontSize: size,
          fontVariant: ['tabular-nums'],
          // A string of digits has no direction of its own, so the web build's
          // `dir="auto"` sets it left to right and pins it to the left in Arabic.
          writingDirection: props.rtl ? 'rtl' : 'ltr',
          // Tight tracking pulls the last digit past the end of its box; right to
          // left that end is the clipped one, so the numeral is left as drawn.
          letterSpacing: props.rtl ? 0 : -0.06 * size,
          lineHeight: size * 0.95,
        }}
      />
    </Rise>
  )
}

function Line({ props, text, delay }: { props: SlideProps; text: string; delay: number }) {
  return (
    <Rise delay={delay} reduce={props.reduce} style={{ marginTop: 14 * props.k }}>
      <Text
        style={{
          color: props.look.ink,
          fontFamily: props.display,
          fontSize: 26 * props.k,
          letterSpacing: props.rtl ? 0 : -0.5,
          lineHeight: 30 * props.k,
        }}
      >
        {text}
      </Text>
    </Rise>
  )
}

function small(props: SlideProps, color?: string): TextStyle {
  return {
    color: color ?? props.look.muted,
    fontSize: 15 * props.k,
    fontWeight: '500',
    lineHeight: 22 * props.k,
  }
}

function IntroSlide(props: SlideProps) {
  const { k, look, t } = props
  const size = Math.min(78 * k, numeralSize(props.month, props.width, 78 * k))
  return (
    <>
      <Disc
        size={300 * k}
        color={light.accent}
        reduce={props.reduce}
        style={{ end: -90 * k, top: 120 * k }}
      />
      <Disc
        size={150 * k}
        color={light.bg}
        reduce={props.reduce}
        duration={7000}
        style={{ bottom: 170 * k, start: -60 * k }}
      />
      <View style={{ marginTop: 'auto' }}>
        <Kicker
          props={props}
          text={
            isYearRecap(props.recap)
              ? t('recap.year.introKicker')
              : `${t('recap.story.introKicker')} · ${props.year}`
          }
        />
      </View>
      <Rise delay={RISE_DELAYS[1]} reduce={props.reduce} style={{ marginTop: 12 * k }}>
        <Text
          style={{
            color: look.ink,
            fontFamily: props.black,
            fontSize: size,
            letterSpacing: props.rtl ? 0 : -0.045 * size,
            lineHeight: size * 1.05,
          }}
        >
          {props.month}
        </Text>
      </Rise>
      <Rise delay={RISE_DELAYS[2]} reduce={props.reduce} style={{ marginTop: 16 * k }}>
        <Text
          style={{
            color: look.ink,
            fontFamily: props.display,
            fontSize: 26 * k,
            lineHeight: 30 * k,
            maxWidth: 280 * k,
          }}
        >
          {isYearRecap(props.recap) ? t('recap.year.introLine') : t('recap.story.introLine')}
        </Text>
      </Rise>
      <Rise delay={RISE_DELAYS[3]} reduce={props.reduce} style={{ marginTop: 18 * k }}>
        <Text style={small(props)}>{t('recap.story.introHint')}</Text>
      </Rise>
    </>
  )
}

function MessagesSlide(props: SlideProps) {
  const { recap, t, k } = props
  return (
    <>
      <Kicker props={props} text={t('recap.story.messagesKicker')} />
      <BigNumber props={props} value={recap.messages} />
      <Line
        props={props}
        text={t('recap.story.messagesLine', { count: recap.messages })}
        delay={RISE_DELAYS[2]}
      />
      {recap.partners > 0 ? (
        <Rise
          delay={RISE_DELAYS[3]}
          reduce={props.reduce}
          style={{ alignItems: 'center', flexDirection: 'row', gap: 12 * k, marginTop: 26 * k }}
        >
          {/* A glyph, not a stack of faces: the recap carries a count of people,
              not who they were, and drawing initials would be making them up. */}
          <View
            style={{
              alignItems: 'center',
              backgroundColor: light.primary,
              borderRadius: 17 * k,
              height: 34 * k,
              justifyContent: 'center',
              width: 34 * k,
            }}
          >
            <Feather name="users" size={17 * k} color={light.primaryText} />
          </View>
          <Text style={small(props, props.look.ink)}>
            {t('recap.story.people', { count: recap.partners })}
          </Text>
        </Rise>
      ) : null}
    </>
  )
}

function CorrectionsSlide(props: SlideProps) {
  const { recap, t, k } = props
  return (
    <>
      <Kicker props={props} text={t('recap.story.correctionsKicker')} />
      {/* The design's bubble held a real correction; the recap has none to
          show, so the mark stands in for it rather than a made-up sentence. */}
      <Pop delay={RISE_DELAYS[1]} reduce={props.reduce} style={{ marginTop: 40 * k }}>
        <View
          style={{
            alignItems: 'center',
            backgroundColor: light.bg,
            borderRadius: 22 * k,
            height: 72 * k,
            justifyContent: 'center',
            width: 72 * k,
          }}
        >
          <Feather name="check" size={36 * k} color={light.success} />
        </View>
      </Pop>
      <BigNumber props={props} value={recap.corrections} />
      <Line
        props={props}
        text={t('recap.story.correctionsLine', { count: recap.corrections })}
        delay={RISE_DELAYS[3]}
      />
    </>
  )
}

function EchoSlide(props: SlideProps & { scheme: ColorScheme }) {
  const { recap, t, k, scheme } = props
  const palette = scheme === 'dark' ? dark : light
  const card = {
    borderRadius: 22 * k,
    height: 140 * k,
    position: 'absolute',
    width: 230 * k,
  } as const
  return (
    <>
      <Kicker props={props} text={t('recap.story.echoKicker')} />
      <Rise
        delay={RISE_DELAYS[1]}
        reduce={props.reduce}
        style={{ height: 190 * k, marginTop: 34 * k }}
      >
        <View
          style={[
            card,
            { backgroundColor: palette.accentBg, start: 30 * k, top: 24 * k },
            { transform: [{ rotate: '-7deg' }] },
          ]}
        />
        <View
          style={[
            card,
            { backgroundColor: palette.fill, start: 60 * k, top: 12 * k },
            { transform: [{ rotate: '4deg' }] },
          ]}
        />
        <Pop
          delay={RISE_DELAYS[2]}
          reduce={props.reduce}
          style={{
            alignItems: 'center',
            backgroundColor: light.accent,
            borderRadius: 22 * k,
            height: 150 * k,
            justifyContent: 'center',
            position: 'absolute',
            start: 44 * k,
            top: 18 * k,
            width: 240 * k,
          }}
        >
          {/* The Echo tab's own glyph: no word from the deck is on the recap. */}
          <Feather name="repeat" size={48 * k} color={light.textInverse} />
        </Pop>
      </Rise>
      <BigNumber props={props} value={recap.echoReviews} />
      <Line
        props={props}
        text={t('recap.story.echoLine', { count: recap.echoReviews })}
        delay={RISE_DELAYS[3]}
      />
    </>
  )
}

function StreakSlide(props: SlideProps) {
  const { recap, t, k } = props
  const yearly = isYearRecap(recap)
  const streaking = recap.currentStreak > 0
  // A month is a week-wide calendar of days; a year, two rows of six months.
  const columns = yearly ? 6 : 7
  const cell = Math.floor((Math.min(300 * k, props.width) - 6 * columns * k) / columns)
  const fill = {
    streak: light.primaryText,
    active: 'rgba(32, 25, 0, 0.32)',
    idle: 'rgba(32, 25, 0, 0.1)',
  } as const
  // A month's square is as dark as the share of its days that were active.
  const squares = yearly
    ? yearCalendar(recap).map((share) =>
        share > 0 ? `rgba(32, 25, 0, ${(0.25 + 0.75 * share).toFixed(2)})` : fill.idle,
      )
    : recapCalendar(recap).map((state) => fill[state])
  const activeLine = yearly ? 'recap.year.activeDaysLine' : 'recap.story.activeDaysLine'
  const onlyLine = yearly ? 'recap.year.activeDaysOnlyLine' : 'recap.story.activeDaysOnlyLine'
  const line = streaking
    ? `${t('recap.story.streakLine', { count: recap.currentStreak })} ${
        recap.activeDays > 0 ? t(activeLine, { count: recap.activeDays }) : ''
      }`.trim()
    : t(onlyLine, { count: recap.activeDays })
  return (
    <>
      <Kicker props={props} text={t('recap.story.streakKicker')} />
      <Rise
        delay={RISE_DELAYS[1]}
        reduce={props.reduce}
        style={{
          flexDirection: 'row',
          flexWrap: 'wrap',
          gap: 6 * k,
          marginTop: 34 * k,
          width: cell * columns + 6 * (columns - 1) * k,
        }}
      >
        {squares.map((color, index) => (
          <View
            // The day of the month, or the month of the year: a calendar
            // square has nothing else to it.
            key={index + 1}
            style={{ backgroundColor: color, borderRadius: 8 * k, height: cell, width: cell }}
          />
        ))}
      </Rise>
      <BigNumber props={props} value={streaking ? recap.currentStreak : recap.activeDays} />
      <Line props={props} text={line} delay={RISE_DELAYS[3]} />
    </>
  )
}

/**
 * The last slide is the share card itself, drawn natively: the same four
 * numbers `recapHighlights` picks for the server's picture, so what somebody
 * sees here is what they are about to post.
 */
function SummarySlide(
  props: SlideProps & {
    me: { handle: string; displayName: string; avatarUrl?: string; _id: string } | undefined
    languages?: string
  },
) {
  const { recap, t, k, me } = props
  const stats = recapHighlights(recap)
  const size = numeralSize(props.month, props.width, 54 * k)
  const tileWidth = (props.width - 10 * k) / 2
  return (
    <>
      {me ? (
        <Rise
          delay={RISE_DELAYS[0]}
          reduce={props.reduce}
          style={{ alignItems: 'center', flexDirection: 'row', gap: 12 * k }}
        >
          <Avatar url={me.avatarUrl} name={me.displayName} seed={me._id} size={44 * k} />
          <View style={{ flexShrink: 1, gap: 3 }}>
            <Text style={{ color: props.look.ink, fontFamily: props.display, fontSize: 17 * k }}>
              @{me.handle}
            </Text>
            {props.languages ? (
              <Text numberOfLines={1} style={[small(props), { fontSize: 13 * k }]}>
                {props.languages}
              </Text>
            ) : null}
          </View>
        </Rise>
      ) : null}
      <Rise delay={RISE_DELAYS[1]} reduce={props.reduce} style={{ marginTop: 20 * k }}>
        <Text
          style={{
            color: props.look.ink,
            fontFamily: props.black,
            fontSize: size,
            letterSpacing: props.rtl ? 0 : -0.045 * size,
            lineHeight: size * 1.05,
          }}
        >
          {props.month}
        </Text>
      </Rise>
      <Rise
        delay={RISE_DELAYS[2]}
        reduce={props.reduce}
        style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 10 * k, marginTop: 18 * k }}
      >
        {stats.map((stat, index) => {
          const yellow = index === 0
          const numeral = yellow
            ? light.primaryText
            : stat === 'currentStreak'
              ? light.streak
              : light.accent
          const value = recap[stat].toLocaleString(props.locale)
          const width = stats.length === 3 && index === 0 ? props.width : tileWidth
          const tileNumber = numeralSize(value, width - 32 * k, 54 * k)
          return (
            <View
              key={stat}
              style={{
                backgroundColor: yellow ? light.primary : light.bg,
                borderRadius: 22 * k,
                gap: 6 * k,
                justifyContent: 'space-between',
                minHeight: 118 * k,
                paddingBottom: 14 * k,
                paddingHorizontal: 16 * k,
                paddingTop: 16 * k,
                width,
              }}
            >
              <Text
                style={{
                  color: numeral,
                  fontFamily: props.black,
                  fontSize: tileNumber,
                  fontVariant: ['tabular-nums'],
                  writingDirection: props.rtl ? 'rtl' : 'ltr',
                  letterSpacing: props.rtl ? 0 : -0.05 * tileNumber,
                  // Nunito Black's digits stand taller than its em: a line the
                  // size of the font clipped their tops on iOS.
                  lineHeight: tileNumber * 1.2,
                }}
              >
                {value}
              </Text>
              <Text
                style={{
                  color: yellow ? light.primaryText : light.text,
                  fontFamily: props.display,
                  fontSize: 14 * k,
                  lineHeight: 16 * k,
                }}
              >
                {recapLabel(t, stat, recap[stat])}
              </Text>
            </View>
          )
        })}
      </Rise>
    </>
  )
}

export function Slide(
  props: SlideProps & {
    slide: RecapSlide
    scheme: ColorScheme
    me: { handle: string; displayName: string; avatarUrl?: string; _id: string } | undefined
    languages?: string
  },
) {
  switch (props.slide) {
    case 'intro':
      return <IntroSlide {...props} />
    case 'messages':
      return <MessagesSlide {...props} />
    case 'corrections':
      return <CorrectionsSlide {...props} />
    case 'echo':
      return <EchoSlide {...props} />
    case 'streak':
      return <StreakSlide {...props} />
    case 'summary':
      return <SummarySlide {...props} />
  }
}

import badge from '../assets/splash/badge.png'
import { countedToday } from '../src/lib/companionSnapshot'
import { palettes, radius } from '../src/lib/theme/tokens'
import type { CompanionSnapshot } from '@langx/shared'
import { FlexWidget, ImageWidget, TextWidget } from 'react-native-android-widget'

/*
 The Android half of the widget contract, and the place where Android is
 simply easier than iOS: a widget here is rendered by the app's own JS, in a
 headless task, so it imports `countedToday` and the theme tokens rather than
 restating them. The Swift side of this (`targets/widget/LangXWidget.swift`)
 has both written out by hand because an app extension cannot import either —
 which is why the rule it copies is tested on this side.

 What it draws is deliberately the same as iOS: the streak dimmed until the day
 counts, three numbers in the wide one, and the mark alone when there is no
 snapshot. See `docs/plans/iphone-watch-and-carplay.md` → _The widgets, in
 detail_ for why the widget never calls the API.
*/

/** The two the app supports. Must match the names in `app.config.ts`. */
export const WIDGET_NAMES = {
  streak: 'LangXStreak',
  summary: 'LangXSummary',
  activity: 'LangXActivity',
} as const

export type WidgetName = (typeof WIDGET_NAMES)[keyof typeof WIDGET_NAMES]

export type WidgetTheme = 'light' | 'dark'

function palette(theme: WidgetTheme) {
  return palettes[theme].colors
}

/**
 * A design token as the widget primitives want it.
 *
 * They type colours as `` `#${string}` ``; `ThemeColors` maps over the light
 * palette and comes out as `string`, so the two do not meet. Every value in
 * that palette is a hex literal, which makes this a narrowing rather than a
 * claim — and it is made once here instead of at seven call sites.
 */
function hex(token: string): `#${string}` {
  return token as `#${string}`
}

/**
 * What both families draw when there is no snapshot: signed out, or an app that
 * has not been opened since the widget was added. The mark and nothing else — a
 * number here would be a claim we cannot make, and a sentence here would be the
 * one untranslated string in an app that speaks eight languages.
 */
function EmptyState({ theme }: { theme: WidgetTheme }) {
  return (
    <FlexWidget
      style={{
        height: 'match_parent',
        width: 'match_parent',
        alignItems: 'center',
        justifyContent: 'center',
        backgroundColor: hex(palette(theme).bg),
        borderRadius: radius.xl,
      }}
      clickAction="OPEN_APP"
    >
      <ImageWidget image={badge} imageWidth={44} imageHeight={44} resizeMode="contain" />
    </FlexWidget>
  )
}

/**
 * The mark and the name, above the numbers.
 *
 * The iOS medium widget draws the same row for the same reason: a widget sits
 * among other apps' widgets on somebody's wallpaper, and the one question a
 * glance has to answer before the numbers mean anything is whose they are.
 *
 * "LangX" is a proper noun, which is why it is written rather than translated
 * — the same reasoning as the `label` these widgets are registered under in
 * `app.config.ts`.
 */
function Header({ theme }: { theme: WidgetTheme }) {
  return (
    <FlexWidget style={{ flexDirection: 'row', alignItems: 'center', marginBottom: 8 }}>
      <FlexWidget
        style={{
          backgroundColor: hex(palette(theme).primary),
          borderRadius: radius.sm,
          padding: 3,
          marginRight: 6,
        }}
      >
        <ImageWidget image={badge} imageWidth={14} imageHeight={14} resizeMode="contain" />
      </FlexWidget>
      <TextWidget
        text="LangX"
        style={{ fontSize: 13, fontWeight: 'bold', color: hex(palette(theme).textMuted) }}
      />
    </FlexWidget>
  )
}

/**
 * One number and its word, on a ground of their own.
 *
 * The card is what makes the wide widget read as three answers rather than a
 * sentence — see `docs/plans/iphone-watch-and-carplay/iphone.png`, which the
 * iOS tiles are drawn to as well. It matters more on a widget than in the app:
 * this is read in a glance, against a photograph, and three numbers sharing
 * one background merge into a row of digits at arm's length.
 */
function Tile({
  value,
  label,
  tint,
  theme,
  uri,
}: {
  value: number
  label: string
  tint: `#${string}`
  theme: WidgetTheme
  uri: string
}) {
  return (
    <FlexWidget
      style={{
        flex: 1,
        alignItems: 'center',
        justifyContent: 'center',
        paddingVertical: 10,
        marginHorizontal: 3,
        backgroundColor: hex(palette(theme).fill),
        borderRadius: radius.lg,
      }}
      /*
       Each tile is its own link rather than the whole widget being one: the
       three numbers answer three different questions, and tapping "unread" to
       land on a streak page is the kind of small lie that makes people stop
       tapping widgets.
      */
      clickAction="OPEN_URI"
      clickActionData={{ uri }}
    >
      <TextWidget text={String(value)} style={{ fontSize: 26, fontWeight: 'bold', color: tint }} />
      <TextWidget
        text={label}
        maxLines={1}
        truncate="END"
        style={{ fontSize: 12, color: hex(palette(theme).textMuted) }}
      />
    </FlexWidget>
  )
}

/**
 * `#rrggbb` at a given opacity, as a widget colour.
 *
 * The primitives take a hex string and have no opacity of their own, so the
 * dim SwiftUI gets from `.opacity(0.45)` has to be written into the colour.
 *
 * **Alpha goes last.** Android's own format puts it first (`#aarrggbb`) and
 * writing it that way is the obvious mistake: the library takes CSS order and
 * rotates it for you, so an already-rotated colour is rotated twice. `0.45`
 * came out at about three percent — the number was on the widget, drawn in a
 * colour close enough to invisible that it read as a missing value rather than
 * a dim one.
 */
function fade(color: string, alpha: number): `#${string}` {
  const byte = Math.round(alpha * 255)
    .toString(16)
    .padStart(2, '0')
  return `#${color.replace('#', '')}${byte}`
}

/** The streak, and whether today is safe. The one a person glances at. */
export function StreakWidget({
  snapshot,
  theme,
}: {
  snapshot: CompanionSnapshot | null
  theme: WidgetTheme
}) {
  if (!snapshot) return <EmptyState theme={theme} />
  const colors = palette(theme)
  const counted = countedToday(snapshot)

  return (
    <FlexWidget
      style={{
        height: 'match_parent',
        width: 'match_parent',
        alignItems: 'center',
        justifyContent: 'center',
        backgroundColor: hex(colors.bg),
        borderRadius: radius.xl,
      }}
      clickAction="OPEN_URI"
      clickActionData={{ uri: 'langx:///me' }}
    >
      <TextWidget
        text={String(snapshot.streak.current)}
        style={{
          fontSize: 34,
          fontWeight: 'bold',
          color: counted ? hex(colors.streak) : fade(colors.streak, 0.45),
        }}
      />
      <TextWidget
        text={snapshot.labels.streak}
        maxLines={1}
        truncate="END"
        style={{ fontSize: 12, color: hex(colors.textMuted) }}
      />
    </FlexWidget>
  )
}

/** Streak, unread and cards due — each number its own link into its own tab. */
export function SummaryWidget({
  snapshot,
  theme,
}: {
  snapshot: CompanionSnapshot | null
  theme: WidgetTheme
}) {
  if (!snapshot) return <EmptyState theme={theme} />
  const colors = palette(theme)
  const counted = countedToday(snapshot)

  return (
    <FlexWidget
      style={{
        height: 'match_parent',
        width: 'match_parent',
        flexDirection: 'column',
        justifyContent: 'center',
        paddingHorizontal: 10,
        paddingVertical: 10,
        backgroundColor: hex(colors.bg),
        borderRadius: radius.xl,
      }}
    >
      <Header theme={theme} />
      <FlexWidget style={{ flexDirection: 'row', alignItems: 'center', width: 'match_parent' }}>
        <Tile
          value={snapshot.streak.current}
          label={snapshot.labels.streak}
          tint={counted ? hex(colors.streak) : fade(colors.streak, 0.45)}
          theme={theme}
          uri="langx:///me"
        />
        <Tile
          value={snapshot.unread}
          label={snapshot.labels.unread}
          tint={hex(colors.accent)}
          theme={theme}
          uri="langx:///chats"
        />
        <Tile
          value={snapshot.echo.due}
          label={snapshot.labels.cardsDue}
          tint={hex(colors.primary)}
          theme={theme}
          uri="langx:///echo"
        />
      </FlexWidget>
    </FlexWidget>
  )
}

/**
 * Every day this person showed up, as a grid.
 *
 * The iOS twin is `ActivityView` in `targets/widget/LangXWidget.swift` and the
 * two draw the same thing from the same string — `activityGrid` decided the
 * shape once, on the app side, where it has tests. Neither widget recomputes
 * it: which square is today and which week the last column stands for are
 * exactly the two things that are invisible in a screenshot.
 *
 * A day that has not happened yet is a **gap**, not an empty square, which is
 * why the encoding carries `.` at all — six blank boxes after today would read
 * as six days missed, every Monday.
 */
function ActivityWidget({
  snapshot,
  theme,
}: {
  snapshot: CompanionSnapshot | null
  theme: WidgetTheme
}) {
  const columns = snapshot?.activity ? activityColumns(snapshot.activity) : []
  if (!snapshot || columns.length === 0) return <EmptyState theme={theme} />
  const colors = palette(theme)
  const counted = countedToday(snapshot)

  return (
    <FlexWidget
      style={{
        height: 'match_parent',
        width: 'match_parent',
        flexDirection: 'column',
        justifyContent: 'center',
        paddingHorizontal: 10,
        paddingVertical: 10,
        backgroundColor: hex(colors.bg),
        borderRadius: radius.xl,
      }}
      clickAction="OPEN_URI"
      clickActionData={{ uri: 'langx:///me' }}
    >
      <FlexWidget style={{ flexDirection: 'row', alignItems: 'center', width: 'match_parent' }}>
        <Header theme={theme} />
        <FlexWidget style={{ flex: 1 }} />
        <TextWidget
          text={String(snapshot.streak.current)}
          style={{
            fontSize: 17,
            fontWeight: 'bold',
            color: counted ? hex(colors.streak) : fade(colors.streak, 0.45),
          }}
        />
      </FlexWidget>
      {/*
        Rows are weekdays and columns are weeks — the calendar shape rather
        than a timeline, because a gap on the same row every week says
        something a flat run of squares cannot.
      */}
      <FlexWidget style={{ flexDirection: 'column' }}>
        {[0, 1, 2, 3, 4, 5, 6].map((row) => (
          <FlexWidget key={row} style={{ flexDirection: 'row' }}>
            {columns.map((column, index) => (
              <FlexWidget
                key={index}
                style={{
                  width: 12,
                  height: 12,
                  marginRight: 2,
                  marginTop: 2,
                  borderRadius: 2,
                  backgroundColor: squareColour(column[row] ?? '.', colors.streak, colors.fill),
                }}
              />
            ))}
          </FlexWidget>
        ))}
      </FlexWidget>
    </FlexWidget>
  )
}

/** The flat string as columns of seven, or empty if it is not the length it claims. */
function activityColumns(activity: NonNullable<CompanionSnapshot['activity']>): string[][] {
  const all = [...activity.days]
  if (all.length !== activity.weeks * 7) return []
  return Array.from({ length: activity.weeks }, (_, column) =>
    all.slice(column * 7, column * 7 + 7),
  )
}

/**
 * The four shades, and the empty square.
 *
 * `streak` at four strengths rather than four colours: the map answers one
 * question — did you show up — and a second hue would invite reading a meaning
 * into it that the shading does not carry. A future day is fully transparent
 * so it keeps its space and the grid stays a rectangle.
 */
function squareColour(mark: string, streak: string, fill: string): `#${string}` {
  switch (mark) {
    case '1':
      return fade(streak, 0.35)
    case '2':
      return fade(streak, 0.55)
    case '3':
      return fade(streak, 0.78)
    case '4':
      return hex(streak)
    case '.':
      return fade(fill, 0)
    default:
      return hex(fill)
  }
}

/** Both themes at once, which is what `renderWidget` wants handing to it. */
export function renderFor(name: WidgetName, snapshot: CompanionSnapshot | null) {
  const View =
    name === WIDGET_NAMES.summary
      ? SummaryWidget
      : name === WIDGET_NAMES.activity
        ? ActivityWidget
        : StreakWidget
  return {
    light: <View snapshot={snapshot} theme="light" />,
    dark: <View snapshot={snapshot} theme="dark" />,
  }
}

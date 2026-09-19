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
export const WIDGET_NAMES = { streak: 'LangXStreak', summary: 'LangXSummary' } as const

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
      style={{ flex: 1, alignItems: 'center', justifyContent: 'center' }}
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
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'space-evenly',
        backgroundColor: hex(colors.bg),
        borderRadius: radius.xl,
      }}
    >
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
  )
}

/** Both themes at once, which is what `renderWidget` wants handing to it. */
export function renderFor(name: WidgetName, snapshot: CompanionSnapshot | null) {
  const View = name === WIDGET_NAMES.summary ? SummaryWidget : StreakWidget
  return {
    light: <View snapshot={snapshot} theme="light" />,
    dark: <View snapshot={snapshot} theme="dark" />,
  }
}

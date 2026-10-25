import type { TokenSummary } from '@langx/shared'
import { useId, useState } from 'react'
import { Text, View } from 'react-native'
import Svg, { Circle, Defs, Line, LinearGradient, Path, Stop } from 'react-native-svg'
import { useLocale, useT } from '../i18n'
import { makeStyles, useTheme } from '../lib/theme'
import { areaPath, linePoints, smoothPath } from '../lib/weekLine'
import { dayInitial } from './WeekBars'

/** The drawing's height inside the card, under which sit the day letters. */
const CHART_HEIGHT = 96
/** Room above the peak and below the floor, so a dot there is not cut in half. */
const PAD = 6
const DOT = 3.5

/**
 * Somebody's week in the redesign (`V-Profile`): a grey card of seven days,
 * messages and corrections as two lines over the days, and the legend under
 * it — the same numbers and the same words as `WeeklyChart`. Messages carry a
 * shaded area so the busier series reads at a glance; corrections are the bare
 * line on top of it.
 *
 * Corrections in `fg`, not the board's green: the hue is any of six, and after
 * dark the mint and aqua hues are the correction green's near twins, so the two
 * series and their swatches read as one. Ink (light) and near-white (dark) sit
 * far from every hue — `profileChartColours.test.ts` measures all twelve.
 */
export function WeeklyChartV3({ week, hue }: { week: TokenSummary['week']; hue: string }) {
  const styles = useStyles()
  const { v3 } = useTheme()
  const t = useT()
  const { locale } = useLocale()
  const [width, setWidth] = useState(0)
  // A web build can keep the last profile mounted under this one, and two
  // gradients with one id would paint both cards in the first person's hue.
  const gradient = `week-${useId().replace(/[^a-zA-Z0-9_-]/g, '')}`

  const messages = week.reduce((sum, day) => sum + day.messages, 0)
  const corrections = week.reduce((sum, day) => sum + day.corrections, 0)
  // One scale for both series, so a quiet message day never outgrows a busy correction one.
  const peak = Math.max(...week.map((day) => Math.max(day.messages, day.corrections)), 0)
  const box = { width, height: CHART_HEIGHT, peak, pad: PAD }
  const messagePoints = linePoints(
    week.map((day) => day.messages),
    box,
  )
  const correctionPoints = linePoints(
    week.map((day) => day.corrections),
    box,
  )
  const floor = CHART_HEIGHT - PAD
  const last = week.length - 1

  return (
    <View style={styles.card}>
      <View
        accessibilityRole="image"
        accessibilityLabel={t('weekly.summary', {
          messages: t('format.messages', { count: messages }),
          corrections: t('format.corrections', { count: corrections }),
        })}
      >
        <View style={styles.chart} onLayout={(event) => setWidth(event.nativeEvent.layout.width)}>
          {width > 0 ? (
            <Svg width={width} height={CHART_HEIGHT}>
              <Defs>
                <LinearGradient id={gradient} x1="0" y1="0" x2="0" y2="1">
                  <Stop offset="0" stopColor={hue} stopOpacity={0.35} />
                  <Stop offset="1" stopColor={hue} stopOpacity={0} />
                </LinearGradient>
              </Defs>
              {[PAD, CHART_HEIGHT / 2, floor].map((y) => (
                <Line
                  key={y}
                  x1={0}
                  x2={width}
                  y1={y}
                  y2={y}
                  stroke={v3.colors.track}
                  strokeWidth={1}
                  {...(y === floor ? {} : { strokeDasharray: '3 4' })}
                />
              ))}
              <Path d={areaPath(messagePoints, floor)} fill={`url(#${gradient})`} />
              <Path
                d={smoothPath(messagePoints)}
                stroke={hue}
                strokeWidth={2.5}
                strokeLinecap="round"
                fill="none"
              />
              <Path
                d={smoothPath(correctionPoints)}
                stroke={v3.colors.fg}
                strokeWidth={2}
                strokeLinecap="round"
                fill="none"
              />
              {week.map((day, index) => [
                // A dot marks a day that counted something, and always today.
                (day.messages > 0 || index === last) && (
                  <Circle
                    key={`m${day.day}`}
                    cx={messagePoints[index]!.x}
                    cy={messagePoints[index]!.y}
                    r={DOT}
                    fill={hue}
                    stroke={v3.colors.surface}
                    strokeWidth={2}
                  />
                ),
                (day.corrections > 0 || index === last) && (
                  <Circle
                    key={`c${day.day}`}
                    cx={correctionPoints[index]!.x}
                    cy={correctionPoints[index]!.y}
                    r={DOT}
                    fill={v3.colors.fg}
                    stroke={v3.colors.surface}
                    strokeWidth={2}
                  />
                ),
              ])}
            </Svg>
          ) : null}
        </View>
        <View style={styles.days}>
          {week.map((day, index) => (
            // The week ends today, so the last letter is today's.
            <Text key={day.day} style={[styles.day, index === last && styles.today]}>
              {dayInitial(day.day, locale)}
            </Text>
          ))}
        </View>
      </View>
      <View style={styles.legend}>
        <View style={styles.legendItem}>
          <View style={[styles.swatch, { backgroundColor: hue }]} />
          <Text style={styles.legendLabel}>{t('weekly.messages')}</Text>
        </View>
        <View style={styles.legendItem}>
          <View style={[styles.swatch, { backgroundColor: v3.colors.fg }]} />
          <Text style={styles.legendLabel}>{t('me.corrections')}</Text>
        </View>
      </View>
    </View>
  )
}

const useStyles = makeStyles(({ v3 }) => ({
  card: {
    backgroundColor: v3.colors.surface,
    borderRadius: v3.radius.tile,
    gap: v3.space[10],
    paddingBottom: v3.space[12],
    paddingHorizontal: v3.space[14],
    paddingTop: v3.space[14],
  },
  chart: { height: CHART_HEIGHT },
  // Seven equal columns, the same seventh of the width each point is drawn at.
  days: { flexDirection: 'row', marginTop: v3.space[4] },
  day: { ...v3.type.label, color: v3.colors.muted, flex: 1, textAlign: 'center' },
  today: { color: v3.colors.fg },
  legend: { flexDirection: 'row', gap: v3.space[16] },
  legendItem: { alignItems: 'center', flexDirection: 'row', gap: v3.space[6] },
  swatch: { borderRadius: 4, height: 12, width: 12 },
  legendLabel: { ...v3.type.caption, color: v3.colors.fg, fontWeight: '600' },
}))

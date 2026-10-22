import Feather from '@expo/vector-icons/Feather'
import type { Locale } from '@langx/shared'
import { Pressable, ScrollView, Text, View } from 'react-native'
import {
  badgeAmount,
  badgeFamilyBody,
  badgeFamilyTitle,
  badgeGoal,
  badgeName,
} from '../../i18n/badgeWords'
import { useLocale, useT } from '../../i18n'
import { rungProgress, type Rung, type Shelf } from '../../lib/badgeShelves'
import { makeStyles, useTheme } from '../../lib/theme'
import { ProgressBar } from '../ui/ProgressBar'
import { BadgePatch } from './BadgePatch'

/** "29 Mar" — the day a dated badge was earned, on its tile. */
export function earnedDay(iso: string, locale: Locale, withYear = false): string {
  const at = new Date(iso)
  if (Number.isNaN(at.getTime())) return ''
  return at.toLocaleDateString(locale, {
    day: 'numeric',
    month: 'short',
    ...(withYear ? { year: 'numeric' } : {}),
  })
}

/** What a tile says under its name, and the whole of it read aloud. */
export function rungLines(
  words: { t: ReturnType<typeof useT>; locale: Locale },
  rung: Rung,
): { name: string; line: string; a11y: string } {
  const { t, locale } = words
  const { badge } = rung
  const name = badgeName(words, badge)
  if (rung.state === 'earned') {
    const line = badge.earnedAt
      ? earnedDay(badge.earnedAt, locale)
      : badgeAmount(words, badge.kind, badge.threshold)
    return {
      name,
      line,
      a11y: t(rung.isNew ? 'badgesV3.a11yEarnedNew' : 'badgesV3.a11yEarned', {
        name,
        detail: line,
      }),
    }
  }
  if (rung.state === 'next' && rung.current !== null) {
    const line = t('badgesV3.of', {
      current: rung.current.toLocaleString(locale),
      total: badge.threshold.toLocaleString(locale),
    })
    return { name, line, a11y: t('badgesV3.a11yNext', { name, detail: line }) }
  }
  const line = badgeGoal(words, badge.kind, badge.threshold)
  return { name, line, a11y: t('badgesV3.a11yLocked', { name, detail: line }) }
}

/**
 * One family's ladder: its title, how many of it are earned, what it counts,
 * and every rung in a row that scrolls sideways.
 */
export function BadgeShelf({ shelf, onOpen }: { shelf: Shelf; onOpen: (rung: Rung) => void }) {
  const styles = useStyles()
  const t = useT()
  const { locale } = useLocale()
  const words = { t, locale }
  const family = badgeFamilyTitle(words, shelf.kind)

  return (
    <View style={styles.shelf}>
      <View style={styles.head}>
        <View style={styles.titleRow}>
          <Text style={styles.title} accessibilityRole="header">
            {family}
          </Text>
          <Text style={styles.count}>
            {t('badgesV3.of', {
              current: shelf.earned.toLocaleString(locale),
              total: shelf.rungs.length.toLocaleString(locale),
            })}
          </Text>
        </View>
        <Text style={styles.body}>{badgeFamilyBody(words, shelf.kind)}</Text>
      </View>
      <ScrollView
        horizontal
        showsHorizontalScrollIndicator={false}
        accessibilityLabel={t('badgesV3.shelfList', { family })}
        contentContainerStyle={styles.row}
      >
        {shelf.rungs.map((rung) => (
          <BadgeTile key={rung.badge.id} rung={rung} onPress={() => onOpen(rung)} />
        ))}
      </ScrollView>
    </View>
  )
}

function BadgeTile({ rung, onPress }: { rung: Rung; onPress: () => void }) {
  const styles = useStyles()
  const { v3 } = useTheme()
  const t = useT()
  const { locale } = useLocale()
  const { name, line, a11y } = rungLines({ t, locale }, rung)
  const progress = rungProgress(rung)
  const state =
    rung.state === 'earned'
      ? ({ kind: 'earned' } as const)
      : rung.state === 'next'
        ? ({ kind: 'next', progress } as const)
        : ({ kind: 'locked' } as const)

  return (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel={a11y}
      onPress={onPress}
      style={({ pressed }) => [styles.tile, pressed && styles.pressed]}
    >
      <View style={styles.art}>
        <BadgePatch id={rung.badge.id} size={PATCH} state={state} />
        {rung.isNew ? (
          <View style={styles.newChip}>
            <Text style={styles.newText}>{t('badgesV3.newChip')}</Text>
          </View>
        ) : null}
      </View>
      <Text style={[styles.name, rung.state === 'locked' && styles.muted]} numberOfLines={2}>
        {name}
      </Text>
      {rung.state === 'next' ? (
        <>
          <Text style={styles.nextLine} numberOfLines={2}>
            {line}
          </Text>
          <View style={styles.bar}>
            <ProgressBar
              value={progress}
              height={6}
              fillColor={v3.colors.fg}
              accessibilityLabel={line}
            />
          </View>
        </>
      ) : (
        <View style={styles.lineRow}>
          <Feather
            name={rung.state === 'earned' ? 'check' : 'lock'}
            size={v3.icon.xs - 3}
            color={rung.state === 'earned' ? v3.colors.correction : v3.colors.muted}
          />
          <Text style={styles.line} numberOfLines={3}>
            {line}
          </Text>
        </View>
      )}
    </Pressable>
  )
}

/** The patch on a shelf tile, at the sheet's largest cut. */
const PATCH = 64

const useStyles = makeStyles(({ v3 }) => ({
  shelf: { gap: v3.space[12] },
  head: { gap: v3.space[2], paddingHorizontal: v3.space[2] },
  titleRow: {
    alignItems: 'baseline',
    flexDirection: 'row',
    gap: v3.space[10],
    justifyContent: 'space-between',
  },
  title: { ...v3.type.headline, color: v3.colors.fg, flexShrink: 1 },
  count: { ...v3.type.caption, color: v3.colors.fg, fontWeight: '800' },
  body: { ...v3.type.caption, color: v3.colors.muted },
  row: { gap: v3.space[4], paddingEnd: v3.space[16] },
  tile: {
    alignItems: 'center',
    gap: v3.space[6],
    paddingBottom: v3.space[12],
    paddingHorizontal: v3.space[4],
    paddingTop: v3.space[8],
    width: 100,
  },
  pressed: { opacity: 0.7 },
  art: { height: PATCH, width: PATCH },
  newChip: {
    backgroundColor: v3.colors.blue,
    borderRadius: v3.radius.pill,
    end: -14,
    paddingHorizontal: v3.space[8],
    paddingVertical: v3.space[2],
    position: 'absolute',
    top: -8,
  },
  newText: { ...v3.type.label, color: v3.colors.onBlue },
  name: { ...v3.type.buttonSmall, color: v3.colors.fg, textAlign: 'center' },
  muted: { color: v3.colors.muted },
  nextLine: { ...v3.type.caption, color: v3.colors.fg, fontWeight: '800', textAlign: 'center' },
  bar: { width: 64 },
  lineRow: {
    alignItems: 'flex-start',
    flexDirection: 'row',
    gap: v3.space[4],
    justifyContent: 'center',
  },
  line: { ...v3.type.caption, color: v3.colors.muted, flexShrink: 1, textAlign: 'center' },
}))

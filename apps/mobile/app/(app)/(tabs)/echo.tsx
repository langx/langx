import Feather from '@expo/vector-icons/Feather'
import { router } from 'expo-router'
import { useState } from 'react'
import { ActivityIndicator, Pressable, RefreshControl, ScrollView, Text, View } from 'react-native'
import { useEchoPacks, useEchoSummary } from '../../../src/api/queries'
import { Button } from '../../../src/components/ui/Button'
import { Chip } from '../../../src/components/ui/Chip'
import { EchoAboutSheet } from '../../../src/components/EchoAboutSheet'
import { LoadFailed } from '../../../src/components/LoadFailed'
import { Screen } from '../../../src/components/ui/Screen'
import { Tip } from '../../../src/components/Tip'
import { useT } from '../../../src/i18n'
import { useLocale } from '../../../src/i18n/I18nProvider'
import { useDisplayNames } from '../../../src/i18n/displayNames'
import { useEchoOffline } from '../../../src/hooks/useEchoOffline'
import { useScreenInteractive } from '../../../src/hooks/useScreenInteractive'
import { chooseAlert } from '../../../src/lib/alert'
import { authClient } from '../../../src/lib/auth-client'
import { compactCount, dueInCompact } from '../../../src/lib/format'
import { usePullToRefresh } from '../../../src/hooks/usePullToRefresh'
import { requireAccount } from '../../../src/lib/requireAccount'
import { makeStyles, useTheme } from '../../../src/lib/theme'

/**
 * The review tab: one thing in the middle, and everything else a tap away.
 *
 * It used to be a header sitting on a list of the cards made from chats, with
 * the packs and a link to every card in the list's footer — an action and
 * three lists sharing one screen, none of them obviously the thing to do. The
 * stage is the hourly gift's (`app/(app)/gift.tsx`): the tile *is* the button,
 * the number on it is what you came to know, and the lists are two rows at the
 * bottom. Nothing was removed, it moved — with one exception, which is why
 * `echo/card/[id].tsx` now carries the row back to the chat a card came from.
 */
export default function EchoScreen() {
  useScreenInteractive()
  const styles = useStyles()
  const { colors } = useTheme()
  const t = useT()
  const { locale } = useLocale()
  const names = useDisplayNames()
  const { data: session } = authClient.useSession()

  const summary = useEchoSummary()
  /** `null` is All. The chosen language decides the number on the tile and the
   *  deck the tile opens — see `startSession`. */
  const [lang, setLang] = useState<string | null>(null)
  const [about, setAbout] = useState(false)
  const packs = useEchoPacks()
  const pull = usePullToRefresh(async () => {
    await Promise.all([summary.refetch(), packs.refetch()])
  })

  /*
   * The counts saved on the device, and the one place grades stranded by a
   * tunnel are sent from. A person who answered ten cards with no network and
   * closed the app has their work in a file; opening this tab is where it
   * goes.
   */
  const { saved } = useEchoOffline(summary.data)
  // The server when it has answered, the device when it has not.
  const counts = summary.data ?? saved?.summary ?? undefined
  const languages = counts?.languages ?? []
  const chosen = lang ? languages.find((row) => row.lang === lang) : undefined
  // A chip narrows the stage as well as the session: the number over "cards
  // due" has to be the number of cards the tile would open.
  const due = lang ? (chosen?.due ?? 0) : (counts?.due ?? 0)
  const total = lang ? (chosen?.total ?? 0) : (counts?.total ?? 0)
  const packRows = packs.data?.items ?? []
  const nextDue = summary.data?.nextDue ? dueInCompact(summary.data.nextDue, { t }) : null

  function open(pick: string | null): void {
    router.push({
      pathname: '/(app)/echo/session',
      params: pick ? { lang: pick } : {},
    })
  }

  /**
   * Review, and first: which language.
   *
   * A deck drawn across every language at once is not a study session — it is
   * a French word, then a Russian one, then French again, with the reader
   * switching alphabets between cards. A chip already chosen is an answer, and
   * one language with cards due is not a question; the sheet is only for the
   * case that is genuinely ambiguous. There is deliberately no "All languages"
   * row — the mixed deck is the thing this removes, not a choice it offers.
   */
  async function startSession(): Promise<void> {
    // The one guest gate in the module, and the place the design document puts
    // it: a guest sees everything and is asked for an account at the first
    // answer, because a schedule with nowhere to live is a promise we cannot
    // keep.
    if (!requireAccount(session?.user, { action: 'echo' })) return
    if (lang) {
      open(lang)
      return
    }

    const withCards = languages.filter((row) => row.due > 0)
    const only = withCards[0]
    if (!only) return
    if (withCards.length === 1) {
      open(only.lang)
      return
    }

    const picked = await chooseAlert(
      t('echo.reviewWhich'),
      undefined,
      // `cardCount` rather than a plural of its own: the row is a language and
      // a number of cards, and that plural already exists in all eight.
      withCards.map((row) => ({
        label: `${names.language(row.lang)} · ${t('echo.cardCount', { count: row.due })}`,
        value: row.lang,
      })),
    )
    if (picked) open(picked)
  }

  /** The stage: what is due, what is resting, or what has not started yet. */
  function stage() {
    if (summary.isPending && !counts) return <ActivityIndicator />
    if (summary.isError && !counts) return <LoadFailed onRetry={() => void summary.refetch()} />

    if (due > 0) {
      return (
        <>
          {/* Two views for the hard shadow, as `Button` and the gift tile draw
              it: the face drops onto the shade on press. */}
          <Pressable
            accessibilityRole="button"
            accessibilityLabel={t('echo.due', { count: due })}
            onPress={() => void startSession()}
            style={styles.tileShade}
          >
            {({ pressed }) => (
              <View style={[styles.tileFace, pressed && styles.tilePressed]}>
                <Text style={styles.tileCount}>{compactCount(due, locale)}</Text>
                <Text style={styles.tileUnit}>{t('echo.tileDue')}</Text>
              </View>
            )}
          </Pressable>
          <View style={styles.caption}>
            <Text style={styles.captionTitle}>{t('echo.readyTitle')}</Text>
            <Text style={styles.captionSub}>{t('echo.readySub')}</Text>
          </View>
        </>
      )
    }

    if (total > 0) {
      return (
        <>
          <View style={styles.restingTile}>
            <Feather name="check" size={64} color={colors.textFaint} />
          </View>
          <View style={styles.caption}>
            <Text style={styles.captionTitle}>{t('echo.allCaughtUp')}</Text>
            {/* Only when the server has said so: an app talking to an API
                without `nextDue` says nothing here rather than guessing. */}
            {nextDue ? (
              <Text style={styles.captionSub}>{t('echo.nextIn', { time: nextDue })}</Text>
            ) : null}
          </View>
        </>
      )
    }

    return (
      <>
        <View style={styles.restingTile}>
          <Feather name="repeat" size={56} color={colors.textFaint} />
        </View>
        <View style={styles.caption}>
          <Text style={styles.captionTitle}>{t('echo.emptyTitle')}</Text>
          <Text style={styles.captionSub}>{t('echo.emptyBody')}</Text>
        </View>
        {/*
         * A pack when there is one, and Chats when there is not. Somebody who
         * has just signed up has no conversations to keep a sentence from, and
         * sending them to an empty Chats tab is the empty promise the packs
         * exist to answer.
         */}
        <Button
          label={t(packRows.length > 0 ? 'echo.packsFor' : 'echo.emptyAction')}
          variant="secondary"
          onPress={() =>
            packRows.length > 0
              ? router.push('/(app)/echo/packs')
              : router.push('/(app)/(tabs)/chats')
          }
          style={styles.emptyAction}
        />
      </>
    )
  }

  return (
    <Screen fluid tabbed>
      <View style={styles.header}>
        <Text style={styles.title}>{t('echo.title')}</Text>
        {/*
         * The schedule is the feature, and it is invisible: a card answered
         * correctly vanishes for days, which reads as the app losing it until
         * somebody explains why. One tap, in the corner, never in the way.
         */}
        <Pressable
          accessibilityRole="button"
          hitSlop={12}
          onPress={() => setAbout(true)}
          style={({ pressed }) => pressed && styles.pressed}
        >
          {/* Drawn as Discover's "What is this?" is, down to the muted 13. */}
          <Text style={styles.about}>{t('echo.aboutOpen')}</Text>
        </Pressable>
      </View>

      {/*
       * A scroll view with nothing much to scroll: `flexGrow` lets the stage
       * take the height it is centred in, and the pull it carries is what the
       * list used to bring — the one gesture that refetches this screen.
       */}
      <ScrollView
        style={styles.scroll}
        contentContainerStyle={styles.body}
        refreshControl={<RefreshControl {...pull} />}
      >
        <View style={styles.stage}>
          {stage()}
          {languages.length > 1 ? (
            <View style={styles.chips}>
              <Chip
                label={t('echo.allLanguages')}
                selected={lang === null}
                onPress={() => setLang(null)}
              />
              {languages.map((row) => (
                <Chip
                  key={row.lang}
                  label={names.language(row.lang)}
                  selected={lang === row.lang}
                  onPress={() => setLang(row.lang)}
                />
              ))}
            </View>
          ) : null}
        </View>

        {/*
         * Three numbers the tab has always had and never shown: the day and
         * the week come from the same summary as the due count, and the third
         * is every card kept. Hairlines rather than tiles — v3 has no card
         * layer, and these are meta, not the action.
         */}
        {counts ? (
          <View style={styles.stats}>
            <Stat label={t('echo.statToday')} value={compactCount(counts.reviewedToday, locale)} />
            <Stat
              label={t('echo.statWeek')}
              value={compactCount(counts.reviewedThisWeek, locale)}
            />
            <Stat label={t('echo.statCards')} value={compactCount(counts.total, locale)} />
          </View>
        ) : null}

        {/*
          Only once there is a card: every tip in this slot is about grading,
          archiving or editing one, and the empty stage above already says how
          to make the first.
        */}
        {counts && counts.total > 0 ? <Tip slot="echo" /> : null}

        <View style={styles.rows}>
          {/*
            Always drawn, even with nothing behind it. The row used to appear
            only once a pack matched a learning language, which read as the
            feature not existing rather than as "none for your languages yet"
            — and the screen behind it already says the second thing.
          */}
          <Row
            icon="layers"
            title={t('echo.packs')}
            sub={t(packRows.length > 0 ? 'echo.packsSub' : 'echo.packsEmptyTitle')}
            onPress={() => router.push('/(app)/echo/packs')}
          />
          {/* No count on this row: the strip above already says how many
              cards there are, and the same number twice is one too many. */}
          <Row
            icon="credit-card"
            title={t('echo.allCards')}
            sub={t('echo.allCardsSub')}
            onPress={() => router.push('/(app)/echo/cards')}
          />
          {/* The third row, and the only one that looks outward: the two
              above are your own cards, this is everybody's count. */}
          <Row
            icon="award"
            title={t('echo.leaderboard')}
            sub={t('echo.leaderboardSub')}
            onPress={() => router.push('/(app)/echo/leaderboard')}
          />
        </View>
      </ScrollView>

      <EchoAboutSheet visible={about} onClose={() => setAbout(false)} />
    </Screen>
  )
}

function Stat({ label, value }: { label: string; value: string }) {
  const styles = useStyles()
  return (
    <View style={styles.stat}>
      <Text style={styles.statValue}>{value}</Text>
      <Text style={styles.statLabel}>{label}</Text>
    </View>
  )
}

function Row({
  icon,
  title,
  sub,
  onPress,
}: {
  icon: keyof typeof Feather.glyphMap
  title: string
  sub: string
  onPress: () => void
}) {
  const styles = useStyles()
  const { colors } = useTheme()
  return (
    <Pressable
      accessibilityRole="button"
      onPress={onPress}
      style={({ pressed }) => [styles.row, pressed && styles.pressed]}
    >
      <Feather name={icon} size={20} color={colors.textFaint} />
      <View style={styles.rowText}>
        <Text style={styles.rowTitle}>{title}</Text>
        <Text style={styles.rowSub} numberOfLines={1}>
          {sub}
        </Text>
      </View>
      <Feather name="chevron-right" size={18} color={colors.textFaint} />
    </Pressable>
  )
}

const useStyles = makeStyles(({ colors, font, radius, spacing }) => ({
  header: {
    alignItems: 'center',
    flexDirection: 'row',
    gap: spacing.sm,
    paddingBottom: spacing.xs,
    paddingTop: spacing.md,
  },
  title: { ...font.title, color: colors.text, flex: 1 },
  about: { color: colors.textMuted, fontSize: 13, fontWeight: '600' },
  // The scroll view takes the height; the content grows into it, which is
  // what lets the stage centre itself when there is room to spare.
  scroll: { flex: 1 },
  body: { flexGrow: 1, paddingBottom: spacing.md },
  stage: {
    alignItems: 'center',
    flex: 1,
    gap: spacing.xl,
    justifyContent: 'center',
    paddingVertical: spacing.xl,
  },
  // 40 is the gift tile's radius: rounder than any card, squarer than a circle.
  tileShade: { backgroundColor: colors.primaryShade, borderRadius: 40, paddingBottom: 8 },
  tileFace: {
    alignItems: 'center',
    backgroundColor: colors.primary,
    borderRadius: 40,
    height: 160,
    justifyContent: 'center',
    width: 160,
  },
  tilePressed: { transform: [{ translateY: 8 }] },
  tileCount: { ...font.title, color: colors.primaryText, fontSize: 60, lineHeight: 68 },
  tileUnit: {
    color: colors.primaryTextMuted,
    fontSize: 13,
    fontWeight: '700',
    letterSpacing: 0.6,
    textTransform: 'uppercase',
  },
  restingTile: {
    alignItems: 'center',
    backgroundColor: colors.fill,
    borderRadius: radius.pill,
    height: 160,
    justifyContent: 'center',
    width: 160,
  },
  caption: { alignItems: 'center', gap: spacing.xs },
  captionTitle: { ...font.heading, color: colors.text, textAlign: 'center' },
  captionSub: { color: colors.textMuted, fontSize: 15, lineHeight: 22, textAlign: 'center' },
  emptyAction: { alignSelf: 'stretch' },
  chips: { flexDirection: 'row', flexWrap: 'wrap', gap: spacing.xs, justifyContent: 'center' },
  stats: {
    borderBottomColor: colors.border,
    borderBottomWidth: 1,
    borderTopColor: colors.border,
    borderTopWidth: 1,
    flexDirection: 'row',
  },
  stat: { alignItems: 'center', flex: 1, gap: 2, paddingVertical: spacing.md },
  statValue: { ...font.heading, color: colors.text },
  statLabel: { color: colors.textFaint, fontSize: 12 },
  rows: { paddingTop: spacing.xs },
  row: {
    alignItems: 'center',
    borderBottomColor: colors.border,
    borderBottomWidth: 1,
    flexDirection: 'row',
    gap: spacing.md,
    paddingVertical: 14,
  },
  rowText: { flex: 1, gap: 1 },
  rowTitle: { color: colors.text, fontSize: 16, fontWeight: '600' },
  rowSub: { color: colors.textMuted, fontSize: 13 },
  pressed: { opacity: 0.6 },
}))

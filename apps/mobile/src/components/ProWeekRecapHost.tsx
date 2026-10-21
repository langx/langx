import Feather from '@expo/vector-icons/Feather'
import { Nunito_900Black } from '@expo-google-fonts/nunito/900Black'
import { PRO_WEEK_RULES, type ProWeekRecap } from '@langx/shared'
import { useFonts } from 'expo-font'
import { useEffect, useRef, useState, useSyncExternalStore } from 'react'
import { Modal, Pressable, ScrollView, StyleSheet, Text, View } from 'react-native'
import { useSafeAreaInsets } from 'react-native-safe-area-context'
import { useAckProWeekRecap, useMe, useProWeekRecap } from '../api/queries'
import { useReduceMotion } from '../hooks/useReduceMotion'
import { useTourOpen } from '../hooks/useTour'
import { useV3Home } from '../hooks/useV3Home'
import { useLocale, useT } from '../i18n'
import { isLaunchOver, subscribeToLaunchOver } from '../lib/launchOver'
import { openPaywall } from '../lib/paywall'
import { isProWelcomeOpen, subscribeToProWelcomeOpen } from '../lib/proWelcome'
import { proWeekRecapDue } from '../lib/proWeek'
import { getOffers } from '../lib/purchases'
import { makeStyles, useTheme } from '../lib/theme'
import { Button } from './ui/Button'
import { IconButton } from './ui/IconButton'
import { ProBadge } from './ui/ProBadge'
import { ProMark } from './ProMark'

/**
 * The Pro Week's recap: on its last day, or in the week after it if the app
 * was not opened then, once per account. What the person did with Pro that
 * the free plan does not do, then "Keep Pro" and "Continue free".
 *
 * The one sales surface somebody on a gift is shown, and only on the day it
 * would end (the brief's rule 10) — never to a subscriber, a store's free week
 * or a lifetime, which the app checks before it asks (`proWeekRecapDue`) and
 * the server checks again with the gifts in hand. The ✕, a tap outside, back,
 * "Continue free" and "Keep Pro" all close it in one tap, and every one of
 * them marks it seen: a screen that came back after "no" would be pressure.
 * "Keep Pro" opens the paywall as `gift_end`; the paywall says what the store
 * charges and whether its own free week is still there.
 *
 * Not while the launch film, the Discover tour or "You're Pro now" is up:
 * each is a window of its own, and the second to open would paint over the
 * first. A `Modal`, so it needs no `OVERLAY_LAYER`.
 */
export function ProWeekRecapHost({ enabled }: { enabled: boolean }) {
  const me = useMe(enabled)
  const due = enabled && proWeekRecapDue(me.data)
  const recap = useProWeekRecap(due)
  const { mutate: acknowledge } = useAckProWeekRecap()
  const launchOver = useSyncExternalStore(subscribeToLaunchOver, isLaunchOver, isLaunchOver)
  const welcomeOpen = useSyncExternalStore(
    subscribeToProWelcomeOpen,
    isProWelcomeOpen,
    isProWelcomeOpen,
  )
  const tourOpen = useTourOpen()
  const [shown, setShown] = useState<ProWeekRecap | null>(null)
  const handled = useRef(false)

  const ready = recap.data?.recap
  useEffect(() => {
    if (!due || !ready || shown || handled.current) return
    if (!launchOver || tourOpen || welcomeOpen) return
    handled.current = true
    setShown(ready)
  }, [due, ready, shown, launchOver, tourOpen, welcomeOpen])

  if (!shown) return null

  function close(keep: boolean): void {
    acknowledge()
    setShown(null)
    if (keep) openPaywall(undefined, '/(app)/(tabs)/discover', 'gift_end')
  }

  return <RecapSheet recap={shown} onKeep={() => close(true)} onClose={() => close(false)} />
}

function RecapSheet({
  recap,
  onKeep,
  onClose,
}: {
  recap: ProWeekRecap
  onKeep: () => void
  onClose: () => void
}) {
  const t = useT()
  const { locale } = useLocale()
  const styles = useStyles()
  const { colors, v3 } = useTheme()
  const v3Look = useV3Home()
  const insets = useSafeAreaInsets()
  const reduce = useReduceMotion()
  // The title's Black face is not loaded at the root (see the paywall); the
  // sheet waits for it rather than arriving in the platform face and swapping.
  const [fontLoaded, fontError] = useFonts({ Nunito_900Black })

  /*
   * Whether the store's own free week is still this person's to start — said
   * only when the store says so, because the line is a promise about a price.
   * Asked once the sheet is up; until the store answers, nothing is said.
   */
  const [storeWeek, setStoreWeek] = useState(false)
  useEffect(() => {
    let cancelled = false
    void getOffers().then((offers) => {
      if (!cancelled) setStoreWeek(offers.some((offer) => offer.freeTrialDays !== null))
    })
    return () => {
      cancelled = true
    }
  }, [])

  const date = new Date(recap.endsAt).toLocaleDateString(locale, { day: 'numeric', month: 'long' })
  const rows: string[] = []
  if (recap.extraChats > 0) rows.push(t('proWeek.recapChats', { count: recap.extraChats }))
  if (recap.translatedSends > 0) {
    rows.push(t('proWeek.recapTranslated', { count: recap.translatedSends }))
  }
  if (recap.languages.length > 0) {
    rows.push(t('proWeek.recapLanguages', { count: recap.languages.length }))
  }

  if (!fontLoaded && fontError === null) return null

  return (
    <Modal
      visible
      transparent
      animationType={reduce ? 'none' : 'slide'}
      statusBarTranslucent
      onRequestClose={onClose}
    >
      <View style={styles.root}>
        <Pressable
          style={[StyleSheet.absoluteFill, v3.elevation.overlay]}
          onPress={onClose}
          accessibilityElementsHidden
          importantForAccessibility="no-hide-descendants"
        />
        <View
          accessibilityViewIsModal
          style={[styles.sheet, { paddingBottom: insets.bottom + v3.space[16] }]}
        >
          <IconButton icon="x" accessibilityLabel={t('common.close')} onPress={onClose} />
          <ScrollView contentContainerStyle={styles.content} bounces={false}>
            {v3Look ? <ProBadge fontSize={v3.type.title.fontSize} /> : <ProMark />}
            <Text accessibilityRole="header" style={styles.title}>
              {recap.ended ? t('proWeek.recapEnded') : t('proWeek.recapEnds', { date })}
            </Text>
            {recap.extended ? (
              <Text style={styles.body}>
                {t('proWeek.recapExtended', { count: PRO_WEEK_RULES.extensionStreakDays })}
              </Text>
            ) : null}
            {rows.length > 0 ? (
              <View style={styles.rows}>
                <Text style={styles.lead}>{t('proWeek.recapLead')}</Text>
                {rows.map((row) => (
                  <View key={row} style={styles.row}>
                    <Feather name="check" size={v3.icon.md} color={colors.pro} />
                    <Text style={styles.rowText}>{row}</Text>
                  </View>
                ))}
              </View>
            ) : (
              <Text style={styles.body}>{t('proWeek.recapQuiet')}</Text>
            )}
            {/* The free plan's promise, as the paywall pins it: the recap is
                about what Pro adds, and must not read as if replying stopped. */}
            <View style={styles.promise}>
              <Feather name="check" size={v3.icon.md} color={v3.colors.correction} />
              <Text style={styles.promiseText}>{t('paywall.freePromise')}</Text>
            </View>
          </ScrollView>
          <View style={styles.actions}>
            {storeWeek ? <Text style={styles.note}>{t('proWeek.storeFreeWeek')}</Text> : null}
            <Button variant="primary" label={t('proWeek.keep')} onPress={onKeep} />
            <Button variant="secondary" label={t('paywall.continueFree')} onPress={onClose} />
          </View>
        </View>
      </View>
    </Modal>
  )
}

const useStyles = makeStyles(({ v3 }) => ({
  root: { flex: 1, justifyContent: 'flex-end' },
  sheet: {
    alignSelf: 'center',
    backgroundColor: v3.colors.bg,
    borderTopEndRadius: v3.radius.block,
    borderTopStartRadius: v3.radius.block,
    gap: v3.space[12],
    maxHeight: '92%',
    maxWidth: 560,
    paddingHorizontal: v3.space[20],
    paddingTop: v3.space[8],
    width: '100%',
  },
  content: { alignItems: 'flex-start', gap: v3.space[14], paddingBottom: v3.space[4] },
  title: { ...v3.type.title, color: v3.colors.fg },
  body: { ...v3.type.body, color: v3.colors.fg },
  lead: { ...v3.type.callout, color: v3.colors.muted },
  rows: { alignSelf: 'stretch', gap: v3.space[10] },
  row: { alignItems: 'flex-start', flexDirection: 'row', gap: v3.space[10] },
  rowText: { ...v3.type.body, color: v3.colors.fg, flexShrink: 1, fontWeight: '600' },
  promise: {
    alignItems: 'center',
    alignSelf: 'stretch',
    backgroundColor: v3.colors.correctionTint,
    borderRadius: v3.radius.row,
    flexDirection: 'row',
    gap: v3.space[10],
    paddingHorizontal: v3.space[14],
    paddingVertical: v3.space[10],
  },
  promiseText: { ...v3.type.callout, color: v3.colors.correction, flex: 1, fontWeight: '700' },
  note: { ...v3.type.caption, color: v3.colors.muted, textAlign: 'center' },
  actions: { gap: v3.space[10] },
}))

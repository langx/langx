import { Nunito_900Black } from '@expo-google-fonts/nunito/900Black'
import { useFonts } from 'expo-font'
import type { ReactNode, RefObject } from 'react'
import { Pressable, Text, View } from 'react-native'
import type { PublicProfileDto } from '../../api/types'
import { useLocale, useT } from '../../i18n'
import type { CallAvailability } from '../../lib/calls/callGate'
import { makeStyles, useTheme } from '../../lib/theme'
import { partnerHueFor } from '../../lib/theme/partnerHue'
import { OfficialMark } from '../OfficialMark'
import { PresenceLine } from '../PresenceLine'
import { Avatar } from '../ui/Avatar'
import { IconButton } from '../ui/IconButton'
import { Skeleton } from '../ui/Skeleton'

/** The drawing's face: big enough to be the band's subject, not a list row's. */
const AVATAR = 54

interface ThreadHeaderV3Props {
  /** Undefined while the profile loads, and for an account that is gone. */
  partner: PublicProfileDto | undefined
  loading: boolean
  typing: boolean
  /** Absent in a panel, where the list beside the thread is the way back. */
  onBack?: (() => void) | undefined
  onOpenProfile: () => void
  /**
   * The call entry exactly as the thread decides it — `callAvailability`'s
   * answer, the button the menu drops down from, and what a press does.
   * Nothing about the gate is decided here.
   */
  call: { gate: CallAvailability; anchor: RefObject<View | null>; onPress: () => void }
  onMore: () => void
  /**
   * Where the pair flame goes — "9 days together" — once exchange streaks
   * exist. Nothing passes it yet: there is no count to show, and a drawn one
   * would be a number the app made up.
   */
  flame?: ReactNode
}

/**
 * The v3 thread's header: a band in the partner's colour (`partnerHueFor`,
 * the same hue they have on every screen), with their face, name and
 * presence, and the three controls as labelled glyphs.
 *
 * Ink on the hue in both schemes, because the hues are light in both. Until
 * the partner is known there is no hue to draw, so the band is the surface
 * grey and its glyphs take the text colour — ink on the dark scheme's surface
 * would be black on near-black.
 *
 * Below the status bar rather than under it, as Home's blocks are: the band
 * running up behind the clock would need the bar's own glyphs re-coloured per
 * hue and per scheme, for a strip nobody reads.
 */
export function ThreadHeaderV3({
  partner,
  loading,
  typing,
  onBack,
  onOpenProfile,
  call,
  onMore,
  flame,
}: ThreadHeaderV3Props) {
  const t = useT()
  const { isRtl } = useLocale()
  const styles = useStyles()
  const { v3 } = useTheme()
  // The name is Nunito Black, which the root does not load yet
  // (`DISPLAY_FONT_BLACK`). Nothing waits on it, as on Invite.
  useFonts({ Nunito_900Black })
  const onHue = partner !== undefined
  const ground = onHue ? v3.hues[partnerHueFor(partner._id)] : v3.colors.surface
  const ink = onHue ? v3.colors.ink : v3.colors.fg

  return (
    <View style={[styles.band, { backgroundColor: ground }]}>
      <View style={styles.bar}>
        {onBack ? (
          <IconButton
            // The glyph points the way back, which in Arabic is the other way.
            icon={isRtl ? 'chevron-right' : 'chevron-left'}
            color={ink}
            accessibilityLabel={t('common.backPlain')}
            onPress={onBack}
          />
        ) : (
          <View />
        )}
        <View style={styles.actions}>
          {/*
            Faint while the consent gate is closed, and still pressable: the
            press is what says how many more messages it takes. Not drawn at
            all where a call could never happen. The same rule as the current
            header's, read from the same `callAvailability`.
          */}
          {call.gate !== 'hidden' ? (
            // A plain view for the ref: the call menu measures this to drop
            // down under it, and `IconButton` hands no ref through.
            <View ref={call.anchor} collapsable={false}>
              <IconButton
                icon="phone"
                iconSize={v3.icon.lg}
                color={ink}
                accessibilityLabel={t('calls.call')}
                onPress={call.onPress}
                {...(call.gate === 'locked' ? { style: styles.locked } : {})}
              />
            </View>
          ) : null}
          <IconButton
            icon="more-horizontal"
            iconSize={v3.icon.xl}
            color={ink}
            accessibilityLabel={t('messageMenu.more')}
            onPress={onMore}
          />
        </View>
      </View>

      {/*
        No label of its own: the name and the line under it are the label, so
        a screen reader hears "Online" or "typing…" with the name, as it does
        in the current header. A label here would be read instead of both.
      */}
      <Pressable
        accessibilityRole="button"
        {...(partner ? { accessibilityHint: t('chat.viewProfile') } : {})}
        onPress={() => partner && onOpenProfile()}
        style={styles.who}
      >
        {loading ? (
          <Skeleton width={AVATAR} height={AVATAR} radius={AVATAR / 2} />
        ) : (
          <Avatar
            url={partner?.avatarUrl}
            name={partner?.displayName ?? '?'}
            seed={partner?._id}
            size={AVATAR}
          />
        )}
        <View style={styles.names}>
          {loading ? (
            <>
              <Skeleton width={140} height={24} />
              <Skeleton width={90} height={14} />
            </>
          ) : (
            <View style={styles.nameRow}>
              <Text style={[styles.name, { color: ink }]} numberOfLines={1}>
                {partner?.displayName ?? t('chat.title')}
              </Text>
              {partner?.official ? <OfficialMark size={v3.icon.md} /> : null}
            </View>
          )}
          {/*
            One line that is either presence or typing, never both — the
            current header's rule, for the same reason: they are two states
            of one line, and stacking them would make the band jump.
          */}
          {loading ? null : typing ? (
            <Text style={[styles.typing, { color: ink }]} numberOfLines={1}>
              {t('chat.typing')}
            </Text>
          ) : (
            <PresenceLine
              lastActiveAt={partner?.lastActiveAt}
              timezone={partner?.timezone}
              onHue={onHue}
            />
          )}
          {flame}
        </View>
      </Pressable>
    </View>
  )
}

const useStyles = makeStyles(({ v3 }) => ({
  band: {
    borderBottomEndRadius: v3.radius.block,
    borderBottomStartRadius: v3.radius.block,
    gap: v3.space[4],
    paddingBottom: v3.space[16],
    paddingHorizontal: v3.space[10],
    paddingTop: v3.space[8],
  },
  bar: { alignItems: 'center', flexDirection: 'row', justifyContent: 'space-between' },
  actions: { alignItems: 'center', flexDirection: 'row', gap: v3.space[4] },
  locked: { opacity: 0.45 },
  who: {
    alignItems: 'center',
    flexDirection: 'row',
    gap: v3.space[12],
    paddingHorizontal: v3.space[8],
  },
  names: { flex: 1, gap: v3.space[4], minWidth: 0 },
  nameRow: { alignItems: 'center', flexDirection: 'row', gap: v3.space[6] },
  name: { ...v3.type.title, flexShrink: 1 },
  typing: { ...v3.type.caption, fontFamily: v3.type.label.fontFamily },
}))

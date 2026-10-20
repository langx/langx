import { Nunito_900Black } from '@expo-google-fonts/nunito/900Black'
import { wornCosmetic, wornFrameTone } from '@langx/shared'
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
import { ICON_BUTTON_TARGET, IconButton } from '../ui/IconButton'
import { Skeleton } from '../ui/Skeleton'
import { TitleBadge } from '../ui/TitleBadge'

/** The drawing's face: big enough to be the band's subject, not a list row's. */
const AVATAR = 54
/** The folded band's face, as tall as the controls beside it leave room for. */
const AVATAR_COMPACT = 36

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
   * Nothing about the gate is decided here. Absent, like `onMore`, on the
   * screen that starts a conversation: both need one to exist.
   */
  call?: { gate: CallAvailability; anchor: RefObject<View | null>; onPress: () => void }
  onMore?: () => void
  /**
   * Where the pair flame goes — "9 days together" — once exchange streaks
   * exist. Nothing passes it yet: there is no count to show, and a drawn one
   * would be a number the app made up.
   */
  flame?: ReactNode
  /**
   * A soft keyboard is up: the band folds to one row — back, the face and the
   * name, the controls — so a small phone keeps some of the thread above the
   * keyboard. Every control stays; only the band's second row goes.
   */
  compact?: boolean
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
  compact = false,
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

  const face = compact ? AVATAR_COMPACT : AVATAR
  /*
   * The partner's worn title, in the badge's compact cut, beside the name:
   * there and not under it, so the band is as tall with a title as without,
   * as it is with a frame. Not in the folded band, which has no room, and
   * not on a suspended account, whose profile leaves it off too.
   */
  const title =
    partner && !compact && (partner.accountStatus ?? 'active') === 'active'
      ? wornCosmetic(partner.equipped, partner.cosmetics, 'title')
      : undefined
  /*
    No label of its own: the name and the line under it are the label, so
    a screen reader hears "Online" or "typing…" with the name, as it does
    in the current header. A label here would be read instead of both.
  */
  const who = (
    <Pressable
      accessibilityRole="button"
      {...(partner ? { accessibilityHint: t('chat.viewProfile') } : {})}
      onPress={() => partner && onOpenProfile()}
      style={[styles.who, compact && styles.whoCompact]}
    >
      {loading ? (
        <Skeleton width={face} height={face} radius={face / 2} />
      ) : (
        <Avatar
          url={partner?.avatarUrl}
          name={partner?.displayName ?? '?'}
          seed={partner?._id}
          size={face}
          frame={partner ? wornFrameTone(partner.equipped, partner.cosmetics) : undefined}
          // Past the face's box vertically, so the band is as tall framed as
          // not; beside the face the frame keeps its room from the name.
          frameOverflow="vertical"
        />
      )}
      <View style={[styles.names, compact && styles.namesCompact]}>
        {loading ? (
          <>
            <Skeleton width={compact ? 110 : 140} height={compact ? 18 : 24} />
            {compact ? null : <Skeleton width={90} height={14} />}
          </>
        ) : (
          <View style={styles.nameRow}>
            <Text
              style={[styles.name, compact && styles.nameCompact, { color: ink }]}
              numberOfLines={1}
            >
              {partner?.displayName ?? t('chat.title')}
            </Text>
            {partner?.official ? <OfficialMark size={v3.icon.md} /> : null}
            {title ? (
              <View style={styles.title}>
                <TitleBadge id={title.id} size="compact" />
              </View>
            ) : null}
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
        {compact ? null : flame}
      </View>
    </Pressable>
  )

  return (
    <View style={[styles.band, compact && styles.bandCompact, { backgroundColor: ground }]}>
      <View style={styles.bar}>
        {onBack ? (
          <IconButton
            // The glyph points the way back, which in Arabic is the other way.
            icon={isRtl ? 'chevron-right' : 'chevron-left'}
            color={ink}
            accessibilityLabel={t('common.backPlain')}
            onPress={onBack}
          />
        ) : compact ? null : (
          <View />
        )}
        {compact ? who : null}
        <View style={styles.actions}>
          {/*
            Faint while the consent gate is closed, and still pressable: the
            press is what says how many more messages it takes. Not drawn at
            all where a call could never happen. The same rule as the current
            header's, read from the same `callAvailability`.
          */}
          {call && call.gate !== 'hidden' ? (
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
          {onMore ? (
            <IconButton
              icon="more-horizontal"
              iconSize={v3.icon.xl}
              color={ink}
              accessibilityLabel={t('messageMenu.more')}
              onPress={onMore}
            />
          ) : null}
        </View>
      </View>

      {compact ? null : who}
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
  bandCompact: { paddingBottom: v3.space[6], paddingTop: v3.space[4] },
  bar: { alignItems: 'center', flexDirection: 'row', justifyContent: 'space-between' },
  actions: { alignItems: 'center', flexDirection: 'row', gap: v3.space[4] },
  locked: { opacity: 0.45 },
  who: {
    alignItems: 'center',
    flexDirection: 'row',
    gap: v3.space[12],
    paddingHorizontal: v3.space[8],
  },
  // Between the back and the controls, taking whatever they leave. The
  // folded face is smaller than a finger, so the row keeps a button's height.
  whoCompact: {
    flex: 1,
    gap: v3.space[10],
    minHeight: ICON_BUTTON_TARGET,
    minWidth: 0,
    paddingHorizontal: 0,
  },
  names: { flex: 1, gap: v3.space[4], minWidth: 0 },
  namesCompact: { gap: 0 },
  nameRow: { alignItems: 'center', flexDirection: 'row', gap: v3.space[6] },
  name: { ...v3.type.title, flexShrink: 1 },
  // The name gives way first — it is who this is — and the badge takes at
  // most half the row, its word cut short past that.
  title: { flexShrink: 0, maxWidth: '50%' },
  nameCompact: v3.type.headline,
  typing: { ...v3.type.caption, fontFamily: v3.type.label.fontFamily },
}))

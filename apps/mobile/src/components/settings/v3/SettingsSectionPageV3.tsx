import Feather from '@expo/vector-icons/Feather'
import {
  ACCOUNT_DELETION_GRACE_DAYS,
  NOTIFICATION_CHANNELS,
  profileUrl,
  TIER_NAMES,
  type ProBenefit,
} from '@langx/shared'
import { router } from 'expo-router'
import type { ReactNode } from 'react'
import { Image, Pressable, ScrollView, Text, View } from 'react-native'
import { useQuota } from '../../../api/queries'
import { useSettingsModel, type SettingsModel } from '../../../hooks/useSettingsModel'
import { useLocale, type MessageKey } from '../../../i18n'
import { isProIcon } from '../../../lib/appIconList'
import { chatsLeft } from '../../../lib/chatsLeft'
import { openExternal } from '../../../lib/openExternal'
import { openPaywall } from '../../../lib/paywall'
import { BENEFIT_COPY, benefitsHeld, pendingTag } from '../../../lib/paywallBenefits'
import { showsSeePlans } from '../../../lib/proRoads'
import { HIDDEN_MODE_CHILDREN, SETTINGS_V3_LAYOUT } from '../../../lib/settingsLayoutV3'
import { settingsSection, type SettingsSectionId } from '../../../lib/settingsRegistry'
import {
  makeStyles,
  THEME_PREFERENCES,
  useTheme,
  v3 as V3_SCHEMES,
  type ColorScheme,
  type PartnerHue,
} from '../../../lib/theme'
import { Button } from '../../ui/Button'
import { Toggle } from '../../ui/Toggle'
import { BENEFIT_TITLE, ICON_PREVIEWS, THEME_LABELS } from '../SettingsRow'
import {
  SettingsGroupV3,
  SettingsHeadingV3,
  SettingsItemV3,
  SettingsScreenV3,
  type Glyph,
} from './SettingsKitV3'
import { CopilotSettingsV3 } from './CopilotSettingsV3'
import { HiddenModeNestV3, SettingsRowV3 } from './SettingsRowV3'

/**
 * One Settings category under `flags.v3Home`, from its `V-Set*` drawing:
 * today's rows, grouped (`SETTINGS_V3_LAYOUT`). Most pages are grey blocks of
 * rows; the plan, sharing, theme, app icon and notification kinds are drawn
 * as the blocks their drawings make of them, on the same handlers.
 */
export function SettingsSectionPageV3({ id }: { id: SettingsSectionId }) {
  const model = useSettingsModel()
  const section = settingsSection(id)
  return (
    <SettingsScreenV3 title={model.t(section.titleKey)} back="/(app)/settings">
      {id === 'plan' ? (
        <PlanPage model={model} />
      ) : id === 'share' ? (
        <SharePage model={model} />
      ) : (
        SETTINGS_V3_LAYOUT[id].map((group) => (
          <GroupBlock
            key={group.ids[0]}
            ids={group.ids}
            headingKey={group.headingKey}
            model={model}
            kind={group.kind}
          />
        ))
      )}
      {/* Only for an account Copilot is on for; nothing for everybody else. */}
      {id === 'privacy' ? <CopilotSettingsV3 /> : null}
    </SettingsScreenV3>
  )
}

function GroupBlock({
  ids,
  headingKey,
  kind,
  model,
}: {
  ids: readonly string[]
  headingKey?: MessageKey | undefined
  kind?: 'notifications' | undefined
  model: SettingsModel
}) {
  const heading = headingKey ? <SettingsHeadingV3 title={model.t(headingKey)} /> : null
  if (kind === 'notifications') {
    return (
      <>
        {heading}
        <NotificationTable ids={ids} model={model} />
      </>
    )
  }
  const first = ids[0]
  if (first === 'appearance.theme') return <ThemeBlock model={model} />
  if (first === 'appearance.appIcon') return <AppIconBlock model={model} />
  if (first === 'account.delete') return <DeleteBlock model={model} />
  return (
    <>
      {heading}
      <SettingsGroupV3>
        {ids.map((id) =>
          HIDDEN_MODE_CHILDREN.has(id) ? null : id === 'privacy.hiddenMode' ? (
            <View key={id}>
              <SettingsRowV3 id={id} model={model} />
              <HiddenModeNestV3 model={model} />
            </View>
          ) : (
            <SettingsRowV3 key={id} id={id} model={model} />
          ),
        )}
      </SettingsGroupV3>
    </>
  )
}

/** Each notification kind's glyph and hue in the table. */
const KIND_LOOK: Record<string, { icon: Glyph; hue?: PartnerHue }> = {
  messages: { icon: 'message-circle', hue: 'sky' },
  streak: { icon: 'zap', hue: 'tangerine' },
  badges: { icon: 'award', hue: 'lime' },
  profileVisits: { icon: 'eye', hue: 'lilac' },
  meetings: { icon: 'calendar', hue: 'aqua' },
  social: { icon: 'users', hue: 'mint' },
  wallet: { icon: 'gift', hue: 'lime' },
  echo: { icon: 'layers', hue: 'sky' },
  promotions: { icon: 'bell' },
}

/**
 * The kinds as a table: one row per kind, a switch column per channel. It
 * was a heading per kind with a row per channel. The words, the switches'
 * accessible names, what each writes, and the email half being off and
 * inert until an address is verified are all today's: this is consent text,
 * and only its layout moves.
 */
function NotificationTable({ ids, model }: { ids: readonly string[]; model: SettingsModel }) {
  const styles = useStyles()
  const { v3 } = useTheme()
  const { t, update } = model
  return (
    <>
      <View style={styles.group}>
        <View
          style={styles.tableHead}
          accessibilityElementsHidden
          importantForAccessibility="no-hide-descendants"
        >
          <View style={styles.fill} />
          {NOTIFICATION_CHANNELS.map((channel) => (
            <Text key={channel} style={styles.columnHead}>
              {t(`notifications.channel.${channel}` as MessageKey)}
            </Text>
          ))}
        </View>
        {ids.map((id) => {
          const type = id.slice('notifications.'.length) as keyof typeof model.notifications
          const look = KIND_LOOK[type] ?? { icon: 'bell' as Glyph }
          const title = t(`notifications.${type}` as MessageKey)
          return (
            <View key={id} style={styles.kindRow}>
              <View
                style={[
                  styles.kindSquare,
                  { backgroundColor: look.hue ? v3.hues[look.hue] : v3.colors.line },
                ]}
              >
                <Feather
                  name={look.icon}
                  size={v3.icon.md}
                  color={look.hue ? v3.colors.ink : v3.colors.fg}
                />
              </View>
              <View style={styles.kindText}>
                <Text style={styles.kindTitle}>{title}</Text>
                <Text style={styles.caption}>{t(`notifications.${type}Body` as MessageKey)}</Text>
              </View>
              {NOTIFICATION_CHANNELS.map((channel) => (
                <Toggle
                  key={channel}
                  accessibilityLabel={`${title} — ${t(`notifications.channel.${channel}` as MessageKey)}`}
                  disabled={channel === 'email' && !model.emailVerified}
                  value={model.notifications[type][channel]}
                  onValueChange={(next) =>
                    update.mutate({ settings: { notifications: { [type]: { [channel]: next } } } })
                  }
                />
              ))}
            </View>
          )
        })}
      </View>
      {model.emailVerified ? null : (
        <Text style={[styles.caption, styles.note]}>{t('notifications.emailUnverified')}</Text>
      )}
    </>
  )
}

/**
 * Auto, light or dark, as three tiles that each draw a little screen in that
 * scheme: the same three options, the same setter. The miniature uses each
 * scheme's own tokens, not the current one's, so Dark looks dark from a light
 * phone; Auto is the two halves side by side.
 */
function ThemeBlock({ model }: { model: SettingsModel }) {
  const styles = useStyles()
  const { v3 } = useTheme()
  const { t, theme } = model
  return (
    <>
      <SettingsHeadingV3 title={t('theme.label')} />
      <View
        accessibilityRole="radiogroup"
        accessibilityLabel={t('theme.label')}
        style={styles.themes}
      >
        {THEME_PREFERENCES.map((value) => {
          const chosen = theme.preference === value
          return (
            <Pressable
              key={value}
              accessibilityRole="radio"
              accessibilityState={{ checked: chosen }}
              onPress={() => theme.setPreference(value)}
              style={({ pressed }) => [
                styles.themeTile,
                chosen && styles.themeTileChosen,
                pressed && styles.pressed,
              ]}
            >
              <View style={styles.themePreview}>
                {value === 'auto' ? (
                  <>
                    <MiniScreen scheme="light" half="start" />
                    <MiniScreen scheme="dark" half="end" />
                  </>
                ) : (
                  <MiniScreen scheme={value} />
                )}
              </View>
              <Text style={styles.themeLabel}>{t(THEME_LABELS[value])}</Text>
              {chosen ? (
                <View style={styles.themeCheck}>
                  <Feather name="check" size={v3.icon.xs} color={v3.colors.onBlue} />
                </View>
              ) : null}
            </Pressable>
          )
        })}
      </View>
    </>
  )
}

/** One scheme's ground with three lines of "text" on it: a title, a body, a blue link. */
function MiniScreen({ scheme, half }: { scheme: ColorScheme; half?: 'start' | 'end' }) {
  const styles = useStyles()
  const colors = V3_SCHEMES[scheme].colors
  return (
    <View
      style={[styles.mini, { backgroundColor: colors.bg }, half && styles.miniHalf]}
      accessibilityElementsHidden
      importantForAccessibility="no-hide-descendants"
    >
      <View style={[styles.miniLine, styles.miniTitle, { backgroundColor: colors.fg }]} />
      <View style={[styles.miniLine, { backgroundColor: colors.line }]} />
      <View style={[styles.miniLine, styles.miniLink, { backgroundColor: colors.blue }]} />
    </View>
  )
}

/**
 * Only where there is a home screen to put an icon on, as today. The free
 * icons as a strip that sets one on the tap, the current one ringed, and a
 * last tile to the full page (`settings/app-icon`, `V-AppIcons`), where the
 * Pro ones and their sheet live. A Pro icon still on the home screen leads
 * the strip so the current one is always in it; its tap goes to that page too.
 */
function AppIconBlock({ model }: { model: SettingsModel }) {
  const styles = useStyles()
  const { v3 } = useTheme()
  const { isRtl } = useLocale()
  const { t } = model
  if (!model.iconSupported) return null
  const free = model.appIcons.filter((icon) => !isProIcon(icon))
  const icons = free.includes(model.appIcon) ? free : [model.appIcon, ...free]
  const openPage = () => router.push('/(app)/settings/app-icon')
  return (
    <>
      <SettingsHeadingV3 title={t('settings.appIconSection')} body={t('settings.appIconBody')} />
      <ScrollView
        horizontal
        showsHorizontalScrollIndicator={false}
        contentContainerStyle={styles.iconStrip}
      >
        <View
          accessibilityRole="radiogroup"
          accessibilityLabel={t('settings.appIconSection')}
          style={styles.iconStripGroup}
        >
          {icons.map((icon) => {
            const chosen = model.appIcon === icon
            const label = t(`settings.appIcon_${icon}` as MessageKey)
            return (
              <Pressable
                key={icon}
                accessibilityRole="radio"
                accessibilityLabel={label}
                accessibilityState={{ checked: chosen }}
                onPress={() => (model.iconLocked(icon) ? openPage() : void model.chooseIcon(icon))}
                style={({ pressed }) => [styles.iconTile, pressed && styles.pressed]}
              >
                <View style={[styles.iconRing, chosen && styles.iconRingChosen]}>
                  <Image source={ICON_PREVIEWS[icon]} style={styles.iconImage} />
                </View>
                <Text
                  style={[styles.iconLabel, chosen && styles.iconLabelChosen]}
                  numberOfLines={2}
                >
                  {label}
                </Text>
              </Pressable>
            )
          })}
        </View>
        <Pressable
          accessibilityRole="button"
          accessibilityLabel={t('settings.appIconAll')}
          onPress={openPage}
          style={({ pressed }) => [styles.iconTile, pressed && styles.pressed]}
        >
          <View style={styles.iconRing}>
            <View style={[styles.iconImage, styles.iconMore]}>
              <Feather
                name={isRtl ? 'chevron-left' : 'chevron-right'}
                size={v3.icon.lg}
                color={v3.colors.fg}
              />
            </View>
          </View>
          <Text style={styles.iconLabel} numberOfLines={2}>
            {t('settings.appIconAll')}
          </Text>
        </Pressable>
      </ScrollView>
    </>
  )
}

/** The red outline, and what happens if they change their mind under it. */
function DeleteBlock({ model }: { model: SettingsModel }) {
  const styles = useStyles()
  const { t } = model
  return (
    <View style={styles.deleteBlock}>
      <Button
        label={t('settings.deleteAccount')}
        variant="danger"
        icon="trash-2"
        // A screen, not a dialog, as today: the gate is a typed handle.
        onPress={() => router.push('/(app)/settings/delete-account')}
      />
      <Text style={[styles.caption, styles.centred]}>
        {t('settings.deleteAccountBody', { days: ACCOUNT_DELETION_GRACE_DAYS })}
      </Text>
    </View>
  )
}

/**
 * The plan page: the plan as a block, then today's rows — the renewal line,
 * the store's own page to manage it, what is left of the free allowances,
 * what the plan includes — and "See the plans" only where `showsSeePlans`
 * puts it today, with what Pro adds over it for a free account. Never on a
 * paid Pro.
 */
function PlanPage({ model }: { model: SettingsModel }) {
  const styles = useStyles()
  const { v3 } = useTheme()
  const { t, profile } = model
  const seePlans = showsSeePlans({
    loaded: profile !== undefined,
    tier: model.tier,
    gift: model.gift,
  })
  const benefits = model.tier === 'free' ? [] : benefitsHeld(profile?.welcomePackAt)
  const hasRows = Boolean(model.renewal) || Boolean(model.manageUrl)
  return (
    <>
      <View style={styles.planHero}>
        <Text style={styles.planLabel}>{t('settings.currentPlan')}</Text>
        <Text style={styles.planName}>{model.tierName}</Text>
        <View
          style={styles.planBars}
          accessibilityElementsHidden
          importantForAccessibility="no-hide-descendants"
        >
          {(['lilac', 'aqua', 'tangerine'] as const).map((hue) => (
            <View key={hue} style={[styles.planBar, { backgroundColor: v3.hues[hue] }]} />
          ))}
        </View>
      </View>
      {hasRows ? (
        <SettingsGroupV3>
          {model.renewal ? (
            <SettingsItemV3
              icon="calendar"
              title={model.renewal.label}
              value={model.renewal.value}
            />
          ) : null}
          {model.manageUrl ? (
            <SettingsItemV3
              icon="credit-card"
              title={t('settings.manageSubscription')}
              external
              onPress={() => void openExternal(model.manageUrl!)}
            />
          ) : null}
        </SettingsGroupV3>
      ) : null}
      {benefits.length > 0 ? (
        <>
          <SettingsHeadingV3 title={t('settings.whatYouHave')} />
          <View style={styles.benefits}>
            {benefits.map((benefit) => {
              const tag = pendingTag(BENEFIT_COPY[benefit])
              return (
                <View key={benefit} style={styles.benefit}>
                  <View style={styles.check}>
                    <Feather
                      name="check"
                      size={v3.icon.xs}
                      color={tag ? v3.colors.muted : v3.colors.fg}
                    />
                  </View>
                  <Text style={styles.benefitText}>
                    {t(BENEFIT_TITLE[benefit])}
                    {tag ? <Text style={styles.pending}> · {t(tag)}</Text> : null}
                  </Text>
                </View>
              )
            })}
          </View>
        </>
      ) : null}
      <UsageBlock model={model} />
      {seePlans ? (
        <>
          {/* Beside the road to the plans, the promise of what stays free. */}
          <View style={styles.promise}>
            <Feather name="check-circle" size={v3.icon.md} color={v3.colors.correction} />
            <Text style={styles.promiseText}>{t('paywall.freePromise')}</Text>
          </View>
          {model.tier === 'free' ? (
            <>
              <SettingsHeadingV3 title={t('settings.whatPlanAdds', { plan: TIER_NAMES.pro })} />
              <View style={styles.benefits}>
                {PRO_ADDS.map((benefit) => (
                  <View key={benefit} style={styles.benefit}>
                    <View style={styles.check}>
                      <Feather name="check" size={v3.icon.xs} color={v3.colors.fg} />
                    </View>
                    <Text style={styles.benefitText}>{t(BENEFIT_TITLE[benefit])}</Text>
                  </View>
                ))}
              </View>
            </>
          ) : null}
          <Button
            label={t('settings.upgrade')}
            variant="blue"
            onPress={() => openPaywall(undefined, '/(app)/settings', 'settings')}
          />
        </>
      ) : null}
    </>
  )
}

/**
 * The four the drawing lists under "What Pro adds", by their paywall names.
 * A short pick rather than all of `PRO_BENEFITS`: the paywall is one tap away
 * and lists every one; these are the ones the usage rows above it are about,
 * and the two a free account meets most.
 */
const PRO_ADDS: readonly ProBenefit[] = [
  'unlimitedInitiations',
  'translationQuota',
  'profileViewerIdentities',
  'advancedFilters',
]

/**
 * What is left of the free allowances, as `/me/quota` counts them — the same
 * numbers People and the translate picker show. Both totals are the server's
 * `PLAN_LIMITS` entry for this account, so nothing here knows what "free"
 * gives. A row draws only for an allowance that has a limit, so Pro and a
 * gift see nothing, and nothing draws until the quota has loaded.
 */
function UsageBlock({ model }: { model: SettingsModel }) {
  const styles = useStyles()
  const { v3 } = useTheme()
  const { t } = model
  const quota = useQuota()
  const chats = chatsLeft(quota.data?.initiations)
  // The same clamp and the same "no limit, no row" for the translation count.
  const translations = chatsLeft(quota.data?.translations)
  if (!chats && !translations) return null
  return (
    <SettingsGroupV3>
      {chats ? (
        <UsageRow
          model={model}
          icon="message-circle"
          hue="lilac"
          title={t('settings.usageChats')}
          left={chats.left}
          total={chats.total}
        >
          {chats.pips ? (
            <View style={styles.pips} accessibilityElementsHidden>
              {Array.from({ length: chats.total }, (_, at) => (
                <View
                  key={at}
                  style={[
                    styles.pip,
                    { backgroundColor: at < chats.left ? v3.colors.fg : v3.colors.line },
                  ]}
                />
              ))}
            </View>
          ) : null}
        </UsageRow>
      ) : null}
      {translations ? (
        <UsageRow
          model={model}
          icon="repeat"
          hue="aqua"
          title={t('settings.usageTranslations')}
          left={translations.left}
          total={translations.total}
        >
          <Text style={styles.caption}>
            {t('settings.translationsLeft', { count: translations.left })}
          </Text>
        </UsageRow>
      ) : null}
    </SettingsGroupV3>
  )
}

function UsageRow({
  model,
  icon,
  hue,
  title,
  left,
  total,
  children,
}: {
  model: SettingsModel
  icon: Glyph
  hue: PartnerHue
  title: string
  left: number
  total: number
  children: ReactNode
}) {
  const styles = useStyles()
  const { v3 } = useTheme()
  const { locale } = useLocale()
  const { t } = model
  return (
    <View
      style={styles.usageRow}
      accessible
      accessibilityLabel={t('settings.usageA11y', {
        title,
        left: left.toLocaleString(locale),
        total: total.toLocaleString(locale),
      })}
    >
      <View style={[styles.kindSquare, { backgroundColor: v3.hues[hue] }]}>
        <Feather name={icon} size={v3.icon.md} color={v3.colors.ink} />
      </View>
      <View style={styles.kindText}>
        <Text style={styles.kindTitle}>{title}</Text>
        {children}
      </View>
      <Text style={styles.usageCount}>
        {left.toLocaleString(locale)}
        <Text style={styles.usageTotal}> / {total.toLocaleString(locale)}</Text>
      </Text>
    </View>
  )
}

/** The two things on the page, drawn as the two tiles they lead to. */
function SharePage({ model }: { model: SettingsModel }) {
  const styles = useStyles()
  const { t } = model
  return (
    <>
      <Text style={styles.lede}>{t('settings.shareBody')}</Text>
      {model.profile ? (
        <ShareTile
          hue="tangerine"
          icon="share"
          title={t('me.shareProfile')}
          body={profileUrl(model.profile.handle).replace('https://', '')}
          onPress={() => router.push('/(app)/share-profile')}
        />
      ) : null}
      <ShareTile
        hue="mint"
        icon="user-plus"
        title={t('me.invite')}
        body={t('me.inviteBody')}
        onPress={() => router.push('/(app)/invite')}
      />
    </>
  )
}

function ShareTile({
  hue,
  icon,
  title,
  body,
  onPress,
}: {
  hue: PartnerHue
  icon: Glyph
  title: string
  body: string
  onPress: () => void
}) {
  const styles = useStyles()
  const { v3 } = useTheme()
  const { isRtl } = useLocale()
  return (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel={`${title}. ${body}`}
      onPress={onPress}
      style={({ pressed }) => [
        styles.tile,
        { backgroundColor: v3.hues[hue] },
        pressed && styles.pressed,
      ]}
    >
      <View style={styles.tileTop}>
        <View style={styles.tileDisc}>
          <Feather name={icon} size={v3.icon.xl} color={v3.hues[hue]} />
        </View>
        <Feather
          name={isRtl ? 'arrow-left' : 'arrow-right'}
          size={v3.icon.xl}
          color={v3.colors.ink}
        />
      </View>
      <Text style={styles.tileTitle}>{title}</Text>
      <Text style={styles.tileBody}>{body}</Text>
    </Pressable>
  )
}

/** The toggle's own target, so the column heads sit over the switches. */
const SWITCH_COLUMN = 60

const useStyles = makeStyles(({ v3 }) => ({
  fill: { flex: 1 },
  pressed: { opacity: 0.7 },
  caption: { ...v3.type.caption, color: v3.colors.muted },
  centred: { textAlign: 'center' },
  note: { paddingHorizontal: v3.space[4] },
  lede: { ...v3.type.callout, color: v3.colors.muted, paddingHorizontal: v3.space[4] },
  group: { backgroundColor: v3.colors.surface, borderRadius: v3.radius.tile, overflow: 'hidden' },
  tableHead: {
    alignItems: 'flex-end',
    flexDirection: 'row',
    paddingBottom: v3.space[6],
    paddingEnd: v3.space[6],
    paddingStart: v3.space[12],
    paddingTop: v3.space[12],
  },
  columnHead: {
    ...v3.type.label,
    color: v3.colors.fg,
    textAlign: 'center',
    width: SWITCH_COLUMN,
  },
  kindRow: {
    alignItems: 'center',
    borderTopColor: v3.colors.line,
    borderTopWidth: 1,
    flexDirection: 'row',
    gap: v3.space[8],
    paddingEnd: v3.space[6],
    paddingStart: v3.space[12],
    paddingVertical: v3.space[10],
  },
  kindSquare: {
    alignItems: 'center',
    borderRadius: v3.radius.icon - 1,
    height: 36,
    justifyContent: 'center',
    width: 36,
  },
  kindText: { flex: 1, gap: v3.space[2], minWidth: 0 },
  kindTitle: { ...v3.type.button, color: v3.colors.fg },
  themes: { flexDirection: 'row', gap: v3.space[8] },
  themeTile: {
    alignItems: 'center',
    backgroundColor: v3.colors.surface,
    borderColor: 'transparent',
    borderRadius: v3.radius.tile,
    borderWidth: 2.5,
    flex: 1,
    gap: v3.space[8],
    paddingHorizontal: v3.space[6],
    paddingVertical: v3.space[12],
  },
  themeTileChosen: { borderColor: v3.colors.fg },
  themePreview: {
    borderColor: v3.colors.line,
    borderRadius: 10,
    borderWidth: 1,
    flexDirection: 'row',
    height: 62,
    overflow: 'hidden',
    width: 50,
  },
  mini: { flex: 1, gap: 5, paddingHorizontal: 7, paddingTop: 10 },
  // Each half of Auto carries its own lines, cut off at the middle.
  miniHalf: { paddingHorizontal: 4 },
  miniLine: { borderRadius: 2, height: 4 },
  miniTitle: { height: 5 },
  miniLink: { width: '60%' },
  themeLabel: { ...v3.type.label, color: v3.colors.fg, textAlign: 'center' },
  themeCheck: {
    alignItems: 'center',
    backgroundColor: v3.colors.blue,
    borderColor: v3.colors.surface,
    borderRadius: v3.radius.pill,
    borderWidth: 2,
    end: v3.space[6],
    height: 24,
    justifyContent: 'center',
    position: 'absolute',
    top: v3.space[6],
    width: 24,
  },
  // Top-aligned, so a name that wraps to a second line ("Toutes les icônes")
  // lengthens its own tile and leaves the icons in one line.
  iconStrip: { alignItems: 'flex-start', gap: v3.space[4], paddingHorizontal: v3.space[2] },
  iconStripGroup: { alignItems: 'flex-start', flexDirection: 'row', gap: v3.space[4] },
  iconTile: { alignItems: 'center', gap: v3.space[4], width: 68 },
  iconRing: {
    borderColor: 'transparent',
    borderRadius: v3.radius.icon + 8,
    borderWidth: 2.5,
    padding: 2.5,
  },
  iconRingChosen: { borderColor: v3.colors.fg },
  iconImage: { borderRadius: v3.radius.icon + 2, height: 52, width: 52 },
  iconMore: { alignItems: 'center', backgroundColor: v3.colors.surface, justifyContent: 'center' },
  iconLabel: { ...v3.type.label, color: v3.colors.muted, textAlign: 'center' },
  iconLabelChosen: { color: v3.colors.fg },
  deleteBlock: { gap: v3.space[8], paddingTop: v3.space[8] },
  planHero: {
    backgroundColor: v3.colors.surface,
    borderRadius: v3.radius.block,
    gap: v3.space[4],
    padding: v3.space[20],
  },
  planLabel: { ...v3.type.callout, color: v3.colors.muted, fontWeight: '700' },
  planName: { ...v3.type.display, color: v3.colors.fg },
  planBars: { flexDirection: 'row', gap: v3.space[4], paddingTop: v3.space[10] },
  planBar: { borderRadius: 6, flex: 1, height: 44 },
  benefits: { gap: v3.space[10], paddingHorizontal: v3.space[4] },
  benefit: { alignItems: 'center', flexDirection: 'row', gap: v3.space[12] },
  check: {
    alignItems: 'center',
    backgroundColor: v3.colors.surface,
    borderRadius: v3.radius.pill,
    height: 28,
    justifyContent: 'center',
    width: 28,
  },
  benefitText: { ...v3.type.body, color: v3.colors.fg, flex: 1, fontWeight: '600' },
  pending: { ...v3.type.caption, color: v3.colors.muted, fontWeight: '700' },
  usageRow: {
    alignItems: 'center',
    borderTopColor: v3.colors.line,
    borderTopWidth: 1,
    flexDirection: 'row',
    gap: v3.space[12],
    minHeight: 64,
    paddingEnd: v3.space[16],
    paddingStart: v3.space[12],
    paddingVertical: v3.space[10],
  },
  usageCount: { ...v3.type.headline, color: v3.colors.fg },
  usageTotal: { ...v3.type.caption, color: v3.colors.muted, fontWeight: '700' },
  pips: { flexDirection: 'row', gap: v3.space[4], paddingTop: v3.space[2] },
  pip: { borderRadius: v3.radius.pill, height: 8, width: 16 },
  promise: {
    alignItems: 'center',
    backgroundColor: v3.colors.correctionTint,
    borderRadius: v3.radius.row,
    flexDirection: 'row',
    gap: v3.space[10],
    padding: v3.space[14],
  },
  promiseText: { ...v3.type.callout, color: v3.colors.correction, flex: 1, fontWeight: '700' },
  tile: { borderRadius: v3.radius.block, gap: v3.space[2], padding: v3.space[20] },
  tileTop: {
    alignItems: 'center',
    flexDirection: 'row',
    justifyContent: 'space-between',
    paddingBottom: v3.space[12],
  },
  tileDisc: {
    alignItems: 'center',
    backgroundColor: v3.colors.ink,
    borderRadius: v3.radius.pill,
    height: 60,
    justifyContent: 'center',
    width: 60,
  },
  tileTitle: { ...v3.type.headline, color: v3.colors.ink },
  tileBody: { ...v3.type.callout, color: v3.colors.ink, fontWeight: '600' },
}))

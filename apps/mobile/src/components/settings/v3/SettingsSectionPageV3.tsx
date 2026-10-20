import Feather from '@expo/vector-icons/Feather'
import { ACCOUNT_DELETION_GRACE_DAYS, NOTIFICATION_CHANNELS, profileUrl } from '@langx/shared'
import { router } from 'expo-router'
import { Image, Pressable, Text, View } from 'react-native'
import { useSettingsModel, type SettingsModel } from '../../../hooks/useSettingsModel'
import { useLocale, type MessageKey } from '../../../i18n'
import { openExternal } from '../../../lib/openExternal'
import { openPaywall } from '../../../lib/paywall'
import { benefitsHeld } from '../../../lib/paywallBenefits'
import { showsSeePlans } from '../../../lib/proRoads'
import { HIDDEN_MODE_CHILDREN, SETTINGS_V3_LAYOUT } from '../../../lib/settingsLayoutV3'
import { settingsSection, type SettingsSectionId } from '../../../lib/settingsRegistry'
import { makeStyles, THEME_PREFERENCES, useTheme, type PartnerHue } from '../../../lib/theme'
import { Button } from '../../ui/Button'
import { SegmentedControl } from '../../ui/SegmentedControl'
import { Toggle } from '../../ui/Toggle'
import { BENEFIT_TITLE, ICON_PREVIEWS, PENDING_BENEFITS, THEME_LABELS } from '../SettingsRow'
import {
  SettingsGroupV3,
  SettingsHeadingV3,
  SettingsItemV3,
  SettingsScreenV3,
  type Glyph,
} from './SettingsKitV3'
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

/** Auto, light or dark, as one segmented choice: the same three options, the same setter. */
function ThemeBlock({ model }: { model: SettingsModel }) {
  const { t, theme } = model
  return (
    <>
      <SettingsHeadingV3 title={t('theme.label')} />
      <SegmentedControl
        accessibilityLabel={t('theme.label')}
        options={THEME_PREFERENCES.map((value) => ({ value, label: t(THEME_LABELS[value]) }))}
        selected={[theme.preference]}
        onToggle={theme.setPreference}
      />
    </>
  )
}

/** Only where there is a home screen to put an icon on, as today. */
function AppIconBlock({ model }: { model: SettingsModel }) {
  const styles = useStyles()
  const { t } = model
  if (!model.iconSupported) return null
  return (
    <>
      <SettingsHeadingV3 title={t('settings.appIconSection')} body={t('settings.appIconBody')} />
      <View style={styles.iconTiles}>
        {model.appIcons.map((name) => {
          const chosen = model.appIcon === name
          const label = t(`settings.appIcon_${name}` as MessageKey)
          return (
            <Pressable
              key={name}
              accessibilityRole="button"
              accessibilityLabel={label}
              accessibilityState={{ selected: chosen }}
              onPress={() => void model.chooseIcon(name)}
              style={({ pressed }) => [styles.iconTile, pressed && styles.pressed]}
            >
              <View style={[styles.iconRing, chosen && styles.iconRingChosen]}>
                <Image source={ICON_PREVIEWS[name]} style={styles.iconImage} />
              </View>
              <Text style={[styles.iconLabel, !chosen && styles.iconLabelOff]}>{label}</Text>
            </Pressable>
          )
        })}
      </View>
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
 * the store's own page to manage it, what the plan includes — and "See the
 * plans" only where `showsSeePlans` puts it today. Never on a paid Pro.
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
              const pending = PENDING_BENEFITS.has(benefit)
              return (
                <View key={benefit} style={styles.benefit}>
                  <View style={styles.check}>
                    <Feather
                      name="check"
                      size={v3.icon.xs}
                      color={pending ? v3.colors.muted : v3.colors.fg}
                    />
                  </View>
                  <Text style={styles.benefitText}>
                    {t(BENEFIT_TITLE[benefit])}
                    {pending ? (
                      <Text style={styles.pending}> · {t('common.comingSoon')}</Text>
                    ) : null}
                  </Text>
                </View>
              )
            })}
          </View>
        </>
      ) : null}
      {seePlans ? (
        <>
          {/* Beside the road to the plans, the promise of what stays free. */}
          <View style={styles.promise}>
            <Feather name="check-circle" size={v3.icon.md} color={v3.colors.correction} />
            <Text style={styles.promiseText}>{t('paywall.freePromise')}</Text>
          </View>
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
  iconTiles: { flexDirection: 'row', flexWrap: 'wrap', gap: v3.space[6] },
  iconTile: { alignItems: 'center', gap: v3.space[4], minWidth: 64 },
  iconRing: {
    borderColor: 'transparent',
    borderRadius: 19,
    borderWidth: 3,
    padding: 2,
  },
  iconRingChosen: { borderColor: v3.colors.fg },
  iconImage: { borderRadius: v3.radius.icon + 2, height: 56, width: 56 },
  iconLabel: { ...v3.type.label, color: v3.colors.fg },
  iconLabelOff: { color: v3.colors.muted },
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

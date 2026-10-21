import Feather from '@expo/vector-icons/Feather'
import { TIER_NAMES } from '@langx/shared'
import { useState } from 'react'
import { Image, Pressable, ScrollView, Text, View } from 'react-native'
import { AppIconProSheet } from '../../components/settings/v3/AppIconProSheet'
import { ICON_PREVIEWS } from '../../components/settings/SettingsRow'
import {
  ProTagV3,
  SettingsHeaderV3,
  SettingsHeadingV3,
} from '../../components/settings/v3/SettingsKitV3'
import { Screen } from '../../components/ui/Screen'
import { useScreenInteractive } from '../../hooks/useScreenInteractive'
import { useSettingsModel, type SettingsModel } from '../../hooks/useSettingsModel'
import { type MessageKey } from '../../i18n'
import { isProIcon, type AppIcon } from '../../lib/appIconList'
import { goBackTo } from '../../lib/navigation'
import { makeStyles, useTheme } from '../../lib/theme'

/**
 * The app-icon picker in the redesign's look (`V-AppIcons`), behind
 * `flags.v3Home`: a home-screen preview pinned at the top, the free icons,
 * then the Pro ones, each Pro tile with its full artwork and a small plan tag —
 * no lock, no greying. The current one is ringed and checked.
 *
 * What a tap does is the model's (`appIconTap`): a free icon is chosen on any
 * plan, a Pro one by Pro. On the free plan a Pro tile opens `AppIconProSheet`
 * first, and only its "See Pro" opens the paywall. Hidden on the web and in
 * Expo Go, where there is no home screen, as the old picker is.
 */
export function AppIconScreenV3() {
  useScreenInteractive()
  const model = useSettingsModel()
  const { t } = model
  const styles = useStyles()
  const { v3 } = useTheme()
  const [selling, setSelling] = useState<AppIcon | null>(null)
  const plan = TIER_NAMES.pro
  const free = model.appIcons.filter((name) => !isProIcon(name))
  const pro = model.appIcons.filter(isProIcon)
  // Neither line until the profile has loaded: before then every account
  // reads as free, and a subscriber must not be told to tap to see Pro.
  const proBody =
    model.profile === undefined
      ? undefined
      : model.iconLocked('iznikTile')
        ? t('settings.appIconProBody', { plan })
        : t('settings.appIconProBodyOwned', { plan })
  const name = (icon: AppIcon) => t(`settings.appIcon_${icon}` as MessageKey)

  function tap(icon: AppIcon) {
    if (model.iconLocked(icon)) setSelling(icon)
    else void model.chooseIcon(icon)
  }

  function tile(icon: AppIcon) {
    const chosen = model.appIcon === icon
    const tagged = isProIcon(icon)
    const label = name(icon)
    return (
      <Pressable
        key={icon}
        accessibilityRole="radio"
        accessibilityLabel={
          chosen
            ? t('settings.appIconTileCurrent', { icon: label })
            : tagged
              ? t('settings.appIconTilePro', { icon: label, plan })
              : label
        }
        accessibilityState={{ checked: chosen }}
        onPress={() => tap(icon)}
        style={({ pressed }) => [styles.tile, pressed && styles.pressed]}
      >
        <View style={[styles.ring, chosen && styles.ringChosen]}>
          <Image
            source={ICON_PREVIEWS[icon]}
            style={styles.image}
            accessibilityIgnoresInvertColors
          />
        </View>
        {chosen ? (
          <View style={styles.check}>
            <Feather name="check" size={v3.icon.xs} color={v3.colors.onBlue} />
          </View>
        ) : null}
        <Text style={[styles.label, chosen && styles.labelChosen]} numberOfLines={2}>
          {label}
        </Text>
        {tagged ? <ProTagV3 label={plan} /> : null}
      </Pressable>
    )
  }

  return (
    <Screen fluid ground={v3.colors.bg}>
      <SettingsHeaderV3
        title={t('settings.appIconSection')}
        onBack={() => goBackTo('/(app)/settings/appearance')}
      />
      {model.iconSupported ? (
        <ScrollView
          style={styles.fill}
          contentContainerStyle={styles.content}
          // The preview stays pinned while the grid scrolls under it.
          stickyHeaderIndices={[0]}
        >
          <Preview model={model} />
          <SettingsHeadingV3 title={TIER_NAMES.free} body={t('settings.appIconFreeBody')} />
          <View accessibilityRole="radiogroup" style={styles.grid}>
            {free.map(tile)}
          </View>
          <SettingsHeadingV3 title={plan} body={proBody} />
          <View accessibilityRole="radiogroup" style={styles.grid}>
            {pro.map(tile)}
          </View>
          <Text style={styles.footnote}>{t('settings.appIconFootnote')}</Text>
        </ScrollView>
      ) : null}
      <AppIconProSheet
        icon={selling}
        onClose={() => setSelling(null)}
        onSeePro={() => {
          setSelling(null)
          model.openIconPaywall()
        }}
      />
    </Screen>
  )
}

/**
 * A strip of home screen with the chosen icon in its place among blank
 * neighbours: what the person will actually see, at the size they see it.
 */
function Preview({ model }: { model: SettingsModel }) {
  const styles = useStyles()
  const { t } = model
  return (
    <View style={styles.previewWrap}>
      <View style={styles.preview}>
        <View style={styles.previewHead}>
          <Text style={styles.previewText}>{t('settings.appIconOnHomeScreen')}</Text>
          <Text style={styles.previewText} numberOfLines={1}>
            {t(`settings.appIcon_${model.appIcon}` as MessageKey)}
          </Text>
        </View>
        <View
          style={styles.previewRow}
          accessibilityElementsHidden
          importantForAccessibility="no-hide-descendants"
        >
          <Blank />
          <View style={styles.app}>
            <Image source={ICON_PREVIEWS[model.appIcon]} style={styles.appIcon} />
            <Text style={styles.appName}>{t('settings.appIconAppName')}</Text>
          </View>
          <Blank />
          <Blank />
        </View>
      </View>
    </View>
  )
}

function Blank() {
  const styles = useStyles()
  return (
    <View style={styles.app}>
      <View style={styles.blankIcon} />
      <View style={styles.blankName} />
    </View>
  )
}

/** iOS's own home-screen icon at 60 points, and its corner. */
const HOME_ICON = 60
const TILE_ICON = 56

const useStyles = makeStyles(({ v3 }) => ({
  fill: { flex: 1 },
  content: { gap: v3.space[10], paddingBottom: v3.space[24] },
  previewWrap: { backgroundColor: v3.colors.bg, paddingBottom: v3.space[6] },
  preview: {
    backgroundColor: v3.colors.surface,
    borderRadius: v3.radius.block,
    gap: v3.space[10],
    paddingHorizontal: v3.space[14],
    paddingVertical: v3.space[12],
  },
  previewHead: { flexDirection: 'row', gap: v3.space[8], justifyContent: 'space-between' },
  previewText: { ...v3.type.label, color: v3.colors.muted, flexShrink: 1 },
  previewRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    paddingHorizontal: v3.space[4],
  },
  app: { alignItems: 'center', gap: v3.space[6], width: HOME_ICON + 4 },
  appIcon: { borderRadius: HOME_ICON / 4, height: HOME_ICON, width: HOME_ICON },
  appName: { ...v3.type.caption, color: v3.colors.fg, fontWeight: '600' },
  blankIcon: {
    backgroundColor: v3.colors.line,
    borderRadius: HOME_ICON / 4,
    height: HOME_ICON,
    width: HOME_ICON,
  },
  blankName: {
    backgroundColor: v3.colors.line,
    borderRadius: 3,
    height: 6,
    marginTop: v3.space[4],
    width: 34,
  },
  // Four to a row, as drawn; each tile is a full-width quarter so a long
  // name wraps under its own icon instead of pushing the grid.
  grid: { flexDirection: 'row', flexWrap: 'wrap', rowGap: v3.space[8] },
  tile: {
    alignItems: 'center',
    gap: v3.space[4],
    minHeight: 108,
    paddingBottom: v3.space[4],
    width: '25%',
  },
  pressed: { opacity: 0.6 },
  ring: {
    borderColor: 'transparent',
    borderRadius: v3.radius.icon + 9,
    borderWidth: 3,
    padding: 3,
  },
  ringChosen: { borderColor: v3.colors.fg },
  image: { borderRadius: v3.radius.icon + 2, height: TILE_ICON, width: TILE_ICON },
  check: {
    alignItems: 'center',
    backgroundColor: v3.colors.blue,
    borderColor: v3.colors.bg,
    borderRadius: v3.radius.pill,
    borderWidth: 2,
    end: v3.space[6],
    height: 24,
    justifyContent: 'center',
    position: 'absolute',
    top: 0,
    width: 24,
  },
  label: { ...v3.type.label, color: v3.colors.muted, textAlign: 'center' },
  labelChosen: { color: v3.colors.fg },
  footnote: { ...v3.type.caption, color: v3.colors.muted, paddingHorizontal: v3.space[4] },
}))

import Feather from '@expo/vector-icons/Feather'
import { router } from 'expo-router'
import * as Updates from 'expo-updates'
import { useState } from 'react'
import { Platform, Text, TextInput, View } from 'react-native'
import {
  SettingsGroupV3,
  SettingsItemV3,
  SettingsScreenV3 as Shell,
  type Glyph,
} from '../components/settings/v3/SettingsKitV3'
import { Button } from '../components/ui/Button'
import { appVersion } from '../hooks/useAppConfig'
import { useScreenInteractive } from '../hooks/useScreenInteractive'
import { useSettingsModel } from '../hooks/useSettingsModel'
import { ADMIN } from '../lib/adminStrings'
import { matchSettings, SETTINGS_SECTIONS, type SettingsSectionId } from '../lib/settingsRegistry'
import { makeStyles, useTheme, type PartnerHue } from '../lib/theme'

/** The categories in the drawing's blocks: what you have, what others see, you. */
const GROUPS: readonly (readonly SettingsSectionId[])[] = [
  ['plan', 'share'],
  ['privacy', 'notifications', 'appearance'],
  ['account', 'about'],
]

const SECTION_LOOK: Record<SettingsSectionId, { icon: Glyph; hue?: PartnerHue }> = {
  plan: { icon: 'star', hue: 'lilac' },
  share: { icon: 'share-2', hue: 'tangerine' },
  privacy: { icon: 'shield', hue: 'mint' },
  notifications: { icon: 'bell', hue: 'sky' },
  appearance: { icon: 'sun', hue: 'aqua' },
  account: { icon: 'user', hue: 'lime' },
  about: { icon: 'info' },
}

/**
 * Settings under `flags.v3Home`, from `V-Settings`. Today's landing page in
 * the redesign's blocks: the search, the scanner on native, the categories,
 * the operator row for an admin, Sign out, and the build line support asks
 * for. Same search, same routes, same sign-out.
 */
export function SettingsScreenV3() {
  useScreenInteractive()
  const styles = useStyles()
  const { v3 } = useTheme()
  const model = useSettingsModel()
  const { t } = model
  const [query, setQuery] = useState('')

  const matches = matchSettings(SETTINGS_SECTIONS, query, t).filter(
    // No "Allow calls" result where the page would not draw the row.
    ({ item }) => item.id !== 'privacy.allowCalls' || model.callsRow,
  )
  const searching = query.trim().length >= 2
  const sectionById = new Map(SETTINGS_SECTIONS.map((s) => [s.id, s]))

  return (
    <Shell title={t('settings.title')} back="/(app)/(tabs)/me">
      <View style={styles.search}>
        <Feather name="search" size={v3.icon.md} color={v3.colors.muted} />
        <TextInput
          value={query}
          onChangeText={setQuery}
          placeholder={t('settings.search')}
          placeholderTextColor={v3.colors.muted}
          autoCapitalize="none"
          autoCorrect={false}
          clearButtonMode="while-editing"
          accessibilityLabel={t('settings.search')}
          style={styles.searchInput}
        />
      </View>

      {searching ? (
        matches.length === 0 ? (
          <Text style={styles.none}>{t('settings.searchNone')}</Text>
        ) : (
          <SettingsGroupV3>
            {matches.map(({ section, item }) => (
              <SettingsItemV3
                key={item.id}
                icon={SECTION_LOOK[section.id].icon}
                hue={SECTION_LOOK[section.id].hue}
                // The category it lives in, as the line under it.
                title={t(item.titleKey)}
                subtitle={t(section.titleKey)}
                onPress={() => router.push(section.route)}
              />
            ))}
          </SettingsGroupV3>
        )
      ) : (
        <>
          {Platform.OS !== 'web' ? (
            <SettingsGroupV3>
              <SettingsItemV3
                icon="maximize"
                title={t('me.scan')}
                subtitle={t('settings.scanBody')}
                onPress={() => router.push('/(app)/scan')}
              />
            </SettingsGroupV3>
          ) : null}
          {GROUPS.map((ids, index) => (
            <SettingsGroupV3 key={ids[0]}>
              {ids.map((id) => {
                const section = sectionById.get(id)
                if (!section) return null
                return (
                  <SettingsItemV3
                    key={id}
                    icon={SECTION_LOOK[id].icon}
                    hue={SECTION_LOOK[id].hue}
                    title={t(section.titleKey)}
                    subtitle={t(section.bodyKey)}
                    value={id === 'plan' && model.profile ? model.tierName : undefined}
                    onPress={() => router.push(section.route)}
                  />
                )
              })}
              {/* The moderator's queue, for a moderator only — in their own language. */}
              {index === GROUPS.length - 1 && model.profile?.moderator ? (
                <SettingsItemV3
                  icon="shield"
                  hue="aqua"
                  title={t('moderation.title')}
                  onPress={() => router.push('/(app)/moderation')}
                />
              ) : null}
              {/* The operator panel, for an admin only, under About — English by design. */}
              {index === GROUPS.length - 1 && model.profile?.admin ? (
                <SettingsItemV3
                  icon="tool"
                  title={ADMIN.entryRow}
                  onPress={() => router.push('/(app)/admin')}
                />
              ) : null}
            </SettingsGroupV3>
          ))}
        </>
      )}

      <Button
        label={t('settings.signOut')}
        variant="danger"
        icon="log-out"
        onPress={() => void model.signOut()}
        loading={model.signingOut}
        style={styles.signOut}
      />

      {/* Version, the update actually running, and the account id: what a support reply asks for. */}
      <Text style={styles.build} selectable>
        v{appVersion()}
        {Updates.updateId ? ` (${Updates.updateId.slice(0, 8)})` : ''} {t('settings.licence')}
        {model.profile ? `\n${model.profile._id}` : ''}
      </Text>
    </Shell>
  )
}

const useStyles = makeStyles(({ v3 }) => ({
  search: {
    alignItems: 'center',
    backgroundColor: v3.colors.surface,
    borderRadius: v3.radius.pill,
    flexDirection: 'row',
    gap: v3.space[10],
    height: 52,
    paddingHorizontal: v3.space[16],
  },
  searchInput: { ...v3.type.body, color: v3.colors.fg, flex: 1, height: '100%' },
  none: { ...v3.type.callout, color: v3.colors.muted, paddingVertical: 40, textAlign: 'center' },
  signOut: { marginTop: v3.space[8] },
  build: { ...v3.type.caption, color: v3.colors.muted, textAlign: 'center' },
}))

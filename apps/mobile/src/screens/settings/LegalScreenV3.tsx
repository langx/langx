import { Text } from 'react-native'
import {
  SettingsGroupV3,
  SettingsItemV3,
  SettingsScreenV3,
  type Glyph,
} from '../../components/settings/v3/SettingsKitV3'
import { useScreenInteractive } from '../../hooks/useScreenInteractive'
import { useT } from '../../i18n'
import { appVersion } from '../../lib/appVersion'
import { LEGAL_LINKS } from '../../lib/externalLinks'
import { openExternal } from '../../lib/openExternal'
import { makeStyles } from '../../lib/theme'
import type { PartnerHue } from '../../lib/theme'

/** Each row's square, by the link it opens; the neutral grey where none is named. */
const HUES: Partial<Record<string, PartnerHue>> = {
  'legal.community': 'lilac',
  'legal.privacy': 'mint',
  'legal.cookies': 'tangerine',
  'legal.security': 'sky',
}

/**
 * The legal links in the redesign's look (`V-Legal`), behind `flags.v3Home`.
 * The same six links, word for word and in the same order, as `legal.tsx`;
 * the community guidelines stand apart as the one row somebody might read by
 * choice, the five the stores and the law expect under them. Every row
 * leaves the app, so each ends in the open-outside glyph and is a link.
 */
export function LegalScreenV3() {
  useScreenInteractive()
  const styles = useStyles()
  const t = useT()
  const [first, ...rest] = LEGAL_LINKS

  const row = (link: (typeof LEGAL_LINKS)[number]) => (
    <SettingsItemV3
      key={link.url}
      icon={link.icon as Glyph}
      hue={HUES[link.labelKey ?? '']}
      title={t(link.labelKey as never)}
      external
      onPress={() => void openExternal(link.url)}
    />
  )

  return (
    <SettingsScreenV3 title={t('settings.legalSection')} back="/(app)/settings">
      {first ? <SettingsGroupV3>{row(first)}</SettingsGroupV3> : null}
      <SettingsGroupV3>{rest.map(row)}</SettingsGroupV3>
      <Text style={styles.note}>{t('legal.opensInBrowser')}</Text>
      {/* The settings footer's version line, minus the build id, as today. */}
      <Text style={styles.footer}>
        v{appVersion()} {t('settings.licence')}
      </Text>
    </SettingsScreenV3>
  )
}

const useStyles = makeStyles(({ v3 }) => ({
  note: { ...v3.type.caption, color: v3.colors.muted, paddingStart: v3.space[6] },
  footer: {
    ...v3.type.label,
    color: v3.colors.muted,
    fontFamily: undefined,
    marginTop: v3.space[10],
    textAlign: 'center',
  },
}))

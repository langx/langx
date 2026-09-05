import type { LanguageLevel } from '@langx/shared'
import { Text, View } from 'react-native'
import { levelLabel, useDisplayNames, useT } from '../i18n'
import { makeStyles } from '../lib/theme'
import { LevelBars } from './ui/LevelBars'

interface LanguageColumnsProps {
  nativeLanguages: readonly { code: string }[]
  learning: readonly { code: string; level: LanguageLevel; priority: number }[]
}

/**
 * v3's two-column language block: teaches on the left, learns on the right,
 * level bars instead of level words.
 *
 * One component for the public profile and the owner's own tab. The owner's
 * screen used to compress the same facts into a single row ("Turkish →
 * English" and one set of bars), which read as a different profile from the
 * one everybody else was shown. Drawing both from here means what you see
 * about yourself is what they see about you.
 */
export function LanguageColumns({ nativeLanguages, learning }: LanguageColumnsProps) {
  const styles = useStyles()
  const t = useT()
  const names = useDisplayNames()
  // `priority` is the order the user picked them in; the API has always sent it.
  const study = [...learning].sort((a, b) => a.priority - b.priority)

  if (nativeLanguages.length === 0 && study.length === 0) return null

  return (
    <View style={styles.languages}>
      <View style={styles.languageColumn}>
        <Text style={styles.kicker}>{t('profile.teaches')}</Text>
        {nativeLanguages.map((language) => (
          <View key={language.code} style={styles.languageEntry}>
            <Text style={styles.languageName}>{names.language(language.code)}</Text>
            {/* `level` is ignored when `native` draws all five bars. */}
            <LevelBars level="fluent" native size={17} />
          </View>
        ))}
      </View>
      <View style={styles.languageColumn}>
        <Text style={styles.kicker}>{t('profile.learns')}</Text>
        {study.map((language) => (
          <View key={language.code} style={styles.languageEntry}>
            <Text
              style={[styles.languageName, styles.languageNameAccent]}
              accessibilityLabel={`${names.language(language.code)} · ${levelLabel(t, language.level)}`}
            >
              {names.language(language.code)}
            </Text>
            <LevelBars level={language.level} />
          </View>
        ))}
      </View>
    </View>
  )
}

const useStyles = makeStyles(({ colors, font, spacing }) => ({
  languages: {
    borderBottomColor: colors.border,
    borderBottomWidth: 1,
    flexDirection: 'row',
    marginTop: spacing.lg,
    paddingBottom: 18,
  },
  languageColumn: { flex: 1 },
  languageEntry: { marginTop: 3 },
  kicker: { color: colors.textFaint, fontSize: 12, fontWeight: '600' },
  languageName: { ...font.heading, color: colors.text, fontSize: 18, marginBottom: 5 },
  languageNameAccent: { color: colors.accent },
}))

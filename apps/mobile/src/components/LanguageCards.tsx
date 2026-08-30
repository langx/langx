import { getLanguage, type LanguageLevel } from '@langx/shared'
import type { ReactNode } from 'react'
import { Text, View } from 'react-native'
import { LevelBars } from './ui/LevelBars'
import { makeStyles } from '../lib/theme'
import { levelLabel, useDisplayNames, useT } from '../i18n'

interface LanguageCardsProps {
  native: { code: string }[]
  learning: { code: string; level: LanguageLevel; priority: number }[]
}

/**
 * The two language groups from a profile: what someone is learning, and what
 * they grew up with. Both profile screens render this, so they stop wording
 * the same two lists differently — `me` called them "My languages" in one
 * block, `profile/[handle]` split them into "Speaks" and "Learning".
 *
 * The level is the little ascending bars and nothing else. Spelling it out is
 * what produced "Spanish · absoluteBeginner" on both screens; the enum was
 * never meant to be read, and the bars say the same thing without a label to
 * get wrong. Native languages draw the fifth bar — home turf.
 */
export function LanguageCards({ native, learning }: LanguageCardsProps) {
  const t = useT()

  // `priority` is the order the user picked them in. The API has always sent
  // it and no screen has ever used it.
  const study = [...learning].sort((a, b) => a.priority - b.priority)

  return (
    <>
      {study.length > 0 ? (
        <Section
          title={t('languageCards.studyTitle')}
          subtitle={t('languageCards.studySubtitle')}
          divided={native.length > 0}
        >
          {study.map((language) => (
            <LanguageChip key={language.code} code={language.code} level={language.level} />
          ))}
        </Section>
      ) : null}

      {native.length > 0 ? (
        <Section
          title={t('languageCards.nativeTitle')}
          subtitle={t('languageCards.nativeSubtitle')}
        >
          {native.map((language) => (
            <LanguageChip key={language.code} code={language.code} native />
          ))}
        </Section>
      ) : null}
    </>
  )
}

function Section({
  title,
  subtitle,
  divided = false,
  children,
}: {
  title: string
  subtitle: string
  /** Sections draw their own hairline, and the last one must not. */
  divided?: boolean
  children: ReactNode
}) {
  const styles = useStyles()

  return (
    <View style={[styles.section, divided && styles.dividedSection]}>
      <Text style={styles.title}>{title}</Text>
      <Text style={styles.subtitle}>{subtitle}</Text>
      <View style={styles.chips}>{children}</View>
    </View>
  )
}

/**
 * `nativeName` is dropped when it repeats the name — "English English" reads
 * as a rendering bug rather than as extra information.
 */
function LanguageChip({
  code,
  level,
  native = false,
}: {
  code: string
  level?: LanguageLevel
  native?: boolean
}) {
  const styles = useStyles()
  const names = useDisplayNames()
  const t = useT()

  const language = getLanguage(code)
  // Compared against the *localized* name, not the English one: to a French
  // reader "Français" beside "Français" is the duplication this guard exists
  // to prevent, and it never was beside "French".
  const shown = names.language(code)
  const nativeName = language && language.nativeName !== shown ? language.nativeName : null

  return (
    // The bars hide themselves from the tree, so the chip says the level out
    // loud — the one place it is still words.
    <View
      style={styles.chip}
      accessibilityLabel={level ? `${shown}, ${levelLabel(t, level)}` : shown}
    >
      <Text style={styles.chipLabel}>{shown}</Text>
      {nativeName ? <Text style={styles.chipNative}>{nativeName}</Text> : null}
      {native ? (
        <LevelBars level="fluent" native size={17} />
      ) : level ? (
        <LevelBars level={level} />
      ) : null}
    </View>
  )
}

const useStyles = makeStyles(({ colors, font, spacing, radius }) => ({
  section: { paddingVertical: 18 },
  dividedSection: { borderBottomColor: colors.border, borderBottomWidth: 1 },
  title: { ...font.heading, color: colors.text, fontSize: 16 },
  subtitle: { color: colors.textMuted, fontSize: 13, marginTop: 2 },
  chips: { flexDirection: 'row', flexWrap: 'wrap', gap: 7, marginTop: spacing.md },
  chip: {
    alignItems: 'center',
    backgroundColor: colors.accentBg,
    borderRadius: radius.pill,
    flexDirection: 'row',
    gap: 6,
    paddingHorizontal: 14,
    paddingVertical: 8,
  },
  chipLabel: { color: colors.accent, fontSize: 13, fontWeight: '600' },
  chipNative: { color: colors.textMuted, fontSize: 12 },
}))

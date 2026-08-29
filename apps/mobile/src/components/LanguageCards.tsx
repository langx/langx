import { Ionicons } from '@expo/vector-icons'
import { getLanguage, type LanguageLevel } from '@langx/shared'
import type { ReactNode } from 'react'
import { Text, View } from 'react-native'
import { LEVEL_ICON } from '../lib/languageLevel'
import { makeStyles, useTheme } from '../lib/theme'
import { levelLabel, useDisplayNames, useT } from '../i18n'

interface LanguageCardsProps {
  native: { code: string }[]
  learning: { code: string; level: LanguageLevel; priority: number }[]
}

const ICON_SIZE = 20

/**
 * The two language cards from a profile: what someone is learning, and what
 * they grew up with. Both profile screens render this, so they stop wording
 * the same two lists differently — `me` called them "My languages" in one
 * block, `profile/[handle]` split them into "Speaks" and "Learning".
 *
 * The level is an icon and nothing else. Spelling it out is what produced
 * "Spanish · absoluteBeginner" on both screens; the enum was never meant to be
 * read, and the icon says the same thing without a label to get wrong.
 */
export function LanguageCards({ native, learning }: LanguageCardsProps) {
  const { colors } = useTheme()
  const styles = useStyles()
  const t = useT()

  // `priority` is the order the user picked them in. The API has always sent
  // it and no screen has ever used it.
  const study = [...learning].sort((a, b) => a.priority - b.priority)

  return (
    <>
      {study.length > 0 ? (
        <Card title={t('languageCards.studyTitle')} subtitle={t('languageCards.studySubtitle')}>
          {study.map((language) => (
            <LanguageRow
              key={language.code}
              code={language.code}
              icon={
                <Ionicons
                  name={LEVEL_ICON[language.level]}
                  size={ICON_SIZE}
                  color={colors.accent}
                  // The icon carries the level on its own now, so this is the
                  // only thing left that can say it out loud.
                  accessibilityLabel={levelLabel(t, language.level)}
                />
              }
            />
          ))}
        </Card>
      ) : null}

      {native.length > 0 ? (
        <Card title={t('languageCards.nativeTitle')} subtitle={t('languageCards.nativeSubtitle')}>
          {native.map((language) => (
            <LanguageRow
              key={language.code}
              code={language.code}
              icon={<Text style={styles.emoji}>🗣️</Text>}
            />
          ))}
        </Card>
      ) : null}
    </>
  )
}

function Card({
  title,
  subtitle,
  children,
}: {
  title: string
  subtitle: string
  children: ReactNode
}) {
  const styles = useStyles()

  return (
    <View style={styles.card}>
      <Text style={styles.title}>{title}</Text>
      <Text style={styles.subtitle}>{subtitle}</Text>
      <View style={styles.rows}>{children}</View>
    </View>
  )
}

/**
 * `nativeName` is dropped when it repeats the name — "English English" reads
 * as a rendering bug rather than as extra information.
 */
function LanguageRow({ code, icon }: { code: string; icon: ReactNode }) {
  const styles = useStyles()
  const names = useDisplayNames()

  const language = getLanguage(code)
  // Compared against the *localized* name, not the English one: to a French
  // reader "Français" beside "Français" is the duplication this guard exists
  // to prevent, and it never was beside "French".
  const shown = names.language(code)
  const nativeName = language && language.nativeName !== shown ? language.nativeName : null

  return (
    <View style={styles.row}>
      <View style={styles.iconSlot}>{icon}</View>
      <Text style={styles.name}>{shown}</Text>
      {nativeName ? <Text style={styles.nativeName}>{nativeName}</Text> : null}
    </View>
  )
}

const useStyles = makeStyles(({ colors, font, spacing, radius }) => ({
  card: {
    borderColor: colors.border,
    borderRadius: radius.lg,
    borderWidth: 1,
    marginTop: spacing.md,
    padding: spacing.md,
  },
  title: { ...font.heading, color: colors.text },
  subtitle: { ...font.caption, color: colors.textMuted, marginTop: 2 },
  rows: { marginTop: spacing.md },
  row: { alignItems: 'center', flexDirection: 'row', gap: spacing.md, paddingVertical: spacing.sm },
  /** Fixed, so the names line up whether the row shows an icon or an emoji. */
  iconSlot: { alignItems: 'center', width: ICON_SIZE },
  emoji: { fontSize: 16 },
  name: { ...font.body, color: colors.text, flex: 1 },
  nativeName: { ...font.caption, color: colors.textMuted },
}))

import { useMemo } from 'react'
import { Modal, Pressable, ScrollView, Text, View } from 'react-native'
import { useDisplayNames, useT } from '../i18n'
import { makeStyles } from '../lib/theme'
import { Checkbox } from './ui/Checkbox'

export interface LanguageScope {
  /** Of the languages I speak, the ones this search is made with. */
  native: string[]
  /** Of the languages I'm learning, the ones this search is made with. */
  learning: string[]
}

interface LanguageScopeSheetProps {
  visible: boolean
  onClose: () => void
  /** Every language on the profile, in the profile's own order. */
  nativeCodes: readonly string[]
  learningCodes: readonly string[]
  scope: LanguageScope
  onChange: (next: LanguageScope) => void
}

/**
 * Which of your own languages Discover searches with.
 *
 * Behind the header's language pair, which used to be a label reading
 * `nativeLanguages[0] → learning[0]` — "the first of each, since the header
 * has room for one pair" — while the server matched on every language on
 * both sides. For anyone with more than one language it described a narrower
 * search than the one that ran, and there was no way to choose. Now the label
 * says what the search is made with, and tapping it is how that changes.
 *
 * Every language starts ticked: an untouched search is the whole match, as it
 * always was. The last ticked language in a group cannot be unticked — a
 * search with no language is a question with no answer, and the server
 * refuses it — so the rule is shown as a disabled row rather than met as an
 * error. A free account has one language on each side, and the sheet says so
 * by having nothing to untick; the upsell is in *adding* languages, which is
 * where the tiers already differ, not in filtering them.
 */
export function LanguageScopeSheet({
  visible,
  onClose,
  nativeCodes,
  learningCodes,
  scope,
  onChange,
}: LanguageScopeSheetProps) {
  const t = useT()
  const names = useDisplayNames()
  const styles = useStyles()

  const groups = useMemo(
    () =>
      [
        { key: 'native' as const, title: t('discover.iSpeak'), codes: nativeCodes },
        { key: 'learning' as const, title: t('discover.imLearning'), codes: learningCodes },
      ] as const,
    [t, nativeCodes, learningCodes],
  )

  function toggle(key: keyof LanguageScope, code: string): void {
    const picked = scope[key]
    const next = picked.includes(code) ? picked.filter((c) => c !== code) : [...picked, code]
    if (next.length === 0) return
    onChange({ ...scope, [key]: next })
  }

  if (!visible) return null

  return (
    <Modal transparent animationType="fade" visible onRequestClose={onClose}>
      {/* Tapping outside is the same as Done: the choice is already applied. */}
      <Pressable style={styles.backdrop} onPress={onClose} accessibilityRole="button">
        <Pressable style={styles.sheet} onPress={() => {}}>
          <Text style={styles.title}>{t('discover.languagesTitle')}</Text>
          <Text style={styles.body}>{t('discover.languagesBody')}</Text>
          <ScrollView style={styles.groups} bounces={false}>
            {groups.map((group) => (
              <View key={group.key} style={styles.group}>
                <Text style={styles.groupTitle}>{group.title}</Text>
                {group.codes.map((code) => {
                  const checked = scope[group.key].includes(code)
                  const last = checked && scope[group.key].length === 1
                  return (
                    <View key={code} style={styles.row}>
                      <Checkbox
                        checked={checked}
                        disabled={last}
                        onChange={() => toggle(group.key, code)}
                        accessibilityLabel={names.language(code)}
                      >
                        <Text style={[styles.rowText, last && styles.rowTextLast]}>
                          {names.language(code)}
                        </Text>
                      </Checkbox>
                    </View>
                  )
                })}
              </View>
            ))}
          </ScrollView>
          <Pressable
            accessibilityRole="button"
            onPress={onClose}
            style={({ pressed }) => [styles.done, pressed && styles.pressed]}
          >
            <Text style={styles.doneText}>{t('common.done')}</Text>
          </Pressable>
        </Pressable>
      </Pressable>
    </Modal>
  )
}

/**
 * "TR·EN → RU" — what the search is made with, for the header. Each side lists
 * up to two codes and counts the rest, since the row also holds the title,
 * the search and the filters button.
 */
export function scopeLabel(scope: LanguageScope): string | null {
  const side = (codes: readonly string[]): string => {
    const shown = codes.slice(0, 2).map((code) => code.toUpperCase())
    const more = codes.length - shown.length
    return more > 0 ? `${shown.join('·')}+${more}` : shown.join('·')
  }
  if (scope.native.length === 0 || scope.learning.length === 0) return null
  return `${side(scope.native)} → ${side(scope.learning)}`
}

const useStyles = makeStyles(({ colors, font, spacing, radius }) => ({
  backdrop: { backgroundColor: colors.scrim, flex: 1, justifyContent: 'flex-end' },
  sheet: {
    backgroundColor: colors.surface,
    borderTopLeftRadius: radius.lg,
    borderTopRightRadius: radius.lg,
    maxHeight: '80%',
    paddingBottom: spacing.xl,
    paddingHorizontal: spacing.lg,
    paddingTop: spacing.lg,
  },
  title: { ...font.heading, color: colors.text, fontSize: 20 },
  body: { ...font.body, color: colors.textMuted, fontSize: 14, marginTop: spacing.xs },
  groups: { marginTop: spacing.md },
  group: { marginBottom: spacing.md },
  groupTitle: { ...font.label, color: colors.textFaint, marginBottom: spacing.xs },
  row: { paddingVertical: spacing.xs },
  rowText: { ...font.body, color: colors.text },
  rowTextLast: { color: colors.textMuted },
  done: {
    alignItems: 'center',
    backgroundColor: colors.text,
    borderRadius: radius.pill,
    marginTop: spacing.sm,
    paddingVertical: spacing.md,
  },
  doneText: { ...font.label, color: colors.textInverse, fontSize: 15 },
  pressed: { opacity: 0.8 },
}))

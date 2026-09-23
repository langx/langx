import { MaterialCommunityIcons } from '@expo/vector-icons'
import type { Gender } from '@langx/shared'
import { useTheme } from '../lib/theme'
import { genderLabel, useT } from '../i18n'

const ICONS = {
  female: 'gender-female',
  male: 'gender-male',
  other: 'gender-non-binary',
} as const

/**
 * The symbol beside a profile's name for the gender it gave.
 *
 * Nothing for `undisclosed`: somebody who declined to answer must not be
 * drawn as a fourth category, which would announce the very thing they kept
 * to themselves — the rule `avatarOptionsFor` follows for the same field.
 *
 * Muted rather than pink and blue, because it is a fact about somebody, not a
 * colour scheme they were sorted into. Labelled for the reason `OfficialMark`
 * is: an unlabelled symbol reads to a screen reader as nothing at all.
 */
export function GenderMark({ gender, size = 18 }: { gender: Gender; size?: number }) {
  const { colors } = useTheme()
  const t = useT()
  if (gender === 'undisclosed') return null
  return (
    <MaterialCommunityIcons
      name={ICONS[gender]}
      size={size}
      color={colors.textMuted}
      accessibilityLabel={genderLabel(t, gender)}
    />
  )
}

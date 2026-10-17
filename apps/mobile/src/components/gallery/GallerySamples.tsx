import { Text, type StyleProp, type TextStyle } from 'react-native'
import { useT, type TranslateFn } from '../../i18n'
import { useTheme, type V3TypeStep } from '../../lib/theme'

/**
 * The gallery's real copy: lines a person actually reads, from the catalogue,
 * in the reader's language.
 *
 * Here and not in the gallery screen because the operator panel is English
 * by design and its lint rule refuses the i18n import — rightly, and never to
 * be switched off. A type ramp judged on "Lorem ipsum" says nothing about the
 * German that wraps or the Russian that runs long, so the samples come from
 * keys the app already ships rather than from new ones nobody would
 * translate for a developer's page.
 */
const SAMPLES: Record<V3TypeStep, (t: TranslateFn) => string> = {
  display: (t) => t('format.days', { count: 9 }),
  title: (t) => t('welcomeBack.title'),
  headline: (t) => t('streak.protectTitle'),
  body: (t) => t('streak.emptyBody'),
  callout: (t) => t('me.previewProfileBody'),
  caption: (t) => t('presence.lastSeenHours', { count: 2 }),
  label: (t) => t('tabs.chats'),
}

/** One line of the v3 ramp, set in its own step. */
export function TypeSample({ step, style }: { step: V3TypeStep; style?: StyleProp<TextStyle> }) {
  const t = useT()
  const { v3 } = useTheme()
  return <Text style={[v3.type[step], { color: v3.colors.fg }, style]}>{SAMPLES[step](t)}</Text>
}

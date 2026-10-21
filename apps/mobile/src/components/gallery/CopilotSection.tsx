import type { CopilotStatus } from '@langx/shared'
import { Text, View } from 'react-native'
import { makeStyles } from '../../lib/theme'
import { CopilotMenu } from '../copilot/CopilotButton'
import { CopilotCard, type CopilotAnswerState } from '../copilot/CopilotCard'
import type { GallerySectionEntry } from './GallerySection'
import { V3Plate } from './GallerySection'

/*
 * The gallery's own English, here rather than in `ADMIN.gallery`: the
 * operator panel's strings belong to the Copilot server PR, and the two PRs
 * keep to separate files. The answers are samples of what the model writes —
 * data, not catalogue copy — while the card's own words (the label, the
 * buttons, the errors) are the reader's language, as in the thread.
 */
const S = {
  title: 'Copilot',
  hint: 'The v3 thread’s Copilot: the menu beside send, and the card above the composer in every state. Blue, never the green of a person’s correction.',
  menu: 'Menu',
  loading: 'Loading',
  changed: 'Check, changed',
  unchanged: 'Check, unchanged',
  sayIt: 'Say it',
  explain: 'Explain (the sheet’s body)',
  errors: 'Errors',
  asked: 'Yesterday I have went to the cinema with my sister.',
  corrected: 'Yesterday I went to the cinema with my sister.',
  reason: 'With “yesterday”, use the simple past: “went”, not “have went”.',
  options: [
    { text: '¿Quedamos el sábado?', gloss: 'Casual, short' },
    { text: '¿Te parece bien vernos el sábado?', gloss: 'A little more polite' },
    { text: '¿Nos vemos el sábado?', gloss: 'The most common way' },
  ],
  explanation:
    '“No pasa nada” means “it’s fine” or “no problem”. People say it to reassure someone, not to say that nothing is happening.',
  language: 'Spanish',
}

const noop = (): void => undefined
const quota: CopilotStatus['quota'] = { limit: 20, remaining: 3, nextAvailableAt: null }
const spent: CopilotStatus['quota'] = {
  limit: 20,
  remaining: 0,
  nextAvailableAt: '2026-10-21T15:40:00.000Z',
}

const STATES: { label: string; state: CopilotAnswerState; quota?: CopilotStatus['quota'] }[] = [
  { label: S.loading, state: { kind: 'loading' } },
  {
    label: S.changed,
    state: {
      kind: 'answer',
      asked: S.asked,
      result: { action: 'check', corrected: S.corrected, changed: true, reason: S.reason },
    },
  },
  {
    label: S.unchanged,
    state: {
      kind: 'answer',
      asked: S.corrected,
      result: { action: 'check', corrected: S.corrected, changed: false, reason: null },
    },
  },
  {
    label: S.sayIt,
    state: { kind: 'answer', asked: '', result: { action: 'sayIt', options: S.options } },
    quota: spent,
  },
  {
    label: S.explain,
    state: { kind: 'answer', asked: '', result: { action: 'explain', explanation: S.explanation } },
  },
]

const ERRORS: CopilotAnswerState[] = [
  { kind: 'error', key: 'copilot.errQuota', retryAt: spent.nextAvailableAt ?? undefined },
  { kind: 'error', key: 'copilot.errPartnerAge' },
  { kind: 'error', key: 'copilot.errBusy' },
  { kind: 'error', key: 'copilot.errNoAnswer' },
  { kind: 'error', key: 'copilot.errNetwork' },
]

function CopilotBody() {
  const styles = useStyles()
  return (
    <V3Plate>
      <Text style={styles.note}>{S.menu}</Text>
      <CopilotMenu onCheck={noop} onSayIt={noop} targetLanguageName={S.language} />
      {STATES.map((item) => (
        <View key={item.label} style={styles.sample}>
          <Text style={styles.note}>{item.label}</Text>
          <CopilotCard state={item.state} quota={item.quota ?? quota} onUse={noop} onClose={noop} />
        </View>
      ))}
      <Text style={styles.note}>{S.errors}</Text>
      {ERRORS.map((state) => (
        <CopilotCard
          key={state.kind === 'error' ? state.key : state.kind}
          state={state}
          quota={undefined}
          onUse={noop}
          onClose={noop}
        />
      ))}
    </V3Plate>
  )
}

export const copilotSection: GallerySectionEntry = {
  key: 'copilot',
  title: S.title,
  hint: S.hint,
  Body: CopilotBody,
}

const useStyles = makeStyles(({ v3 }) => ({
  sample: { gap: v3.space[6] },
  note: { ...v3.type.caption, color: v3.colors.muted },
}))

import Feather from '@expo/vector-icons/Feather'
import type { CopilotAction } from '@langx/shared'
import { useMemo, type ReactNode } from 'react'
import { Text, View } from 'react-native'
import { useT } from '../../i18n'
import { diffCorrection } from '../../lib/correctionDiff'
import { PRODUCT_TEXT_SCALE } from '../../lib/productPage'
import { makeStyles, useTheme } from '../../lib/theme'
import { useGlyphScale } from '../product/ProductGroup'

/** Every word here grows as a product page's sentences do, and no further. */
const SCALE = PRODUCT_TEXT_SCALE.text

/**
 * A worked example of one Copilot help, drawn under its row on the Copilot
 * page: what the person has in front of them, then the blue answer.
 *
 * Drawn, never asked for: the sentences are fixed strings in the catalogue,
 * and the frame says so first, so nobody takes it for something the AI wrote.
 * The drawing follows the thread's — your draft in the message box, their
 * message on their side, a person's correction outlined in green, Copilot's
 * answer on the blue tint (`CopilotCard`) — so the page shows what the chat
 * will, and blue and green keep the meanings they have there.
 */
export function CopilotExample({ help }: { help: CopilotAction }) {
  const t = useT()
  const styles = useStyles()
  return (
    <View style={styles.frame}>
      <Text style={styles.label} maxFontSizeMultiplier={SCALE}>
        {t('copilot.page.example.label')}
      </Text>
      {help === 'check' ? (
        <CheckExample />
      ) : help === 'sayIt' ? (
        <SayItExample />
      ) : help === 'explain' ? (
        <ExplainExample />
      ) : (
        <ReplyIdeasExample />
      )}
    </View>
  )
}

function CheckExample() {
  const t = useT()
  const styles = useStyles()
  const draft = t('copilot.page.example.checkDraft')
  const fixed = t('copilot.page.example.checkFixed')
  const segments = useMemo(() => diffCorrection(draft, fixed).corrected, [draft, fixed])
  return (
    <>
      <Draft text={draft} />
      <Answer>
        <Text style={styles.answerText} maxFontSizeMultiplier={SCALE}>
          {segments.map((segment, index) => (
            <Text key={index} style={segment.changed ? styles.changed : null}>
              {segment.text}
            </Text>
          ))}
        </Text>
        <Text style={styles.reason} maxFontSizeMultiplier={SCALE}>
          {t('copilot.page.example.checkReason')}
        </Text>
      </Answer>
    </>
  )
}

function SayItExample() {
  const t = useT()
  return (
    <>
      <Draft text={t('copilot.page.example.sayItAsked')} />
      <Answer title={t('copilot.sayItTitle')}>
        <Option
          text={t('copilot.page.example.sayItOption1')}
          gloss={t('copilot.page.example.sayItGloss1')}
        />
        <Option
          text={t('copilot.page.example.sayItOption2')}
          gloss={t('copilot.page.example.sayItGloss2')}
        />
      </Answer>
    </>
  )
}

function ExplainExample() {
  const t = useT()
  const styles = useStyles()
  const original = t('copilot.page.example.explainOriginal')
  const corrected = t('copilot.page.example.explainCorrected')
  const diff = useMemo(() => diffCorrection(original, corrected), [original, corrected])
  return (
    <>
      <Caption text={t('copilot.page.example.partner')} />
      {/* A person's correction, outlined in its green as the thread draws it. */}
      <View style={styles.correction}>
        <Text style={styles.original} maxFontSizeMultiplier={SCALE}>
          {diff.original.map((segment, index) => (
            <Text key={index} style={segment.changed ? styles.removed : null}>
              {segment.text}
            </Text>
          ))}
        </Text>
        <Text style={styles.bubbleText} maxFontSizeMultiplier={SCALE}>
          {diff.corrected.map((segment, index) => (
            <Text key={index} style={segment.changed ? styles.added : null}>
              {segment.text}
            </Text>
          ))}
        </Text>
      </View>
      <Answer title={t('copilot.explainTitle')}>
        <Text style={styles.answerText} maxFontSizeMultiplier={SCALE}>
          {t('copilot.page.example.explainAnswer')}
        </Text>
      </Answer>
    </>
  )
}

function ReplyIdeasExample() {
  const t = useT()
  const styles = useStyles()
  return (
    <>
      <Caption text={t('copilot.page.example.partner')} />
      <View style={styles.theirs}>
        <Text style={styles.bubbleText} maxFontSizeMultiplier={SCALE}>
          {t('copilot.page.example.replyTheirs')}
        </Text>
      </View>
      <Answer title={t('copilot.replyIdeas')}>
        <Option text={t('copilot.page.example.replyIdea1')} />
        <Option text={t('copilot.page.example.replyIdea2')} />
      </Answer>
    </>
  )
}

/** Whose words follow: "Your draft", "Your partner". */
function Caption({ text }: { text: string }) {
  const styles = useStyles()
  return (
    <Text style={styles.caption} maxFontSizeMultiplier={SCALE}>
      {text}
    </Text>
  )
}

/** The message box with something typed in it, not sent. */
function Draft({ text }: { text: string }) {
  const styles = useStyles()
  const t = useT()
  return (
    <>
      <Caption text={t('copilot.page.example.draft')} />
      <View style={styles.draft}>
        <Text style={styles.bubbleText} maxFontSizeMultiplier={SCALE}>
          {text}
        </Text>
      </View>
    </>
  )
}

/**
 * Copilot's answer, on the blue tint with its "Copilot · Beta" chip, as
 * `CopilotCard` draws it. The chip is drawn here rather than through
 * `CopilotLabel`, which takes no cap on its text size: at the largest
 * settings it would outgrow the row's own title above it.
 */
function Answer({ title, children }: { title?: string; children: ReactNode }) {
  const t = useT()
  const styles = useStyles()
  const { colors, v3 } = useTheme()
  // The chip's glyph grows with its words, as the page's other glyphs do.
  const glyph = useGlyphScale()
  return (
    <View style={styles.answer}>
      <View style={styles.chip}>
        <Feather name="cpu" size={Math.round(v3.icon.xs * glyph)} color={colors.info} />
        <Text style={styles.chipText} maxFontSizeMultiplier={SCALE}>
          {t('copilot.label')}
        </Text>
      </View>
      {title ? (
        <Text style={styles.answerTitle} maxFontSizeMultiplier={SCALE}>
          {title}
        </Text>
      ) : null}
      {children}
    </View>
  )
}

/** One way to say it, or one reply idea: what a tap would put in the message box. */
function Option({ text, gloss }: { text: string; gloss?: string }) {
  const styles = useStyles()
  return (
    <View style={styles.option}>
      <Text style={styles.answerText} maxFontSizeMultiplier={SCALE}>
        {text}
      </Text>
      {gloss ? (
        <Text style={styles.reason} maxFontSizeMultiplier={SCALE}>
          {gloss}
        </Text>
      ) : null}
    </View>
  )
}

// Callout rather than the thread's 17pt body: the example sits under a row's
// 14pt line, and at full size its bubbles outweighed the row they illustrate.
const useStyles = makeStyles(({ colors, v3 }) => ({
  // The ground's white (or black) inside the grey row, so the example reads
  // as a small piece of a chat screen rather than more of the row.
  frame: {
    backgroundColor: v3.colors.bg,
    borderRadius: v3.radius.row,
    gap: v3.space[8],
    marginTop: v3.space[8],
    padding: v3.space[12],
  },
  label: { ...v3.type.label, color: v3.colors.muted },
  caption: { ...v3.type.label, color: v3.colors.muted, marginBottom: -v3.space[4] },
  bubbleText: { ...v3.type.callout, color: v3.colors.fg },
  draft: {
    borderColor: v3.colors.line,
    borderRadius: v3.radius.row,
    borderWidth: 1,
    paddingHorizontal: v3.space[12],
    paddingVertical: v3.space[8],
  },
  // Their side: the surface grey the thread gives a partner until their hue
  // is known, with the tail corner at the start.
  theirs: {
    alignSelf: 'flex-start',
    backgroundColor: v3.colors.surface,
    borderBottomStartRadius: v3.space[8],
    borderRadius: v3.radius.tile,
    maxWidth: '90%',
    paddingHorizontal: v3.space[12],
    paddingVertical: v3.space[8],
  },
  correction: {
    alignSelf: 'flex-start',
    borderColor: v3.colors.correction,
    borderRadius: v3.radius.row,
    borderWidth: 2,
    gap: v3.space[4],
    maxWidth: '90%',
    paddingHorizontal: v3.space[12],
    paddingVertical: v3.space[8],
  },
  original: { ...v3.type.caption, color: v3.colors.muted },
  removed: { textDecorationLine: 'line-through' },
  added: { color: v3.colors.correction, fontWeight: '800' },
  answer: {
    backgroundColor: colors.infoBg,
    borderRadius: v3.radius.row,
    gap: v3.space[8],
    padding: v3.space[12],
  },
  chip: { alignItems: 'center', flexDirection: 'row', gap: v3.space[4] },
  chipText: { ...v3.type.label, color: colors.info, flexShrink: 1 },
  answerTitle: { ...v3.type.label, color: v3.colors.muted },
  answerText: { ...v3.type.callout, color: v3.colors.fg },
  changed: { color: v3.colors.echoText, fontWeight: '700' },
  reason: { ...v3.type.caption, color: v3.colors.muted },
  option: {
    backgroundColor: v3.colors.bg,
    borderRadius: v3.radius.icon,
    gap: v3.space[2],
    paddingHorizontal: v3.space[12],
    paddingVertical: v3.space[8],
  },
}))

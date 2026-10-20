import Feather from '@expo/vector-icons/Feather'
import { Ionicons } from '@expo/vector-icons'
import { splitSentences } from '@langx/shared'
import { useState } from 'react'
import { Modal, Pressable, ScrollView, Text, View } from 'react-native'
import {
  ABOUT,
  FEATURES,
  GUIDELINES_URL,
  PARAMS,
  PLUS_ROWS,
  type Topic,
} from '../../components/howItWorks/topics'
import { SettingsScreenV3 } from '../../components/settings/v3/SettingsKitV3'
import { Button } from '../../components/ui/Button'
import { useReduceMotion } from '../../hooks/useReduceMotion'
import { useScreenInteractive } from '../../hooks/useScreenInteractive'
import { useLocale, useT } from '../../i18n'
import { messageActionsFor } from '../../lib/messageActions'
import { goBackTo } from '../../lib/navigation'
import { openExternal } from '../../lib/openExternal'
import { makeStyles, useTheme, type PartnerHue } from '../../lib/theme'
import { lookupWords } from '../../lib/wordLookup'

/** Each topic's square. Echo keeps its own tint, as it does everywhere. */
const HUES: Partial<Record<string, PartnerHue | 'echo'>> = {
  what: 'sky',
  help: 'mint',
  rules: 'tangerine',
  discover: 'aqua',
  hold: 'lilac',
  correct: 'lime',
  translate: 'sky',
  sendTranslation: 'lilac',
  voice: 'tangerine',
  echo: 'echo',
  feed: 'aqua',
  streak: 'tangerine',
}

/**
 * How LangX works in the redesign's look (`V-HowItWorks`), behind
 * `flags.v3Home`. The thirteen topics and every word in them are
 * `components/howItWorks/topics.ts`, the list today's page reads too; each
 * row now carries its topic's first sentence under the title, and each sheet
 * is v3's: a grabber, the big title, the app's own UI as the picture, and
 * "Got it" as the blue at the foot. No topic sells anything.
 */
export function HowItWorksScreenV3() {
  useScreenInteractive()
  const styles = useStyles()
  const t = useT()
  // Two pieces of state so the sheet keeps its words while it slides away.
  const [topic, setTopic] = useState<Topic | null>(null)
  const [open, setOpen] = useState(false)
  const show = (next: Topic): void => {
    setTopic(next)
    setOpen(true)
  }

  return (
    <SettingsScreenV3
      title={t('howItWorks.title')}
      back="/(app)/(tabs)/me"
      onBack={() => goBackTo('/(app)/(tabs)/me')}
    >
      <TopicList topics={ABOUT} onOpen={show} />
      <Text style={styles.heading} accessibilityRole="header">
        {t('howItWorks.featuresSection')}
      </Text>
      <TopicList topics={FEATURES} onOpen={show} />
      <TopicSheet topic={topic} visible={open} onClose={() => setOpen(false)} />
    </SettingsScreenV3>
  )
}

function TopicList({
  topics,
  onOpen,
}: {
  topics: readonly Topic[]
  onOpen: (topic: Topic) => void
}) {
  const styles = useStyles()
  const { v3 } = useTheme()
  const { isRtl } = useLocale()
  const t = useT()

  return (
    <View style={styles.group}>
      {topics.map((topic, index) => {
        const hue = HUES[topic.id]
        const square = hue === 'echo' ? v3.colors.echoTint : hue ? v3.hues[hue] : v3.colors.line
        const glyph = hue === 'echo' ? v3.colors.echoText : hue ? v3.colors.ink : v3.colors.fg
        // The first sentence of the topic's own text, so the row says what is behind it.
        const lead = topic.body[0] ? splitSentences(t(topic.body[0], PARAMS))[0] : undefined
        return (
          <Pressable
            key={topic.id}
            accessibilityRole="button"
            onPress={() => onOpen(topic)}
            style={({ pressed }) => [
              styles.row,
              index > 0 && styles.divided,
              pressed && styles.pressed,
            ]}
          >
            <View style={[styles.square, { backgroundColor: square }]}>
              <Feather name={topic.icon} size={v3.icon.lg} color={glyph} />
            </View>
            <View style={styles.rowText}>
              <Text style={styles.rowTitle}>{t(topic.title)}</Text>
              {lead ? (
                <Text style={styles.rowLead} numberOfLines={1}>
                  {lead}
                </Text>
              ) : null}
            </View>
            <Feather
              name={isRtl ? 'chevron-left' : 'chevron-right'}
              size={v3.icon.md}
              color={v3.colors.muted}
            />
          </Pressable>
        )
      })}
    </View>
  )
}

/** One topic, as v3's bottom sheet. Under reduce motion it fades in rather than slides. */
function TopicSheet({
  topic,
  visible,
  onClose,
}: {
  topic: Topic | null
  visible: boolean
  onClose: () => void
}) {
  const styles = useStyles()
  const { v3 } = useTheme()
  const t = useT()
  const reduce = useReduceMotion()
  const rules = topic?.id === 'rules'
  const guidelines = GUIDELINES_URL

  return (
    <Modal
      visible={visible}
      transparent
      animationType={reduce ? 'fade' : 'slide'}
      onRequestClose={onClose}
      accessibilityViewIsModal
    >
      <Pressable style={styles.backdrop} accessibilityLabel={t('common.cancel')} onPress={onClose}>
        {/* Swallows the press so tapping the sheet does not close it. */}
        <Pressable style={styles.sheet} onPress={() => undefined}>
          <View style={styles.grabber} />
          {topic ? (
            <ScrollView contentContainerStyle={styles.content}>
              <Text style={styles.title} accessibilityRole="header">
                {t(topic.title)}
              </Text>
              {topic.demo === 'menu' ? <MenuDemo /> : null}
              {topic.demo === 'plus' ? <PlusDemo /> : null}
              {topic.demo === 'correction' ? <CorrectionDemo /> : null}
              {topic.body.map((key) => (
                <Text key={key} style={[styles.body, rules && styles.lead]}>
                  {t(key, PARAMS)}
                </Text>
              ))}
              {topic.points?.keys.map((key) => (
                <View key={key} style={styles.point}>
                  <Feather
                    name={topic.points?.mark === 'x' ? 'x' : 'check'}
                    size={v3.icon.sm}
                    color={topic.points?.mark === 'x' ? v3.colors.danger : v3.colors.correction}
                    style={styles.mark}
                  />
                  <Text style={styles.body}>{t(key)}</Text>
                </View>
              ))}
              {topic.after?.map((key) => (
                <Text key={key} style={styles.body}>
                  {t(key)}
                </Text>
              ))}
            </ScrollView>
          ) : null}

          {/* Outside the scroller: the way out must never be the thing to scroll for. */}
          <View style={styles.footer}>
            <Button
              label={rules ? t('howItWorks.rulesAccept') : t('howItWorks.gotIt')}
              icon="check"
              variant="blue"
              onPress={onClose}
            />
            {rules && guidelines ? (
              <Button
                label={t('howItWorks.rulesRead')}
                icon="external-link"
                variant="secondary"
                onPress={() => void openExternal(guidelines)}
              />
            ) : null}
          </View>
        </Pressable>
      </Pressable>
    </Modal>
  )
}

/**
 * A partner's sentence and the menu a long press opens on it, from
 * `messageActionsFor` itself — the same question today's page asks it.
 */
function MenuDemo() {
  const styles = useStyles()
  const { v3 } = useTheme()
  const t = useT()
  const sentence = t('intro.correctionBefore')
  const actions = messageActionsFor({
    t,
    mine: false,
    type: 'text',
    hasBody: true,
    hasMedia: false,
    bodyLength: sentence.length,
    sentenceCount: splitSentences(sentence).length,
    wordCount: lookupWords(sentence).length,
    alreadyTranslated: false,
    canEdit: false,
    corrected: false,
    starred: false,
    pinned: false,
    echoed: false,
  }).filter((action) => action.page === 'primary' && !action.destructive)

  return (
    <View style={styles.demo} accessible={false} importantForAccessibility="no-hide-descendants">
      <View style={styles.bubble}>
        <Text style={styles.bubbleText}>{sentence}</Text>
      </View>
      <View style={styles.menu}>
        {actions.map((action, index) => (
          <View key={action.id} style={[styles.menuRow, index > 0 && styles.divided]}>
            <Ionicons name={action.icon as never} size={v3.icon.sm} color={v3.colors.muted} />
            <Text style={styles.menuLabel}>{action.label}</Text>
          </View>
        ))}
      </View>
    </View>
  )
}

/** The + menu's learning rows, drawn the way `MenuDemo` draws the long press. */
function PlusDemo() {
  const styles = useStyles()
  const { v3 } = useTheme()
  const t = useT()
  return (
    <View style={styles.demo} accessible={false} importantForAccessibility="no-hide-descendants">
      <View style={styles.menu}>
        {PLUS_ROWS.map((row, index) => (
          <View key={row.label} style={[styles.menuRow, index > 0 && styles.divided]}>
            <Feather name={row.icon} size={v3.icon.sm} color={v3.colors.muted} />
            <Text style={styles.menuLabel}>{t(row.label)}</Text>
          </View>
        ))}
      </View>
    </View>
  )
}

/** The intro's correction card: the same sentence, now fixed. */
function CorrectionDemo() {
  const styles = useStyles()
  const { v3 } = useTheme()
  const t = useT()
  return (
    <View style={styles.correction}>
      <Text style={styles.correctionKicker}>{t('intro.correctionFrom')}</Text>
      <Text style={styles.before}>{t('intro.correctionBefore')}</Text>
      <View style={styles.afterRow}>
        <Feather name="check" size={v3.icon.md} color={v3.colors.correction} />
        <Text style={styles.after}>{t('intro.correctionAfter')}</Text>
      </View>
    </View>
  )
}

const useStyles = makeStyles(({ v3 }) => ({
  heading: {
    ...v3.type.headline,
    color: v3.colors.fg,
    paddingStart: v3.space[6],
    paddingTop: v3.space[10],
  },
  group: { backgroundColor: v3.colors.surface, borderRadius: v3.radius.tile, overflow: 'hidden' },
  row: {
    alignItems: 'center',
    flexDirection: 'row',
    gap: v3.space[12],
    minHeight: 68,
    paddingHorizontal: v3.space[12],
    paddingVertical: v3.space[10],
  },
  divided: { borderTopColor: v3.colors.line, borderTopWidth: 1 },
  pressed: { opacity: 0.7 },
  square: {
    alignItems: 'center',
    borderRadius: v3.radius.icon,
    height: 40,
    justifyContent: 'center',
    width: 40,
  },
  rowText: { flex: 1, gap: 1, minWidth: 0 },
  rowTitle: { ...v3.type.button, color: v3.colors.fg },
  rowLead: { ...v3.type.caption, color: v3.colors.muted, lineHeight: 18 },

  backdrop: { backgroundColor: v3.colors.scrim, flex: 1, justifyContent: 'flex-end' },
  // A paragraph to read, so capped at 480 on the web, as today.
  sheet: {
    alignSelf: 'center',
    backgroundColor: v3.colors.bg,
    borderTopLeftRadius: v3.radius.hero,
    borderTopRightRadius: v3.radius.hero,
    maxHeight: '88%',
    maxWidth: 480,
    width: '100%',
  },
  grabber: {
    alignSelf: 'center',
    backgroundColor: v3.colors.track,
    borderRadius: v3.radius.pill,
    height: 5,
    marginTop: v3.space[10],
    width: 44,
  },
  content: {
    gap: v3.space[14],
    paddingBottom: 18,
    paddingHorizontal: v3.space[20],
    paddingTop: v3.space[16],
  },
  footer: {
    borderTopColor: v3.colors.line,
    borderTopWidth: 1,
    gap: v3.space[10],
    paddingBottom: 28,
    paddingHorizontal: v3.space[16],
    paddingTop: v3.space[12],
  },
  title: { ...v3.type.title, color: v3.colors.fg },
  body: { ...v3.type.body, color: v3.colors.fg, flex: 1 },
  // The rules open on a sentence that has to land before the list does.
  lead: { fontWeight: '600' },
  point: { alignItems: 'flex-start', flexDirection: 'row', gap: v3.space[8] },
  mark: { paddingTop: 3 },

  demo: {
    backgroundColor: v3.colors.surface,
    borderRadius: v3.radius.tile,
    gap: v3.space[8],
    padding: v3.space[16],
  },
  bubble: {
    alignSelf: 'flex-start',
    backgroundColor: v3.colors.bg,
    borderRadius: v3.radius.row,
    paddingHorizontal: v3.space[14],
    paddingVertical: v3.space[10],
  },
  bubbleText: { ...v3.type.callout, color: v3.colors.fg },
  menu: {
    alignSelf: 'flex-start',
    backgroundColor: v3.colors.bg,
    borderRadius: v3.radius.row,
    minWidth: 200,
    paddingHorizontal: v3.space[12],
  },
  menuRow: {
    alignItems: 'center',
    flexDirection: 'row',
    gap: v3.space[12],
    paddingVertical: v3.space[10],
  },
  menuLabel: { ...v3.type.callout, color: v3.colors.fg },

  correction: {
    backgroundColor: v3.colors.correctionTint,
    borderRadius: v3.radius.tile,
    gap: v3.space[6],
    paddingHorizontal: 18,
    paddingVertical: v3.space[16],
  },
  correctionKicker: { ...v3.type.label, color: v3.colors.correction, letterSpacing: 0.8 },
  before: { ...v3.type.body, color: v3.colors.muted, textDecorationLine: 'line-through' },
  afterRow: { alignItems: 'center', flexDirection: 'row', gap: v3.space[8] },
  after: { ...v3.type.headline, color: v3.colors.fg, flexShrink: 1 },
}))

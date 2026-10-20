import Feather from '@expo/vector-icons/Feather'
import { Ionicons } from '@expo/vector-icons'
import { splitSentences } from '@langx/shared'
import { useState } from 'react'
import { Modal, Pressable, ScrollView, Text, View } from 'react-native'
import { Button } from '../../src/components/ui/Button'
import { Screen } from '../../src/components/ui/Screen'
import { ScreenHeader } from '../../src/components/ui/ScreenHeader'
import { useScreenInteractive } from '../../src/hooks/useScreenInteractive'
import { useT } from '../../src/i18n'
import { messageActionsFor } from '../../src/lib/messageActions'
import { goBackTo } from '../../src/lib/navigation'
import { openExternal } from '../../src/lib/openExternal'
import { makeStyles, useTheme } from '../../src/lib/theme'
import { lookupWords } from '../../src/lib/wordLookup'
import {
  ABOUT,
  FEATURES,
  GUIDELINES_URL,
  PARAMS,
  PLUS_ROWS,
  type Topic,
} from '../../src/components/howItWorks/topics'
import { useV3Home } from '../../src/hooks/useV3Home'
import { HowItWorksScreenV3 } from '../../src/screens/me/HowItWorksScreenV3'

/** How LangX works, or with `flags.v3Home` on the redesign's (`HowItWorksScreenV3`). */
export default function HowItWorksScreenRoute() {
  return useV3Home() ? <HowItWorksScreenV3 /> : <HowItWorksScreen />
}

/**
 * How LangX works — the link at the foot of the Me tab.
 *
 * A list of short topics, each opening a sheet: what the exchange is, how to
 * be a good partner, what gets an account removed, and the gestures that are
 * easy to miss because they hide behind a long press. The tips and the tour
 * say each of these once, at the moment they apply, and are then dismissed;
 * this is where they can be found again.
 *
 * Every topic describes something the app does today, and none of them sells
 * a plan — an explanation that ends in an upsell stops being read. The one
 * paid feature says which plan has it and stops there.
 */
function HowItWorksScreen() {
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
    <Screen scroll>
      <ScreenHeader title={t('howItWorks.title')} onBack={() => goBackTo('/(app)/(tabs)/me')} />
      <TopicList topics={ABOUT} onOpen={show} />
      <Text style={styles.kicker}>{t('howItWorks.featuresSection')}</Text>
      <TopicList topics={FEATURES} onOpen={show} />
      <TopicSheet topic={topic} visible={open} onClose={() => setOpen(false)} />
    </Screen>
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
  const { colors } = useTheme()
  const t = useT()

  return (
    <View>
      {topics.map((topic, index) => (
        <Pressable
          key={topic.id}
          accessibilityRole="button"
          onPress={() => onOpen(topic)}
          style={({ pressed }) => [
            styles.row,
            index < topics.length - 1 && styles.divided,
            pressed && styles.pressed,
          ]}
        >
          <Feather
            name={topic.icon}
            size={20}
            // The rules are the one row somebody should notice before they need it.
            color={topic.id === 'rules' ? colors.warning : colors.textMuted}
          />
          <Text style={styles.rowTitle}>{t(topic.title)}</Text>
          <Feather name="chevron-right" size={18} color={colors.textFaint} />
        </Pressable>
      ))}
    </View>
  )
}

/**
 * One topic, as a sheet from the bottom — `EchoAboutSheet`'s shape, which is
 * already how this app explains a thing without leaving the screen.
 */
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
  const { colors } = useTheme()
  const t = useT()
  const rules = topic?.id === 'rules'
  // A local, so the check above narrows it inside the press handler too.
  const guidelines = GUIDELINES_URL

  return (
    <Modal
      visible={visible}
      transparent
      animationType="slide"
      onRequestClose={onClose}
      accessibilityViewIsModal
    >
      <Pressable style={styles.backdrop} accessibilityLabel={t('common.cancel')} onPress={onClose}>
        {/* Swallows the press so tapping the sheet does not close it. */}
        <Pressable style={styles.sheet} onPress={() => undefined}>
          {topic ? (
            <ScrollView contentContainerStyle={styles.content}>
              <Text style={styles.title}>{t(topic.title)}</Text>
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
                    size={16}
                    color={topic.points?.mark === 'x' ? colors.danger : colors.accent}
                    style={styles.mark}
                  />
                  <Text style={styles.pointText}>{t(key)}</Text>
                </View>
              ))}
              {topic.after?.map((key) => (
                <Text key={key} style={styles.body}>
                  {t(key)}
                </Text>
              ))}
            </ScrollView>
          ) : null}

          {/* Outside the scroller: the way out of a sheet must never be the
              one thing you have to scroll to find. */}
          <View style={styles.footer}>
            <Button
              label={rules ? t('howItWorks.rulesAccept') : t('howItWorks.gotIt')}
              onPress={onClose}
            />
            {rules && guidelines ? (
              <Button
                label={t('howItWorks.rulesRead')}
                variant="neutral"
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
 * A partner's sentence and the menu a long press opens on it.
 *
 * The rows come from `messageActionsFor` itself, for exactly that message, so
 * the picture cannot drift from the menu it describes. Delete is left out: it
 * is on every message and teaches nothing. Read aloud is left out by asking
 * without a voice, because not every deployment has one.
 */
function MenuDemo() {
  const styles = useStyles()
  const { colors } = useTheme()
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
          <View
            key={action.id}
            style={[styles.menuRow, index < actions.length - 1 && styles.divided]}
          >
            <Ionicons name={action.icon as never} size={18} color={colors.textMuted} />
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
  const { colors } = useTheme()
  const t = useT()
  return (
    <View style={styles.demo} accessible={false} importantForAccessibility="no-hide-descendants">
      <View style={styles.menu}>
        {PLUS_ROWS.map((row, index) => (
          <View
            key={row.label}
            style={[styles.menuRow, index < PLUS_ROWS.length - 1 && styles.divided]}
          >
            <Feather name={row.icon} size={18} color={colors.textMuted} />
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
  const t = useT()
  return (
    <View style={styles.correction}>
      <Text style={styles.correctionKicker}>{t('intro.correctionFrom')}</Text>
      <Text style={styles.before}>{t('intro.correctionBefore')}</Text>
      <Text style={styles.after}>{t('intro.correctionAfter')}</Text>
    </View>
  )
}

const useStyles = makeStyles(({ colors, font, radius, spacing }) => ({
  row: { alignItems: 'center', flexDirection: 'row', gap: spacing.lg, paddingVertical: 17 },
  divided: { borderBottomColor: colors.border, borderBottomWidth: 1 },
  pressed: { opacity: 0.6 },
  rowTitle: { color: colors.text, flex: 1, fontSize: 17, fontWeight: '600' },
  kicker: {
    color: colors.textFaint,
    fontSize: 12,
    fontWeight: '700',
    letterSpacing: 0.5,
    paddingTop: spacing.xl,
    textTransform: 'uppercase',
  },

  backdrop: { backgroundColor: colors.scrim, flex: 1, justifyContent: 'flex-end' },
  // `EchoAboutSheet`'s column: a paragraph to read, so capped at 480 on the web.
  sheet: {
    alignSelf: 'center',
    backgroundColor: colors.bg,
    borderTopLeftRadius: radius.xl,
    borderTopRightRadius: radius.xl,
    maxHeight: '88%',
    maxWidth: 480,
    width: '100%',
  },
  content: {
    gap: spacing.md,
    paddingBottom: spacing.lg,
    paddingHorizontal: spacing.lg,
    paddingTop: spacing.xl,
  },
  footer: {
    borderTopColor: colors.border,
    borderTopWidth: 1,
    gap: spacing.sm,
    paddingBottom: spacing.xxl,
    paddingHorizontal: spacing.lg,
    paddingTop: spacing.md,
  },
  title: { ...font.heading, color: colors.text, fontSize: 20 },
  body: { ...font.body, color: colors.textMuted, lineHeight: 22 },
  // The rules open on a sentence that has to land before the list does.
  lead: { color: colors.text, fontWeight: '600' },
  point: { alignItems: 'flex-start', flexDirection: 'row', gap: spacing.sm },
  // The mark sits on the first line of text, not in the middle of the block.
  mark: { paddingTop: 3 },
  pointText: { ...font.body, color: colors.text, flex: 1, lineHeight: 22 },

  demo: {
    backgroundColor: colors.fill,
    borderRadius: radius.lg,
    gap: spacing.sm,
    padding: spacing.lg,
  },
  bubble: {
    alignSelf: 'flex-start',
    backgroundColor: colors.bg,
    borderRadius: radius.lg,
    paddingHorizontal: 14,
    paddingVertical: 10,
  },
  bubbleText: { color: colors.text, fontSize: 16 },
  menu: {
    alignSelf: 'flex-start',
    backgroundColor: colors.bg,
    borderRadius: radius.md,
    minWidth: 200,
    paddingHorizontal: spacing.md,
  },
  menuRow: { alignItems: 'center', flexDirection: 'row', gap: spacing.md, paddingVertical: 10 },
  menuLabel: { color: colors.text, fontSize: 15 },

  correction: {
    backgroundColor: colors.successBg,
    borderRadius: radius.lg,
    gap: 6,
    paddingHorizontal: 20,
    paddingVertical: 18,
  },
  correctionKicker: {
    color: colors.success,
    fontSize: 12,
    fontWeight: '700',
    letterSpacing: 0.5,
    textTransform: 'uppercase',
  },
  before: { color: colors.textMuted, fontSize: 16, textDecorationLine: 'line-through' },
  after: { ...font.heading, color: colors.text, fontSize: 18 },
}))

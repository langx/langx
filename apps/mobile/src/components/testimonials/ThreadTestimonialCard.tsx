import Feather from '@expo/vector-icons/Feather'
import { useEffect, useState } from 'react'
import { Pressable, Text, View } from 'react-native'
import { useT } from '../../i18n'
import { FLAG_KEYS, readJsonFlag, writeJsonFlag } from '../../lib/localFlags'
import { makeStyles, useTheme } from '../../lib/theme'
import { Button } from '../ui/Button'

/** Enough threads that nobody reaches the end; the oldest closes fall off first. */
const MAX_REMEMBERED = 200

async function readDismissed(): Promise<string[]> {
  try {
    const list = await readJsonFlag<unknown>(FLAG_KEYS.testimonialCardsDismissed)
    return Array.isArray(list) ? list.filter((id): id is string => typeof id === 'string') : []
  } catch {
    return []
  }
}

async function rememberDismissed(conversationId: string): Promise<void> {
  try {
    const list = (await readDismissed()).filter((id) => id !== conversationId)
    list.push(conversationId)
    await writeJsonFlag(FLAG_KEYS.testimonialCardsDismissed, list.slice(-MAX_REMEMBERED))
  } catch {
    // A close that is not remembered shows the card once more; nothing worse.
  }
}

/**
 * The invitation at the foot of a thread, once this pair may review each
 * other. Not a message — nobody sent it — so it is drawn as a card, not a
 * bubble, and it names no number: the moment it appears is the whole of what
 * the app says about when reviews open.
 *
 * `done` is the line it becomes after a review is published from this
 * screen, so the person sees where their words went instead of the card
 * simply vanishing.
 */
export function ThreadTestimonialCard({
  conversationId,
  name,
  done,
  onWrite,
  onEdit,
}: {
  conversationId: string
  name: string
  done: boolean
  onWrite: () => void
  onEdit: () => void
}) {
  const styles = useStyles()
  const { colors } = useTheme()
  const t = useT()
  // `null` while the device is still being asked, so a closed card does not
  // flash up for a frame first.
  const [dismissed, setDismissed] = useState<boolean | null>(null)

  useEffect(() => {
    let live = true
    void readDismissed().then((list) => {
      if (live) setDismissed(list.includes(conversationId))
    })
    return () => {
      live = false
    }
  }, [conversationId])

  if (done) {
    return (
      <View style={styles.done}>
        <Feather name="check-circle" size={14} color={colors.success} />
        <Text style={styles.doneText}>{t('testimonials.cardDone')}</Text>
        <Text style={styles.doneText}>·</Text>
        <Pressable accessibilityRole="button" hitSlop={8} onPress={onEdit}>
          <Text style={styles.link}>{t('common.edit')}</Text>
        </Pressable>
      </View>
    )
  }
  if (dismissed !== false) return null

  return (
    <View style={styles.card}>
      <View style={styles.icon}>
        <Feather name="message-square" size={18} color={colors.accent} />
      </View>
      <View style={styles.body}>
        <Text style={styles.title}>{t('testimonials.cardTitle', { name })}</Text>
        <Text style={styles.text}>{t('testimonials.cardBody')}</Text>
        <Button
          label={t('testimonials.write')}
          size="small"
          onPress={onWrite}
          style={styles.button}
        />
      </View>
      <Pressable
        accessibilityRole="button"
        accessibilityLabel={t('testimonials.cardDismiss')}
        hitSlop={10}
        onPress={() => {
          setDismissed(true)
          void rememberDismissed(conversationId)
        }}
        style={({ pressed }) => [styles.close, pressed && styles.pressed]}
      >
        <Feather name="x" size={18} color={colors.textFaint} />
      </Pressable>
    </View>
  )
}

const useStyles = makeStyles(({ colors, font, radius, spacing }) => ({
  card: {
    alignItems: 'flex-start',
    backgroundColor: colors.surface,
    borderColor: colors.border,
    borderRadius: radius.lg,
    borderWidth: 1,
    flexDirection: 'row',
    gap: spacing.md,
    marginVertical: spacing.md,
    padding: spacing.lg,
  },
  icon: {
    alignItems: 'center',
    backgroundColor: colors.accentBg,
    borderRadius: radius.pill,
    height: 36,
    justifyContent: 'center',
    width: 36,
  },
  body: { flex: 1, gap: spacing.xs },
  title: { ...font.heading, color: colors.text, fontSize: 15 },
  text: { color: colors.textMuted, fontSize: 14, lineHeight: 20 },
  button: { alignSelf: 'flex-start', marginTop: spacing.sm, width: 'auto' },
  close: { alignItems: 'center', height: 28, justifyContent: 'center', width: 28 },
  pressed: { opacity: 0.5 },
  done: {
    alignItems: 'center',
    alignSelf: 'center',
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: spacing.xs,
    justifyContent: 'center',
    marginVertical: spacing.md,
  },
  doneText: { color: colors.textMuted, fontSize: 13 },
  link: { color: colors.accent, fontSize: 13, fontWeight: '600' },
}))

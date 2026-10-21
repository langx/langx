import Feather from '@expo/vector-icons/Feather'
import { useEffect, useState } from 'react'
import { Pressable, Text, View } from 'react-native'
import { useT } from '../../i18n'
import { FLAG_KEYS, readJsonFlag, writeJsonFlag } from '../../lib/localFlags'
import { makeStyles, useTheme } from '../../lib/theme'
import { Button } from '../ui/Button'
import { IconButton } from '../ui/IconButton'
import { useV3Home } from '../../hooks/useV3Home'

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
  const redesigned = useStylesV3()
  const { colors, v3 } = useTheme()
  const t = useT()
  const v3Look = useV3Home()
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

  function dismiss(): void {
    setDismissed(true)
    void rememberDismissed(conversationId)
  }

  /*
   * v3 draws it as the kit's coach card — the grey block, a glyph in a
   * partner hue, the headline, one ink pill and the ✕ — because that is what
   * it is: a suggestion with one way to act on it and one way away. Not
   * `CoachCard` itself, whose ✕ says "Dismiss this tip"; this one is no tip.
   * The done line is the correction's green, the colour v3 gives what landed.
   */
  if (v3Look) {
    if (done) {
      return (
        <View style={redesigned.done}>
          <Feather name="check-circle" size={v3.icon.xs} color={v3.colors.correction} />
          <Text style={redesigned.doneText}>{t('testimonials.cardDone')}</Text>
          <Text style={redesigned.doneText}>·</Text>
          <Pressable
            accessibilityRole="button"
            hitSlop={{ left: 12, right: 12 }}
            onPress={onEdit}
            style={redesigned.linkTarget}
          >
            <Text style={redesigned.link}>{t('common.edit')}</Text>
          </Pressable>
        </View>
      )
    }
    if (dismissed !== false) return null
    return (
      <View style={redesigned.card}>
        <View style={redesigned.row}>
          <View style={redesigned.disc}>
            <Feather name="message-square" size={v3.icon.lg} color={v3.colors.ink} />
          </View>
          <View style={redesigned.words}>
            <Text accessibilityRole="header" style={redesigned.title}>
              {t('testimonials.cardTitle', { name })}
            </Text>
            <Text style={redesigned.body}>{t('testimonials.cardBody')}</Text>
          </View>
          <IconButton
            icon="x"
            iconSize={v3.icon.lg}
            accessibilityLabel={t('testimonials.cardDismiss')}
            hitSlop={10}
            onPress={dismiss}
          />
        </View>
        <Button
          variant="ink"
          size="small"
          icon="edit-3"
          label={t('testimonials.write')}
          onPress={onWrite}
          style={redesigned.action}
        />
      </View>
    )
  }

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
        onPress={dismiss}
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

/** `CoachCard`'s measures, so the two suggestions in a thread read as one kind. */
const useStylesV3 = makeStyles(({ v3 }) => ({
  card: {
    backgroundColor: v3.colors.surface,
    borderRadius: v3.radius.badge,
    gap: v3.space[10],
    marginVertical: v3.space[12],
    paddingBottom: v3.space[14],
    paddingEnd: v3.space[8],
    paddingStart: v3.space[16],
    paddingTop: v3.space[12],
  },
  row: { alignItems: 'flex-start', flexDirection: 'row', gap: v3.space[12] },
  disc: {
    alignItems: 'center',
    backgroundColor: v3.hues.lilac,
    borderRadius: v3.radius.pill,
    height: 44,
    justifyContent: 'center',
    marginTop: v3.space[2],
    width: 44,
  },
  words: { flex: 1, gap: v3.space[2], paddingTop: v3.space[2] },
  title: { ...v3.type.headline, color: v3.colors.fg },
  body: { ...v3.type.callout, color: v3.colors.fg },
  action: { alignSelf: 'stretch', marginEnd: v3.space[8], width: 'auto' },
  done: {
    alignItems: 'center',
    alignSelf: 'center',
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: v3.space[6],
    justifyContent: 'center',
    marginVertical: v3.space[12],
    minHeight: 44,
  },
  doneText: { ...v3.type.caption, color: v3.colors.muted },
  // A 44pt row of its own: a caption-sized word with a 12pt slop is 40.
  linkTarget: { justifyContent: 'center', minHeight: 44 },
  link: { ...v3.type.label, color: v3.colors.echoText },
}))

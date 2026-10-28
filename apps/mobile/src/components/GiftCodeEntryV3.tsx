import { Pressable, Text, View } from 'react-native'
import { useSafeAreaInsets } from 'react-native-safe-area-context'
import { useT } from '../i18n'
import { PRODUCT_TEXT_SCALE } from '../lib/productPage'
import { makeStyles, useTheme } from '../lib/theme'
import { FieldV3 } from './onboarding/WizardV3'
import { Button } from './ui/Button'
import { IconButton } from './ui/IconButton'

/**
 * v3's "Have a gift code?" link: set like the paywall's own small print —
 * Restore, Terms, Privacy — muted and quiet, because a code is the way in for
 * the few who hold one and must not compete with the plan's one yellow.
 */
export function GiftCodeLinkV3({ onPress }: { onPress: () => void }) {
  const t = useT()
  const styles = useStyles()
  return (
    <Pressable
      accessibilityRole="button"
      onPress={onPress}
      style={({ pressed }) => [styles.link, pressed && styles.pressed]}
    >
      {/* Small print, grown as far as a product page's sentences. */}
      <Text style={styles.linkText} maxFontSizeMultiplier={PRODUCT_TEXT_SCALE.text}>
        {t('giftCode.link')}
      </Text>
    </Pressable>
  )
}

/**
 * v3's drawing of the gift-code sheet, behind `flags.v3Home`: the kit's sheet
 * with a handle and a ✕, the redesign's text field, and Redeem as the sheet's
 * one yellow. The ✕ is Close — the current look's second button — so the
 * field and its answer keep the room.
 *
 * Drawing only. What a code does, what each refusal reads as and when `me`
 * is refetched stay in `GiftCodeEntry`, in both looks.
 */
export function GiftCodeSheetV3({
  code,
  error,
  pending,
  redeeming,
  onChangeCode,
  onSubmit,
  onClose,
}: {
  code: string
  error: string | undefined
  pending: boolean
  redeeming: boolean
  onChangeCode: (next: string) => void
  onSubmit: () => void
  onClose: () => void
}) {
  const t = useT()
  const styles = useStyles()
  const { v3 } = useTheme()
  const insets = useSafeAreaInsets()

  return (
    <Pressable style={styles.backdrop} accessibilityLabel={t('giftCode.close')} onPress={onClose}>
      {/* Swallows the press so tapping the sheet does not close it. */}
      <Pressable
        style={[styles.sheet, { paddingBottom: insets.bottom + v3.space[16] }]}
        onPress={() => undefined}
      >
        <View style={styles.handle} />
        <View style={styles.header}>
          <Text accessibilityRole="header" style={styles.title}>
            {t('giftCode.title')}
          </Text>
          <IconButton icon="x" accessibilityLabel={t('giftCode.close')} onPress={onClose} />
        </View>
        {pending ? (
          <>
            <Text style={styles.pending} accessibilityLiveRegion="polite">
              {t('giftCode.pending')}
            </Text>
            <Button variant="secondary" label={t('giftCode.close')} onPress={onClose} />
          </>
        ) : (
          <>
            <Text style={styles.body}>{t('giftCode.body')}</Text>
            <FieldV3
              label={t('giftCode.label')}
              value={code}
              onChangeText={onChangeCode}
              error={error}
              autoCapitalize="characters"
              autoComplete="off"
              spellCheck={false}
              maxLength={64}
              returnKeyType="done"
              onSubmitEditing={onSubmit}
              autoFocus
            />
            <Button
              label={t('giftCode.redeem')}
              icon="gift"
              disabled={code.trim().length === 0}
              loading={redeeming}
              onPress={onSubmit}
            />
          </>
        )}
      </Pressable>
    </Pressable>
  )
}

const useStyles = makeStyles(({ v3 }) => ({
  // The paywall's footer links: muted, small, a full target around them.
  link: {
    alignSelf: 'center',
    justifyContent: 'center',
    minHeight: 44,
    paddingHorizontal: v3.space[10],
  },
  linkText: { ...v3.type.label, color: v3.colors.muted, textAlign: 'center' },
  pressed: { opacity: 0.6 },
  backdrop: { ...v3.elevation.overlay, flex: 1, justifyContent: 'flex-end' },
  // A phone-width column even on a wide window, like the kit's other sheets.
  sheet: {
    alignSelf: 'center',
    backgroundColor: v3.colors.bg,
    borderTopEndRadius: v3.radius.block,
    borderTopStartRadius: v3.radius.block,
    gap: v3.space[12],
    maxWidth: 560,
    paddingHorizontal: v3.space[16],
    paddingTop: v3.space[8],
    width: '100%',
  },
  handle: {
    alignSelf: 'center',
    backgroundColor: v3.colors.line,
    borderRadius: v3.radius.pill,
    height: 5,
    width: 40,
  },
  header: { alignItems: 'center', flexDirection: 'row', gap: v3.space[8] },
  title: { ...v3.type.headline, color: v3.colors.fg, flex: 1 },
  body: { ...v3.type.callout, color: v3.colors.muted },
  pending: { ...v3.type.body, color: v3.colors.fg, fontWeight: '600' },
}))

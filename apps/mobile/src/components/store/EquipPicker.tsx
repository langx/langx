import { COSMETICS, wornCosmetic, type CosmeticKind, type Equipped } from '@langx/shared'
import { Pressable, Text, View } from 'react-native'
import { Avatar } from '../ui/Avatar'
import { cosmeticLabel, useT } from '../../i18n'
import { makeStyles, useTheme } from '../../lib/theme'

/**
 * Choose which owned cosmetic to wear.
 *
 * The reason the catalogue is worth expanding at all: without a choice, a
 * second frame is a purchase that changes nothing, and every item past the
 * first is a number going down for no visible reason.
 *
 * Only what is owned appears here. The shop is next to it on the same screen,
 * so an empty row is a pointer rather than a dead end — and listing things
 * somebody cannot pick would make the picker a second, worse shop.
 */
export function EquipPicker({
  kind,
  owned,
  equipped,
  viewer,
  onEquip,
}: {
  kind: CosmeticKind
  owned: readonly string[]
  equipped: Equipped | undefined
  viewer: { _id: string; name: string; avatarUrl?: string | undefined }
  onEquip: (id: string | null) => void
}) {
  const styles = useStyles()
  const { colors } = useTheme()
  const t = useT()

  const mine = COSMETICS.filter((c) => c.kind === kind && owned.includes(c.id))
  if (mine.length === 0) return null

  // What is *drawn*, which is the explicit choice or the fallback — so the
  // selected pill matches the avatar above it even before anybody has chosen.
  const worn = wornCosmetic(equipped, owned, kind)

  return (
    <View style={styles.wrap}>
      <Text style={styles.kicker}>
        {kind === 'frame' ? t('store.yourFrames') : t('store.yourTitles')}
      </Text>
      <View style={styles.row}>
        {/* "None" is a real choice, not the absence of one: somebody who owns
            four frames may want to wear no frame today. */}
        <Pressable
          accessibilityRole="radio"
          accessibilityState={{ selected: !worn }}
          onPress={() => onEquip(null)}
          style={[styles.pill, !worn && styles.pillOn]}
        >
          <Text style={[styles.pillLabel, !worn && styles.pillLabelOn]}>{t('store.wearNone')}</Text>
        </Pressable>
        {mine.map((item) => {
          const on = worn?.id === item.id
          return (
            <Pressable
              key={item.id}
              accessibilityRole="radio"
              accessibilityState={{ selected: on }}
              onPress={() => onEquip(item.id)}
              style={[styles.pill, on && styles.pillOn]}
            >
              {item.tone ? (
                <Avatar
                  url={viewer.avatarUrl}
                  name={viewer.name}
                  seed={viewer._id}
                  size={20}
                  frame={item.tone}
                />
              ) : null}
              <Text style={[styles.pillLabel, on && styles.pillLabelOn]}>
                {cosmeticLabel(t, item.id)}
              </Text>
              {on ? <View style={[styles.dot, { backgroundColor: colors.primary }]} /> : null}
            </Pressable>
          )
        })}
      </View>
    </View>
  )
}

const useStyles = makeStyles(({ colors, font, radius, spacing }) => ({
  wrap: { gap: spacing.sm, paddingTop: spacing.lg },
  kicker: { color: colors.textFaint, fontSize: 13, fontWeight: '600' },
  row: { flexDirection: 'row', flexWrap: 'wrap', gap: spacing.sm },
  pill: {
    alignItems: 'center',
    borderColor: colors.border,
    borderRadius: radius.pill,
    borderWidth: 1,
    flexDirection: 'row',
    gap: spacing.xs + 2,
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.xs + 2,
  },
  pillOn: { backgroundColor: colors.fill, borderColor: colors.text },
  pillLabel: { ...font.label, color: colors.textMuted },
  pillLabelOn: { color: colors.text },
  dot: { borderRadius: 3, height: 6, width: 6 },
}))

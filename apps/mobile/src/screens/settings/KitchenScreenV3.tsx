import Feather from '@expo/vector-icons/Feather'
import { Pressable, Text, View } from 'react-native'
import { useContributors } from '../../api/queries'
import {
  SettingsGroupV3,
  SettingsHeadingV3,
  SettingsItemV3,
  SettingsScreenV3,
  type Glyph,
} from '../../components/settings/v3/SettingsKitV3'
import { Avatar } from '../../components/ui/Avatar'
import { useScreenInteractive } from '../../hooks/useScreenInteractive'
import { useT } from '../../i18n'
import { KITCHEN_SECTIONS } from '../../lib/externalLinks'
import { openExternal } from '../../lib/openExternal'
import { makeStyles, useTheme, type PartnerHue } from '../../lib/theme'

/** Each section's square, as the board tints them; Licenses keeps the neutral grey. */
const HUES: Partial<Record<string, PartnerHue>> = {
  'kitchen.contributors': 'lilac',
  'kitchen.support': 'tangerine',
  'kitchen.token': 'lime',
  'kitchen.about': 'sky',
}

/** The one section drawn as a grid of tiles: eleven short names, two to a row. */
const TILED = 'kitchen.social'

/** Two at a time, for the tiles' rows; the last pair may hold one. */
function pairs<T>(items: readonly T[]): (readonly [T] | readonly [T, T])[] {
  const out: (readonly [T] | readonly [T, T])[] = []
  for (let at = 0; at < items.length; at += 2) {
    const first = items[at] as T
    out.push(at + 1 < items.length ? [first, items[at + 1] as T] : [first])
  }
  return out
}

/**
 * Our Kitchen in the redesign's look (`V-Kitchen`), behind `flags.v3Home`.
 * The same six sections, the same thirty links in the same order and the same
 * licence paragraph as `kitchen.tsx` — read its comments for why each is
 * there. The board's changes: the faces sit on a grey block of their own, each
 * section is a block of rows with its own tint, and Social becomes tiles.
 */
export function KitchenScreenV3() {
  useScreenInteractive()
  const styles = useStyles()
  const { v3 } = useTheme()
  const t = useT()
  const contributors = useContributors().data
  const contributorsUrl = KITCHEN_SECTIONS.flatMap((section) => section.rows).find(
    (row) => row.labelKey === 'kitchen.fundamentals',
  )?.url

  return (
    <SettingsScreenV3 title={t('kitchen.title')} back="/(app)/settings">
      <Text style={styles.intro}>{t('kitchen.intro')}</Text>

      {/* Drawn only when the API has a list, as today: an empty strip would say nobody built this. */}
      {contributors && contributors.total > 0 ? (
        <Pressable
          accessibilityRole="link"
          accessibilityLabel={t('kitchen.fundamentals')}
          onPress={() => contributorsUrl && void openExternal(contributorsUrl)}
          style={({ pressed }) => [styles.people, pressed && styles.pressed]}
        >
          <View style={styles.faces}>
            {contributors.top.map((person) => (
              <Avatar key={person.login} url={person.avatarUrl} name={person.login} size={40} />
            ))}
            {contributors.total > contributors.top.length ? (
              <View style={styles.more}>
                <Text style={styles.moreText}>
                  {t('kitchen.moreContributors', {
                    count: contributors.total - contributors.top.length,
                  })}
                </Text>
              </View>
            ) : null}
          </View>
          <View style={styles.captionLine}>
            <Text style={styles.caption}>{t('kitchen.fundamentals')}</Text>
            <Feather name="external-link" size={v3.icon.md} color={v3.colors.muted} />
          </View>
        </Pressable>
      ) : null}

      {KITCHEN_SECTIONS.map((section) => (
        <View key={section.titleKey} style={styles.section}>
          <SettingsHeadingV3 title={t(section.titleKey)} />
          {section.titleKey === TILED ? (
            <View style={styles.tiles}>
              {pairs(section.rows).map((pair) => (
                <View key={pair[0].url} style={styles.tileRow}>
                  {pair.map((row) => (
                    <Pressable
                      key={`${section.titleKey}-${row.label ?? row.labelKey}`}
                      accessibilityRole="link"
                      onPress={() => void openExternal(row.url)}
                      style={({ pressed }) => [styles.tile, pressed && styles.pressed]}
                    >
                      <View style={styles.tileSquare}>
                        <Feather name={row.icon as Glyph} size={v3.icon.md} color={v3.colors.ink} />
                      </View>
                      <Text style={styles.tileTitle} numberOfLines={1}>
                        {row.label ?? t(row.labelKey as never)}
                      </Text>
                    </Pressable>
                  ))}
                  {/* The odd one out keeps a half width rather than stretching across. */}
                  {pair.length === 1 ? <View style={styles.tileSpacer} /> : null}
                </View>
              ))}
            </View>
          ) : (
            <SettingsGroupV3>
              {section.rows.map((row) => (
                <SettingsItemV3
                  key={`${section.titleKey}-${row.label ?? row.labelKey}`}
                  icon={row.icon as Glyph}
                  hue={HUES[section.titleKey]}
                  title={row.label ?? t(row.labelKey as never)}
                  external
                  onPress={() => void openExternal(row.url)}
                />
              ))}
            </SettingsGroupV3>
          )}
        </View>
      ))}

      {/* A licence condition, not a courtesy — see `kitchen.tsx`. */}
      <Text style={styles.footer}>
        {t('kitchen.footer')} {t('kitchen.dataCredit')} {t('kitchen.stickerCredit')}
      </Text>
    </SettingsScreenV3>
  )
}

const useStyles = makeStyles(({ v3 }) => ({
  intro: { ...v3.type.callout, color: v3.colors.muted, paddingStart: v3.space[4] },
  people: {
    backgroundColor: v3.colors.surface,
    borderRadius: v3.radius.tile,
    gap: v3.space[12],
    paddingBottom: v3.space[12],
    paddingHorizontal: v3.space[12],
    paddingTop: v3.space[14],
  },
  pressed: { opacity: 0.7 },
  faces: { alignItems: 'center', flexDirection: 'row', flexWrap: 'wrap', gap: v3.space[6] },
  // The rest of them, sized like a face.
  more: {
    alignItems: 'center',
    backgroundColor: v3.colors.line,
    borderRadius: v3.radius.pill,
    height: 40,
    justifyContent: 'center',
    width: 40,
  },
  moreText: { ...v3.type.label, color: v3.colors.muted },
  captionLine: { alignItems: 'center', flexDirection: 'row', gap: v3.space[8] },
  caption: { ...v3.type.button, color: v3.colors.fg, flex: 1 },
  section: { gap: v3.space[10] },
  tiles: { gap: v3.space[8] },
  tileRow: { flexDirection: 'row', gap: v3.space[8] },
  tileSpacer: { flex: 1 },
  tile: {
    alignItems: 'center',
    backgroundColor: v3.colors.surface,
    borderRadius: v3.radius.row,
    flex: 1,
    flexDirection: 'row',
    gap: v3.space[10],
    minHeight: 56,
    paddingEnd: v3.space[12],
    paddingStart: v3.space[10],
    paddingVertical: v3.space[8],
  },
  tileSquare: {
    alignItems: 'center',
    backgroundColor: v3.hues.aqua,
    borderRadius: v3.radius.icon,
    height: 36,
    justifyContent: 'center',
    width: 36,
  },
  tileTitle: { ...v3.type.buttonSmall, color: v3.colors.fg, flex: 1, minWidth: 0 },
  footer: { ...v3.type.caption, color: v3.colors.muted, paddingHorizontal: v3.space[6] },
}))

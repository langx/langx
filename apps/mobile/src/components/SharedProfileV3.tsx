import Feather from '@expo/vector-icons/Feather'
import { getCountry, type SharedProfile, TOKEN_RULES } from '@langx/shared'
import { Pressable, Text, View } from 'react-native'
import { levelLabel, useDisplayNames, useLocale, useT } from '../i18n'
import { makeStyles, useTheme } from '../lib/theme'
import { partnerHueFor } from '../lib/theme/partnerHue'
import { AuthBrandV3 } from './auth/AuthKitV3'
import { useBlackFont } from './onboarding/WizardV3'
import { OfficialMark } from './OfficialMark'
import { ModBadge } from './ui/ModBadge'
import { PhotoViewer } from './PhotoViewer'
import { Avatar } from './ui/Avatar'
import { Button } from './ui/Button'
import { Screen } from './ui/Screen'
import { Skeleton } from './ui/Skeleton'

/**
 * `/<handle>` for somebody signed out, in the redesign's look
 * (`V-PublicProfile`), behind `flags.v3Home`. `app/[username].tsx` keeps the
 * request, the invite flag, the redirect for a member and where the button
 * goes; this draws what the public DTO carries and nothing else — no age,
 * streak, online dot, numbers, reviews or activity, because the DTO has none.
 *
 * The hero is the person's own hue (`partnerHueFor`), the same colour they
 * will be in a member's chats. The country is written by name, without the
 * flag emoji today's line has: the board says so, and a flag is a government
 * where a person meant a place.
 */
export function SharedProfileV3({
  view,
  handle,
  user,
  invited,
  avatarOpen,
  onOpenAvatar,
  onCloseAvatar,
  onJoin,
  refreshing,
  onRefresh,
}: {
  view: 'loading' | 'missing' | 'profile'
  handle: string
  user: SharedProfile | undefined
  invited: boolean
  avatarOpen: boolean
  onOpenAvatar: () => void
  onCloseAvatar: () => void
  onJoin: () => void
  refreshing: boolean
  onRefresh: () => void
}) {
  const styles = useStyles()
  const t = useT()
  const { v3 } = useTheme()
  const { locale } = useLocale()
  const names = useDisplayNames()
  const black = useBlackFont()
  const n = (value: number) => value.toLocaleString(locale)

  if (view === 'loading' || !user) {
    return (
      <Screen scroll fluid ground={v3.colors.bg} style={styles.page}>
        <View style={styles.header}>
          <AuthBrandV3 />
        </View>
        {view === 'missing' ? (
          <View style={styles.missing}>
            <View
              style={styles.missingFrame}
              accessibilityElementsHidden
              importantForAccessibility="no-hide-descendants"
            >
              <Feather name="user-x" size={44} color={v3.colors.muted} />
            </View>
            <Text
              accessibilityRole="header"
              style={[styles.missingTitle, !black && styles.fallback]}
            >
              {t('shared.missingTitle')}
            </Text>
            <Text style={styles.missingBody}>{t('shared.missingBody', { handle })}</Text>
            <Button
              icon="arrow-right"
              iconPosition="end"
              label={t('shared.ctaLabel')}
              onPress={onJoin}
            />
          </View>
        ) : (
          <View style={[styles.hero, { backgroundColor: v3.colors.surface }]}>
            <View style={styles.heroTop}>
              <Skeleton width={112} height={112} radius={56} />
              <View style={styles.heroText}>
                <Skeleton width={160} height={40} />
                <Skeleton width={120} height={16} />
              </View>
            </View>
            <Skeleton width="100%" height={72} radius={20} />
          </View>
        )}
      </Screen>
    )
  }

  const country = user.country ? getCountry(user.country) : undefined
  const hue = v3.hues[partnerHueFor(user._id)]
  // The public DTO has no `priority`; the server sends them in the owner's order.
  const learning = user.learning

  return (
    <Screen
      scroll
      fluid
      ground={v3.colors.bg}
      style={styles.page}
      refreshing={refreshing}
      onRefresh={onRefresh}
    >
      <View style={styles.header}>
        <AuthBrandV3 />
      </View>

      <View style={[styles.hero, { backgroundColor: hue }]}>
        <View style={styles.heroTop}>
          {/* Only a photo opens: a drawn face has no full-size version to show. */}
          {user.avatarUrl ? (
            <Pressable
              accessibilityRole="button"
              accessibilityLabel={t('photo.open')}
              onPress={onOpenAvatar}
            >
              <Avatar url={user.avatarUrl} name={user.displayName} size={112} />
            </Pressable>
          ) : (
            <Avatar name={user.displayName} seed={user._id} size={112} />
          )}
          <View style={styles.heroText}>
            <View style={styles.nameRow}>
              <Text
                accessibilityRole="header"
                style={[styles.name, !black && styles.fallback]}
                numberOfLines={2}
              >
                {user.displayName}
              </Text>
              {user.official ? <OfficialMark size={22} /> : null}
              {user.moderator ? <ModBadge fontSize={v3.type.display.fontSize} on="hue" /> : null}
            </View>
            <Text style={styles.handle} numberOfLines={1}>
              @{user.handle}
              {country ? ` · ${names.country(country.code)}` : ''}
            </Text>
          </View>
        </View>

        {/* An official account has no language pair, as on the signed-in profile. */}
        {user.official || (user.nativeLanguages.length === 0 && learning.length === 0) ? null : (
          <View style={styles.languages}>
            <View style={styles.languageTile}>
              <Text style={styles.kicker}>{t('profile.teaches')}</Text>
              {user.nativeLanguages.map((language) => (
                <Text key={language.code} style={styles.languageName}>
                  {names.language(language.code)}
                </Text>
              ))}
            </View>
            <View style={styles.languageTile}>
              <Text style={styles.kicker}>{t('profile.learns')}</Text>
              {learning.map((language) => (
                <View key={language.code}>
                  <Text style={styles.languageName}>{names.language(language.code)}</Text>
                  <Text style={styles.level}>{levelLabel(t, language.level)}</Text>
                </View>
              ))}
            </View>
          </View>
        )}
      </View>

      {user.bio ? <Text style={styles.bio}>{user.bio}</Text> : null}

      <View style={styles.cta}>
        <View style={styles.ctaRow}>
          <View
            style={styles.pair}
            accessibilityElementsHidden
            importantForAccessibility="no-hide-descendants"
          >
            <View style={[styles.pairDot, { backgroundColor: hue }]}>
              <Text style={styles.pairInitial}>{user.displayName.slice(0, 1).toUpperCase()}</Text>
            </View>
            <View style={[styles.pairDot, styles.pairEmpty]}>
              <Feather name="plus" size={v3.icon.md} color={v3.colors.muted} />
            </View>
          </View>
          <Text style={styles.ctaBody}>
            {invited
              ? t('shared.inviteBody', {
                  name: user.displayName,
                  count: TOKEN_RULES.referral.inviteeTotal,
                  total: n(TOKEN_RULES.referral.inviteeTotal),
                  activation: n(TOKEN_RULES.referral.activation),
                  max: n(TOKEN_RULES.referral.maxPerInvitee),
                })
              : t('shared.ctaBody', { name: user.displayName })}
          </Text>
        </View>
        <Button
          icon="arrow-right"
          iconPosition="end"
          label={t('shared.ctaLabel')}
          onPress={onJoin}
        />
      </View>

      {user.avatarUrl ? (
        <PhotoViewer
          photos={[{ url: user.avatarUrl }]}
          index={avatarOpen ? 0 : null}
          onClose={onCloseAvatar}
        />
      ) : null}
    </Screen>
  )
}

const useStyles = makeStyles(({ v3 }) => ({
  page: { gap: v3.space[12], paddingBottom: v3.space[16] },
  header: { justifyContent: 'center', minHeight: 60 },
  fallback: { fontFamily: v3.type.headline.fontFamily },

  hero: {
    borderRadius: v3.radius.hero,
    gap: v3.space[16],
    paddingBottom: v3.space[16],
    paddingHorizontal: v3.space[16],
    paddingTop: v3.space[24],
  },
  heroTop: { alignItems: 'center', flexDirection: 'row', gap: v3.space[16] },
  heroText: { flex: 1, gap: v3.space[2], minWidth: 0 },
  nameRow: { alignItems: 'center', flexDirection: 'row', gap: v3.space[8] },
  name: { ...v3.type.display, color: v3.colors.ink, flexShrink: 1 },
  handle: { ...v3.type.callout, color: v3.colors.ink, fontWeight: '700' },

  languages: { flexDirection: 'row', gap: v3.space[8] },
  // A veil of white over the hue, as the board draws it: ink still reads on it.
  languageTile: {
    backgroundColor: 'rgba(255, 255, 255, 0.45)',
    borderRadius: v3.radius.card,
    flex: 1,
    gap: v3.space[2],
    paddingHorizontal: v3.space[12],
    paddingVertical: v3.space[10],
  },
  kicker: { ...v3.type.label, color: v3.colors.ink },
  languageName: { ...v3.type.headline, color: v3.colors.ink },
  level: { ...v3.type.caption, color: v3.colors.ink, fontWeight: '600' },

  bio: { ...v3.type.body, color: v3.colors.fg, paddingHorizontal: v3.space[6] },

  cta: {
    backgroundColor: v3.colors.surface,
    borderRadius: v3.radius.block,
    gap: v3.space[14],
    marginTop: v3.space[6],
    paddingBottom: v3.space[16],
    paddingHorizontal: v3.space[16],
    paddingTop: v3.space[16],
  },
  ctaRow: { alignItems: 'center', flexDirection: 'row', gap: v3.space[12] },
  // Side by side, not overlapped: tucked under the dashed circle, the
  // person's initial lost its right half.
  pair: { flexDirection: 'row', gap: v3.space[4] },
  pairDot: {
    alignItems: 'center',
    borderColor: v3.colors.surface,
    borderRadius: v3.radius.pill,
    borderWidth: 3,
    height: 48,
    justifyContent: 'center',
    width: 48,
  },
  pairEmpty: {
    backgroundColor: v3.colors.surface,
    borderColor: v3.colors.muted,
    borderStyle: 'dashed',
  },
  pairInitial: { ...v3.type.headline, color: v3.colors.ink },
  ctaBody: { ...v3.type.callout, color: v3.colors.fg, flex: 1, fontWeight: '700' },

  missing: { alignItems: 'center', gap: v3.space[12], paddingTop: v3.space[32] },
  missingFrame: {
    alignItems: 'center',
    borderColor: v3.colors.line,
    borderRadius: v3.radius.hero,
    borderStyle: 'dashed',
    borderWidth: 3,
    height: 140,
    justifyContent: 'center',
    marginBottom: v3.space[8],
    width: 140,
  },
  missingTitle: { ...v3.type.title, color: v3.colors.fg, textAlign: 'center' },
  missingBody: {
    ...v3.type.body,
    color: v3.colors.muted,
    marginBottom: v3.space[8],
    textAlign: 'center',
  },
}))

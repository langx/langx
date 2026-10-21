import Feather from '@expo/vector-icons/Feather'
import { useMemo, useState } from 'react'
import { ActivityIndicator, FlatList, Modal, Pressable, Text, TextInput, View } from 'react-native'
import { useSafeAreaInsets } from 'react-native-safe-area-context'
import { useConversations, useMe, type ConversationDto } from '../api/queries'
import { useConversationPartners } from '../hooks/useConversationPartners'
import { useV3Home } from '../hooks/useV3Home'
import { useT } from '../i18n'
import { dedupeById } from '../lib/dedupeById'
import { pickableConversations } from '../lib/conversationPicker'
import { makeStyles, useTheme } from '../lib/theme'
import { OfficialMark } from './OfficialMark'
import { Avatar } from './ui/Avatar'
import { Button } from './ui/Button'

const AVATAR_SIZE = 40

/**
 * One of the reader's own threads, picked from a sheet.
 *
 * The chat list's data rather than a query of its own — the same cache entry
 * the Chats tab fills, so opening this usually asks for nothing — and the same
 * partner resolution its rows use. Search is over what is loaded: the list
 * pages by recency, and whoever you mean to send something to is almost
 * always near the top of it. Scrolling loads the rest, as it does on the tab.
 *
 * Single choice, and the choice is the tap: there is nothing to confirm about
 * one row. What a pick means is the caller's — forward a message, send a
 * profile — so the sheet does not close itself.
 */
export function ConversationPicker({
  visible,
  title,
  onPick,
  onClose,
}: {
  visible: boolean
  title: string
  onPick: (conversation: ConversationDto) => void
  onClose: () => void
}) {
  const { colors, v3 } = useTheme()
  const current = useStyles()
  const redesigned = useStylesV3()
  const v3Look = useV3Home()
  const styles = v3Look ? redesigned : current
  const faint = v3Look ? v3.colors.muted : colors.textFaint
  const insets = useSafeAreaInsets()
  const t = useT()
  const me = useMe()
  const conversations = useConversations('all')
  const [query, setQuery] = useState('')

  const items = useMemo(() => {
    const pinned = conversations.data?.pages[0]?.pinned ?? []
    const rest = dedupeById(conversations.data?.pages.flatMap((page) => page.items) ?? [])
    return [...pinned, ...rest]
  }, [conversations.data])
  const partners = useConversationPartners(items, me.data?._id)
  const rows = pickableConversations(
    items.map((conversation) => {
      const partnerId = conversation.participants.find((id) => id !== me.data?._id) ?? ''
      // The list's own partner carries the handle and the account state the
      // filter needs; the resolved one is the fallback for an older API.
      return { conversation, partner: conversation.partner ?? partners[partnerId] }
    }),
    query,
  )

  function close(): void {
    setQuery('')
    onClose()
  }

  return (
    <Modal
      visible={visible}
      transparent
      animationType="slide"
      onRequestClose={close}
      accessibilityViewIsModal
    >
      <Pressable style={styles.backdrop} accessibilityLabel={t('common.cancel')} onPress={close}>
        {/* Swallows the press so tapping the sheet does not close it. */}
        <Pressable style={styles.sheet} onPress={() => undefined}>
          <View style={styles.header}>
            <Text style={styles.title}>{title}</Text>
            <View style={styles.field}>
              <Feather name="search" size={v3Look ? v3.icon.md : 18} color={faint} />
              <TextInput
                value={query}
                onChangeText={setQuery}
                placeholder={t('conversationPicker.searchPlaceholder')}
                placeholderTextColor={faint}
                autoCapitalize="none"
                autoCorrect={false}
                returnKeyType="search"
                style={styles.input}
              />
            </View>
          </View>

          {conversations.isPending ? (
            <ActivityIndicator style={styles.spinner} />
          ) : (
            <FlatList
              data={rows}
              keyExtractor={(row) => row.conversation._id}
              keyboardShouldPersistTaps="handled"
              contentContainerStyle={styles.list}
              onEndReachedThreshold={0.6}
              onEndReached={() => {
                if (conversations.hasNextPage && !conversations.isFetchingNextPage) {
                  void conversations.fetchNextPage()
                }
              }}
              ListFooterComponent={
                conversations.isFetchingNextPage ? (
                  <ActivityIndicator style={styles.spinner} />
                ) : null
              }
              ListEmptyComponent={
                <Text style={styles.none}>
                  {t(query.trim() ? 'conversationPicker.noMatches' : 'conversationPicker.empty')}
                </Text>
              }
              renderItem={({ item: { conversation, partner } }) => (
                <Pressable
                  accessibilityRole="button"
                  accessibilityLabel={partner?.displayName}
                  disabled={!partner}
                  onPress={() => {
                    setQuery('')
                    onPick(conversation)
                  }}
                  style={({ pressed }) => [styles.row, pressed && styles.pressed]}
                >
                  <Avatar
                    url={partner?.avatarUrl}
                    name={partner?.displayName ?? ''}
                    seed={partner?._id ?? conversation._id}
                    size={AVATAR_SIZE}
                  />
                  <View style={styles.text}>
                    <View style={styles.nameRow}>
                      <Text style={styles.name} numberOfLines={1}>
                        {partner?.displayName ?? ''}
                      </Text>
                      {partner?.official ? <OfficialMark size={14} /> : null}
                    </View>
                    {conversation.partner?.handle ? (
                      <Text style={styles.handle} numberOfLines={1}>
                        @{conversation.partner.handle}
                      </Text>
                    ) : null}
                  </View>
                </Pressable>
              )}
            />
          )}

          {/* Outside the scroller, like every sheet's way out. */}
          <View
            style={[
              styles.footer,
              // v3 keeps Cancel clear of the home indicator; the current look is unchanged.
              v3Look && { paddingBottom: Math.max(v3.space[32], insets.bottom + v3.space[16]) },
            ]}
          >
            <Button label={t('common.cancel')} variant="neutral" onPress={close} />
          </View>
        </Pressable>
      </Pressable>
    </Modal>
  )
}

const useStyles = makeStyles(({ colors, font, radius, spacing }) => ({
  backdrop: { backgroundColor: colors.scrim, flex: 1, justifyContent: 'flex-end' },
  // A phone-width column even on the web, as `EchoAboutSheet` explains.
  sheet: {
    alignSelf: 'center',
    backgroundColor: colors.bg,
    borderTopLeftRadius: radius.xl,
    borderTopRightRadius: radius.xl,
    height: '80%',
    maxWidth: 480,
    width: '100%',
  },
  header: {
    gap: spacing.md,
    paddingBottom: spacing.sm,
    paddingHorizontal: spacing.lg,
    paddingTop: spacing.xl,
  },
  title: { ...font.heading, color: colors.text, fontSize: 18 },
  // The pill `PeopleSearch` draws, without its close button: the sheet has one.
  field: {
    alignItems: 'center',
    backgroundColor: colors.fill,
    borderRadius: radius.pill,
    flexDirection: 'row',
    gap: 10,
    height: 44,
    paddingHorizontal: 18,
  },
  input: { color: colors.text, flex: 1, fontSize: 16, padding: 0 },
  list: { paddingBottom: spacing.md, paddingHorizontal: spacing.lg },
  spinner: { marginTop: spacing.md },
  row: { alignItems: 'center', flexDirection: 'row', gap: spacing.md, paddingVertical: spacing.sm },
  pressed: { opacity: 0.7 },
  text: { flex: 1, gap: 1, minWidth: 0 },
  nameRow: { alignItems: 'center', flexDirection: 'row', gap: 6 },
  name: { ...font.label, color: colors.text, flexShrink: 1, fontSize: 15 },
  handle: { ...font.caption, color: colors.textMuted },
  none: { ...font.caption, color: colors.textFaint, marginTop: spacing.md, textAlign: 'center' },
  footer: {
    borderTopColor: colors.border,
    borderTopWidth: 1,
    paddingBottom: spacing.xxl,
    paddingHorizontal: spacing.lg,
    paddingTop: spacing.md,
  },
}))

/**
 * v3's look for the same picker, behind `flags.v3Home` (the thread's Forward
 * and Profile's Send profile both open it). No board draws it; it follows
 * `WhatsProSheet` for the sheet and the v3 search fields for the pill, with
 * rows at v3's list height and the name in v3's button type, as a person row
 * names someone.
 */
const useStylesV3 = makeStyles(({ v3 }) => ({
  backdrop: { backgroundColor: v3.colors.scrim, flex: 1, justifyContent: 'flex-end' },
  sheet: {
    alignSelf: 'center',
    backgroundColor: v3.colors.bg,
    borderTopLeftRadius: v3.radius.block,
    borderTopRightRadius: v3.radius.block,
    height: '80%',
    maxWidth: 480,
    width: '100%',
  },
  header: {
    gap: v3.space[12],
    paddingBottom: v3.space[8],
    paddingHorizontal: v3.space[16],
    paddingTop: v3.space[24],
  },
  title: { ...v3.type.headline, color: v3.colors.fg },
  field: {
    alignItems: 'center',
    backgroundColor: v3.colors.surface,
    borderRadius: v3.radius.pill,
    flexDirection: 'row',
    gap: v3.space[10],
    height: 52,
    paddingHorizontal: v3.space[16],
  },
  // No browser focus ring on the web: the pill is the only field in the overlay,
  // and the caret in it already says where typing goes.
  input: {
    color: v3.colors.fg,
    flex: 1,
    fontSize: v3.type.body.fontSize,
    outlineWidth: 0,
    padding: 0,
  },
  list: { paddingBottom: v3.space[12], paddingHorizontal: v3.space[16] },
  spinner: { marginTop: v3.space[12] },
  row: {
    alignItems: 'center',
    flexDirection: 'row',
    gap: v3.space[12],
    minHeight: 60,
    paddingVertical: v3.space[10],
  },
  pressed: { opacity: 0.7 },
  text: { flex: 1, gap: v3.space[2], minWidth: 0 },
  nameRow: { alignItems: 'center', flexDirection: 'row', gap: v3.space[6] },
  name: { ...v3.type.button, color: v3.colors.fg, flexShrink: 1 },
  handle: { ...v3.type.caption, color: v3.colors.muted },
  none: {
    ...v3.type.callout,
    color: v3.colors.muted,
    marginTop: v3.space[12],
    textAlign: 'center',
  },
  footer: {
    borderTopColor: v3.colors.line,
    borderTopWidth: 1,
    paddingBottom: v3.space[32],
    paddingHorizontal: v3.space[16],
    paddingTop: v3.space[12],
  },
}))

import type Feather from '@expo/vector-icons/Feather'
import { attachmentsOf, type Media } from '@langx/shared'
import { memo, useMemo, type ReactNode } from 'react'
import { Pressable, Text, View } from 'react-native'
import type { FeedPost } from '../../api/types'
import { useDisplayNames, useLocale, useT } from '../../i18n'
import { foldCorrection } from '../../lib/feedCache'
import { relativeTime } from '../../lib/format'
import { asksOf } from '../../lib/postAsks'
import { postCardAction, postCardKind, type PostCardAction } from '../../lib/postCard'
import { DISPLAY_FONT, makeStyles, useTheme } from '../../lib/theme'
import { partnerHueFor } from '../../lib/theme/partnerHue'
import { LikeButton } from '../LikeButton'
import { MediaGallery } from '../MediaBubble'
import { Avatar } from '../ui/Avatar'
import { Button } from '../ui/Button'

/** Back from a post lands on the feed's route, which redirects to this segment. */
const FROM = '/(app)/(tabs)/feed'

/**
 * How long an ask's sentence can be and still be set big. The drawing sets
 * "I am agree with you" like a heading; a paragraph at that size is a wall.
 */
const BIG_SENTENCE = 40

/**
 * The card's handlers, one stable object for the whole list: each takes the
 * post, so a card never closes over anything that changes under it.
 */
export interface PostCardHandlers {
  open: (post: FeedPost, index: number) => void
  openAuthor: (post: FeedPost) => void
  more: (post: FeedPost) => void
  correct: (post: FeedPost) => void
  openMedia: (items: Media[], index: number) => void
}

const ACTION_ICONS = {
  correct: 'edit-3',
  record: 'mic',
  comment: 'message-circle',
  view: 'arrow-right',
} as const satisfies Record<PostCardAction, keyof typeof Feather.glyphMap>

/**
 * One post on People's Posts segment, in the v3 look (`V-Posts`).
 *
 * Two cards, because a post is one of two things. An **ask** is a block in its
 * author's partner colour with an "Ask" chip, what it asks in words, the
 * sentence set big and one big Help button. A **moment** sits on the grey
 * surface with a "Moment" chip, its words and pictures, and one big Comment
 * button — a moment never offers a correction, which the server would refuse
 * (see `postCardAction`). Both carry the like, in the same place.
 *
 * Memoised: the list hands every card the same handlers and only the values
 * that are about this card, so a keystroke in another card's correction box
 * or a video starting two rows up re-renders nothing here.
 */
export const PostCard = memo(function PostCard({
  post,
  index,
  mine,
  playing,
  selected,
  composing,
  composer,
  black,
  handlers,
}: {
  post: FeedPost
  index: number
  mine: boolean
  /** Whether this card's video may run: on screen, on a focused tab. */
  playing: boolean
  /** The post in the wide window's side panel. */
  selected: boolean
  /** This card's correction box is open, so its button steps aside. */
  composing: boolean
  /** The open correction box, drawn under the card; `null` on every other card. */
  composer: ReactNode
  /** Whether Nunito Black has arrived. */
  black: boolean
  handlers: PostCardHandlers
}) {
  const styles = useStyles()
  const { v3 } = useTheme()
  const t = useT()
  const names = useDisplayNames()
  const { locale } = useLocale()

  const asks = asksOf(post)
  const kind = postCardKind(asks)
  const ask = kind === 'ask'
  const text = post.body.trim()
  const media = attachmentsOf(post)
  const chosen = postCardAction({
    asks,
    mine,
    correctedByViewer: post.correctedByViewer,
    answeredByViewer: post.answeredByViewer,
  })
  // A correction is an edit of the words; a post from before words were
  // required with an ask may have none, and opens instead.
  const action: PostCardAction = chosen === 'correct' && !text ? 'view' : chosen
  const name = post.author.displayName
  const label =
    action === 'correct' || action === 'record'
      ? t('feed.helpName', { name })
      : action === 'comment'
        ? t('feed.comment')
        : t('feed.viewPost')
  const ground = ask ? v3.hues[partnerHueFor(post.author._id)] : v3.colors.surface
  // The hues are light in both schemes and always carry ink; the surface
  // flips with the scheme and carries the ordinary text colour.
  const ink = ask ? v3.colors.ink : v3.colors.fg

  const helped = [
    asks.includes('correction') && post.correctionCount > 0
      ? t('feed.corrections', { count: post.correctionCount })
      : null,
    asks.includes('pronunciation') && post.answerCount > 0
      ? t('feed.answers', { count: post.answerCount })
      : null,
  ].filter((part): part is string => part !== null)
  const done = [
    asks.includes('correction') && post.correctedByViewer ? t('feed.youCorrected') : null,
    asks.includes('pronunciation') && post.answeredByViewer ? t('feed.youAnswered') : null,
  ].filter((part): part is string => part !== null)

  return (
    <View style={styles.row}>
      <View style={[styles.card, { backgroundColor: ground }, selected && styles.selected]}>
        <Pressable
          accessibilityRole="button"
          accessibilityLabel={name}
          onPress={() => handlers.openAuthor(post)}
          /*
           * The post's menu (Echo, Report) on every card. The words carry it
           * too, but a photo or a video with no caption has none, and the
           * current card's "View post" row that held it there is this card's
           * big button, which takes no long press.
           */
          onLongPress={() => handlers.more(post)}
          style={({ pressed }) => [styles.head, pressed && styles.pressed]}
        >
          <Avatar url={post.author.avatarUrl} name={name} seed={post.author._id} size={40} />
          <View style={styles.headText}>
            <Text style={[styles.name, { color: ink }]} numberOfLines={1}>
              {name}
            </Text>
            <Text style={[styles.meta, { color: ask ? ink : v3.colors.muted }]} numberOfLines={1}>
              {names.language(post.language)} · {relativeTime(post.createdAt, { t, locale })}
            </Text>
          </View>
          {ask ? (
            <Text style={styles.askChip}>{t('feed.askChip')}</Text>
          ) : (
            <Text style={styles.momentChip}>{t('feed.momentChip')}</Text>
          )}
        </Pressable>

        {/* What the post asks for, in words: the question the button answers. */}
        {asks.includes('correction') ? (
          <Text style={[styles.question, { color: ink }]}>{t('feed.askNatural')}</Text>
        ) : null}
        {asks.includes('pronunciation') ? (
          <Text style={[styles.question, { color: ink }]}>{t('feed.askPronounce')}</Text>
        ) : null}

        {/*
          The words open the post, and a long press offers the same menu the
          current card does. They wrap nothing else, so the web build never
          renders a button inside a button.
        */}
        {text ? (
          <Pressable
            accessibilityRole="button"
            accessibilityHint={t('feed.openPost')}
            onPress={() => handlers.open(post, index)}
            onLongPress={() => handlers.more(post)}
          >
            <Text
              style={[
                ask && text.length <= BIG_SENTENCE
                  ? [styles.big, !black && styles.bigFallback]
                  : ask
                    ? styles.sentence
                    : styles.body,
                { color: ink },
              ]}
            >
              {post.body}
            </Text>
          </Pressable>
        ) : null}

        {media.length > 0 ? (
          <MediaGallery
            items={media}
            onOpen={(at) => handlers.openMedia(media, at)}
            videoMode="preview"
            videoPlaying={playing}
            fill
          />
        ) : null}

        {/*
          The card's one correction — the oldest — as the current card shows
          it (_The feed's one visible correction needed somewhere to lead_):
          the help that already came, on the ground, opening the post.
        */}
        {asks.includes('correction') && post.topCorrection ? (
          <Pressable
            accessibilityRole="button"
            onPress={() => handlers.open(post, index)}
            style={({ pressed }) => [styles.top, pressed && styles.pressed]}
          >
            <Text style={styles.topLabel}>
              {t('feed.topCorrection')} {post.topCorrection.author.displayName}
            </Text>
            <CorrectedLine original={post.body} corrected={post.topCorrection.corrected} />
          </Pressable>
        ) : null}

        {ask && (helped.length > 0 || done.length > 0) ? (
          <View style={styles.counts}>
            {[...helped, ...done].map((line) => (
              <Text key={line} style={[styles.count, { color: ink }]}>
                {line}
              </Text>
            ))}
          </View>
        ) : null}

        {/*
          The like on every card, in the same place above the big button.
          Likes pay nothing and rank nothing, but a heart that shows on a
          moment and is missing on an ask reads as broken, not as a rule. On
          the hue the heart takes the ink, as the card's words do.
        */}
        <View style={styles.social}>
          <LikeButton
            targetType="post"
            targetId={post._id}
            likeCount={post.likeCount}
            likedByViewer={post.likedByViewer}
            disabled={mine}
            from={FROM}
            {...(ask ? { tint: ink } : {})}
          />
          {!ask && post.commentCount > 0 ? (
            <Text style={styles.commentCount}>
              {t('feed.comments', { count: post.commentCount })}
            </Text>
          ) : null}
        </View>

        {composing ? null : (
          <Button
            label={label}
            icon={ACTION_ICONS[action]}
            iconPosition={action === 'view' ? 'end' : 'start'}
            variant={ask ? 'hue' : 'secondary'}
            onPress={() =>
              action === 'correct' ? handlers.correct(post) : handlers.open(post, index)
            }
          />
        )}
      </View>
      {composer}
    </View>
  )
})

/** The corrected sentence as one line, only the changed parts in colour — see `foldCorrection`. */
function CorrectedLine({ original, corrected }: { original: string; corrected: string }) {
  const styles = useStyles()
  const runs = useMemo(() => foldCorrection(original, corrected), [original, corrected])
  return (
    <Text style={styles.corrected}>
      {runs.map((run, at) => (
        <Text
          key={at}
          style={
            run.kind === 'removed' ? styles.removed : run.kind === 'added' ? styles.added : null
          }
        >
          {run.text}
        </Text>
      ))}
    </Text>
  )
}

const useStyles = makeStyles(({ v3 }) => ({
  row: { gap: v3.space[10] },
  card: {
    borderRadius: v3.radius.block,
    gap: v3.space[10],
    paddingBottom: v3.space[16],
    paddingHorizontal: v3.space[16],
    paddingTop: v3.space[14],
  },
  selected: { borderColor: v3.colors.fg, borderWidth: 3 },
  pressed: { opacity: 0.7 },
  head: { alignItems: 'center', flexDirection: 'row', gap: v3.space[10] },
  headText: { flex: 1, minWidth: 0 },
  name: { ...v3.type.buttonSmall },
  meta: { ...v3.type.caption, fontWeight: '600' },
  // Ink on the hue in both schemes, as the drawing has it; the label is
  // `onBlue` because it is the palette's one white that stays white after dark.
  askChip: {
    ...v3.type.label,
    backgroundColor: v3.colors.ink,
    borderRadius: v3.radius.pill,
    color: v3.colors.onBlue,
    overflow: 'hidden',
    paddingHorizontal: v3.space[12],
    paddingVertical: v3.space[6],
  },
  momentChip: {
    ...v3.type.label,
    borderColor: v3.colors.fg,
    borderRadius: v3.radius.pill,
    borderWidth: 2,
    color: v3.colors.fg,
    paddingHorizontal: v3.space[10],
    paddingVertical: v3.space[4],
  },
  question: { ...v3.type.callout, fontWeight: '700' },
  big: { ...v3.type.title },
  bigFallback: { fontFamily: DISPLAY_FONT },
  sentence: { ...v3.type.headline },
  body: { ...v3.type.body },
  // On the ground rather than the hue, so the correction's green reads in both schemes.
  top: {
    backgroundColor: v3.colors.bg,
    borderRadius: v3.radius.row,
    gap: v3.space[4],
    paddingHorizontal: v3.space[14],
    paddingVertical: v3.space[10],
  },
  topLabel: { ...v3.type.label, color: v3.colors.correction },
  corrected: { ...v3.type.callout, color: v3.colors.fg },
  removed: { color: v3.colors.muted, textDecorationLine: 'line-through' },
  added: { color: v3.colors.correction, fontWeight: '800' },
  counts: { gap: v3.space[2] },
  count: { ...v3.type.caption, fontWeight: '600' },
  social: { alignItems: 'center', flexDirection: 'row', gap: v3.space[16] },
  commentCount: { ...v3.type.caption, color: v3.colors.muted, fontWeight: '600' },
}))

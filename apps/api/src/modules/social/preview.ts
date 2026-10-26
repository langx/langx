import { captionWithHashtags, type SocialPlatform } from '@langx/shared'
import type { SocialPostSlot } from './posts'
import type { TikTokPostMode } from './tiktok'

/**
 * What one row will put on its platform, as text — the dry run's output.
 *
 * Built from the same `captionWithHashtags` the adapters send, so what this
 * prints is what goes out, not a description of it.
 */
export function previewSocialPost(
  row: Pick<
    SocialPostSlot,
    | 'platform'
    | 'dayOffset'
    | 'videoDay'
    | 'lang'
    | 'videoUrl'
    | 'coverUrl'
    | 'scheduledAt'
    | 'content'
    | 'firstComment'
    | 'nativeCheck'
  > & { status?: string },
  options: { timeZone: string; tiktokMode: TikTokPostMode; connected: boolean },
): string {
  const local = new Intl.DateTimeFormat('en-CA', {
    timeZone: options.timeZone,
    dateStyle: 'short',
    timeStyle: 'short',
    hourCycle: 'h23',
  }).format(row.scheduledAt)
  const head = [
    `Day ${row.videoDay} (offset ${row.dayOffset})`,
    `${local} ${options.timeZone} = ${row.scheduledAt.toISOString()}`,
    row.lang,
    row.platform,
    ...(row.status ? [row.status] : []),
    ...(row.nativeCheck ? [`native check: ${row.nativeCheck}`] : []),
    ...(options.connected ? [] : ['NOT CONNECTED']),
  ].join(' · ')

  const lines = [head, `  video ${row.videoUrl}`]
  const body = (label: string, text: string) =>
    lines.push(`  ${label}:`, ...text.split('\n').map((line) => `    ${line}`))

  const kinds: Record<SocialPlatform, string> = {
    instagram: 'Reel, shared to the feed',
    facebook: 'Page reel',
    youtube: 'Short, public (private until the Google audit)',
    tiktok:
      options.tiktokMode === 'direct'
        ? 'public post'
        : 'draft in the TikTok inbox; the caption is pasted by hand',
  }
  lines.push(`  as ${kinds[row.platform]}`)

  if (row.platform === 'youtube') {
    body('title', row.content.title ?? '')
    body('description', row.content.description ?? '')
    lines.push(`  tags: ${(row.content.tags ?? []).join(', ')}`)
  } else {
    if (row.platform === 'instagram') lines.push(`  cover ${row.coverUrl}`)
    body('caption', captionWithHashtags(row.content))
  }
  if (row.firstComment) body('first comment', row.firstComment)
  return lines.join('\n')
}

import { describe, expect, it } from 'vitest'
import { calendarSlots, socialCalendarSchema } from './calendar'
import { previewSocialPost } from './preview'

const MEDIA = 'https://media.langx.io/venus/v1'

function post(lang: string, day: string, caption: string) {
  return {
    lang,
    videoUrl: `${MEDIA}/${lang}/venus-day${day}-${lang}.mp4`,
    coverUrl: `${MEDIA}/${lang}/venus-day${day}-${lang}.jpg`,
    postTime: '12:30',
    platforms: {
      instagram: { caption: `${caption} (ig)`, hashtags: ['#LangXVenus', '#cats'] },
      tiktok: { caption: `${caption} (tt)`, hashtags: ['#LangXVenus'] },
      youtube: { title: `${caption} (yt)`, description: 'About Venus.', tags: ['Venus'] },
    },
  }
}

/** The shape of the real file, review-only keys and all. */
const CALENDAR = {
  version: 1,
  timezone: 'America/Toronto',
  startDate: null,
  $comment: 'Draft for approval.',
  accounts: { instagram: { handle: '@langxapp', status: 'live' } },
  slots: [
    {
      ...post('en', '001', 'Day 1. Meet Venus.'),
      dayOffset: 0,
      videoDay: 1,
      kind: 'milestone',
      cta: 'venus',
      line: 'Hi.',
      firstComment: 'Say hi to Venus.',
      status: 'draft',
      duration: 14.7,
    },
    {
      ...post('tr', '006', '6. gün.'),
      dayOffset: 5,
      videoDay: 6,
      kind: 'swap',
      cta: null,
      line: 'Koca bir konuşma.',
      lineEn: 'A whole speech.',
      firstComment: 'EN: "A whole speech."',
      nativeCheck: 'needed',
      status: 'draft',
      enAlternate: { ...post('en', '006', 'Day 6. The speech.'), firstComment: null },
      duration: 12.4,
    },
  ],
}

describe('the social calendar file', () => {
  it('reads the file as it is written, review-only keys included', () => {
    const calendar = socialCalendarSchema.parse(CALENDAR)
    expect(calendar.slots).toHaveLength(2)
    expect(calendar.slots[1]?.enAlternate?.lang).toBe('en')
  })

  it('refuses two slots on one day, a time zone nobody knows, and a plain-http video', () => {
    const [first] = CALENDAR.slots
    expect(socialCalendarSchema.safeParse({ ...CALENDAR, slots: [first, first] }).success).toBe(
      false,
    )
    expect(socialCalendarSchema.safeParse({ ...CALENDAR, timezone: 'Mars/Olympus' }).success).toBe(
      false,
    )
    const insecure = { ...first, videoUrl: 'http://media.langx.io/venus/v1/en/a.mp4' }
    expect(socialCalendarSchema.safeParse({ ...CALENDAR, slots: [insecure] }).success).toBe(false)
  })

  it('makes one row per slot per platform, at the local time on either side of a clock change', () => {
    const calendar = socialCalendarSchema.parse(CALENDAR)
    // Day 0 is the last day of daylight time; day 5 is in standard time.
    const rows = calendarSlots(calendar, '2026-10-31')
    expect(rows).toHaveLength(8)
    const day0 = rows.find((row) => row.dayOffset === 0 && row.platform === 'instagram')
    const day5 = rows.find((row) => row.dayOffset === 5 && row.platform === 'instagram')
    expect(day0?.scheduledAt.toISOString()).toBe('2026-10-31T16:30:00.000Z')
    expect(day5?.scheduledAt.toISOString()).toBe('2026-11-05T17:30:00.000Z')
  })

  it("gives Facebook Instagram's words, and the first comment to Instagram alone", () => {
    const rows = calendarSlots(socialCalendarSchema.parse(CALENDAR), '2026-11-02')
    const day0 = (platform: string) =>
      rows.find((row) => row.dayOffset === 0 && row.platform === platform)
    expect(day0('facebook')?.content.caption).toBe('Day 1. Meet Venus. (ig)')
    expect(day0('tiktok')?.content.caption).toBe('Day 1. Meet Venus. (tt)')
    expect(day0('youtube')?.content.title).toBe('Day 1. Meet Venus. (yt)')
    expect(day0('instagram')?.firstComment).toBe('Say hi to Venus.')
    expect(day0('facebook')?.firstComment).toBeNull()
    expect(day0('tiktok')?.firstComment).toBeNull()
  })

  it('carries the native check and the English alternate on a swap day, per platform', () => {
    const rows = calendarSlots(socialCalendarSchema.parse(CALENDAR), '2026-11-02', ['youtube'])
    const swap = rows.find((row) => row.dayOffset === 5)
    expect(swap?.nativeCheck).toBe('needed')
    expect(swap?.lang).toBe('tr')
    expect(swap?.alternate?.lang).toBe('en')
    expect(swap?.alternate?.content.title).toBe('Day 6. The speech. (yt)')
    expect(swap?.alternate?.videoUrl).toBe(`${MEDIA}/en/venus-day006-en.mp4`)
  })

  it('takes file names from the calendar rather than building them', () => {
    const recut = {
      ...CALENDAR,
      slots: [{ ...CALENDAR.slots[0], videoUrl: `${MEDIA}/en/venus-day001-en-r2.mp4` }],
    }
    const [row] = calendarSlots(socialCalendarSchema.parse(recut), '2026-11-02', ['instagram'])
    expect(row?.videoUrl).toBe(`${MEDIA}/en/venus-day001-en-r2.mp4`)
  })

  it('previews exactly the caption that is sent: words, a blank line, the hashtags', () => {
    const [row] = calendarSlots(socialCalendarSchema.parse(CALENDAR), '2026-11-02', ['instagram'])
    if (!row) throw new Error('no row')
    const text = previewSocialPost(row, {
      timeZone: 'America/Toronto',
      tiktokMode: 'inbox',
      connected: true,
    })
    expect(text).toContain('2026-11-02, 12:30 America/Toronto')
    expect(text).toContain('    Day 1. Meet Venus. (ig)\n    \n    #LangXVenus #cats')
    expect(text).toContain('first comment:\n    Say hi to Venus.')
    expect(text).not.toContain('NOT CONNECTED')
  })
})

import { describe, expect, it } from 'vitest'
import { streakRowVenus } from './venusStreakRow'
import type { VenusVideo } from './venusStory'

const video: VenusVideo = {
  day: 7,
  locale: 'en',
  cut: 'day',
  dayKey: '2026-10-25',
  fileName: 'venus-day007-en.mp4',
  url: 'https://media.example/venus/en/venus-day007-en.mp4',
  coverUrl: null,
}

describe('streakRowVenus', () => {
  it('is the plain row without a video, whatever was watched', () => {
    expect(streakRowVenus(null, null, 'me')).toBe('none')
    expect(streakRowVenus(null, { me: '2026-10-25' }, 'me')).toBe('none')
    expect(streakRowVenus(null, undefined, undefined)).toBe('none')
  })

  it('says the video is ready until this account has watched today’s', () => {
    expect(streakRowVenus(video, null, 'me')).toBe('ready')
    expect(streakRowVenus(video, {}, 'me')).toBe('ready')
  })

  it('goes back to the reward once today’s video was watched to the end', () => {
    expect(streakRowVenus(video, { me: '2026-10-25' }, 'me')).toBe('watched')
  })

  it('is ready again on the next counted day', () => {
    expect(streakRowVenus(video, { me: '2026-10-24' }, 'me')).toBe('ready')
  })

  it('keeps accounts on one device apart', () => {
    expect(streakRowVenus(video, { other: '2026-10-25' }, 'me')).toBe('ready')
  })

  it('does not announce the video before the device has said what was watched', () => {
    expect(streakRowVenus(video, undefined, 'me')).toBe('watched')
    expect(streakRowVenus(video, null, undefined)).toBe('watched')
  })
})

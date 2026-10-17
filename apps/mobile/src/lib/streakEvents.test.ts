import { TOKEN_RULES } from '@langx/shared'
import { describe, expect, it } from 'vitest'
import { streakEventsFor } from './streakEvents'

const names = (events: ReturnType<typeof streakEventsFor>) => events.map((event) => event.name)

describe('streakEventsFor', () => {
  it('sends nothing for a check-in that credited nothing', () => {
    expect(
      streakEventsFor({ current: 12, longest: 12, advanced: false, freezeUsed: false }),
    ).toEqual([])
  })

  it('counts an ordinary advancing day once, with the streak it reached', () => {
    expect(streakEventsFor({ current: 4, longest: 9, advanced: true, freezeUsed: false })).toEqual([
      { name: 'streak_checked_in', properties: { days: 4 } },
    ])
  })

  it('adds freeze_used when a banked freeze bridged the gap', () => {
    const events = streakEventsFor({ current: 5, longest: 5, advanced: true, freezeUsed: true })
    expect(names(events)).toEqual(['streak_checked_in', 'freeze_used'])
  })

  it('reports a milestone for every day in the shared table, and for no other', () => {
    for (const day of Object.keys(TOKEN_RULES.streakMilestones).map(Number)) {
      const events = streakEventsFor({
        current: day,
        longest: day,
        advanced: true,
        freezeUsed: false,
      })
      expect(events).toContainEqual({ name: 'streak_milestone_reached', properties: { days: day } })
    }
    const events = streakEventsFor({ current: 8, longest: 8, advanced: true, freezeUsed: false })
    expect(names(events)).not.toContain('streak_milestone_reached')
  })

  it('does not report a milestone for a day that only passed it', () => {
    const past = Math.max(...Object.keys(TOKEN_RULES.streakMilestones).map(Number)) + 1
    const events = streakEventsFor({
      current: past,
      longest: past,
      advanced: true,
      freezeUsed: false,
    })
    expect(names(events)).toEqual(['streak_checked_in'])
  })

  it('reports a broken streak when a new run starts under a longer one on record', () => {
    const events = streakEventsFor({ current: 1, longest: 23, advanced: true, freezeUsed: false })
    expect(events).toContainEqual({ name: 'streak_broken', properties: { longest: 23 } })
  })

  it('does not call a first-ever day a broken streak', () => {
    const events = streakEventsFor({ current: 1, longest: 1, advanced: true, freezeUsed: false })
    expect(names(events)).toEqual(['streak_checked_in'])
  })

  it('never reports a break for a streak that carried on', () => {
    const events = streakEventsFor({ current: 2, longest: 30, advanced: true, freezeUsed: false })
    expect(names(events)).toEqual(['streak_checked_in'])
  })
})

import { describe, expect, it } from 'vitest'
import { inviteHandleFromUrl, normalizeInviteCode } from './inviteLink'

/**
 * These run on paths where a throw is not an error message but a launch that
 * never finishes, or a keystroke that clears the field somebody is typing in.
 * Every case answers null instead.
 */
describe('normalizeInviteCode', () => {
  it('takes a bare handle', () => {
    expect(normalizeInviteCode('deniz')).toBe('deniz')
  })

  it('forgives the shapes people actually type', () => {
    expect(normalizeInviteCode('  @Deniz ')).toBe('deniz')
    expect(normalizeInviteCode('DENIZ')).toBe('deniz')
  })

  /**
   * The single most likely thing somebody does with a link is paste it, and
   * supporting that costs one branch. An unmarked profile link counts here —
   * unlike a link *arriving* from outside — because pasting into a box
   * labelled "invite code" is not ambiguous about intent.
   */
  it('accepts a pasted link, marked or not', () => {
    expect(normalizeInviteCode('https://app2.langx.io/deniz?invite=1')).toBe('deniz')
    expect(normalizeInviteCode('https://app2.langx.io/deniz')).toBe('deniz')
    expect(normalizeInviteCode('app2.langx.io/deniz')).toBe('deniz')
  })

  it('answers null for anything that is not a handle', () => {
    for (const input of [
      null,
      undefined,
      '',
      '   ',
      'nope!',
      'ab',
      '@',
      'https://app2.langx.io/',
    ]) {
      expect(normalizeInviteCode(input), String(input)).toBeNull()
    }
  })
})

describe('inviteHandleFromUrl, as the app calls it', () => {
  /** The shape `Linking.getInitialURL()` actually returns when there is none. */
  it('survives a cold start with no link at all', () => {
    expect(inviteHandleFromUrl(null)).toBeNull()
    expect(inviteHandleFromUrl(undefined)).toBeNull()
  })

  it('reads only a marked link, so sharing a profile is not an attribution', () => {
    expect(inviteHandleFromUrl('https://app2.langx.io/deniz?invite=1')).toBe('deniz')
    expect(inviteHandleFromUrl('https://app2.langx.io/deniz')).toBeNull()
  })
})

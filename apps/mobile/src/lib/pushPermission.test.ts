import { describe, expect, it } from 'vitest'
import { shouldAskForPush } from './pushPermission'

/** Nobody has answered anything yet, on a phone that has never been asked. */
const fresh = {
  granted: false,
  canAskAgain: true,
  undetermined: true,
  asked: false,
  platform: 'ios',
}

describe('whether the chats tab raises the notification dialog', () => {
  it('asks a phone that has not been asked', () => {
    expect(shouldAskForPush(fresh)).toBe(true)
    expect(shouldAskForPush({ ...fresh, platform: 'android' })).toBe(true)
  })

  it('never asks in a browser', () => {
    expect(shouldAskForPush({ ...fresh, platform: 'web' })).toBe(false)
  })

  it('leaves an answered phone alone', () => {
    expect(shouldAskForPush({ ...fresh, granted: true, undetermined: false })).toBe(false)
    // A refusal iOS will not reopen: only the Settings app can undo it.
    expect(shouldAskForPush({ ...fresh, canAskAgain: false, undetermined: false })).toBe(false)
  })

  /**
   * The flag written beside a dialog that never appeared. iOS cannot collect
   * an answer without showing one, so this state can only mean it did not —
   * and nothing else in the app will ever ask again.
   */
  it('asks again on iOS when the flag claims an answer the OS has no record of', () => {
    expect(shouldAskForPush({ ...fresh, asked: true })).toBe(true)
  })

  /**
   * Android's dialog is dismissable, and a dismissal leaves exactly the same
   * state — so the flag stands there, or one dismissal becomes a dialog on
   * every visit to the tab.
   */
  it('trusts the flag on Android, where a dismissal looks the same', () => {
    expect(shouldAskForPush({ ...fresh, asked: true, platform: 'android' })).toBe(false)
  })

  it('does not ask again once an answer is on record', () => {
    expect(shouldAskForPush({ ...fresh, asked: true, undetermined: false })).toBe(false)
  })
})

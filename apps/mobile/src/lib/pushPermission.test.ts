import { describe, expect, it } from 'vitest'
import {
  pushGuideStatus,
  pushSwitchAction,
  pushSwitchIsOn,
  shouldAskForPush,
} from './pushPermission'

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

describe('what the switch in Settings reads', () => {
  it('is off on a phone the OS has granted nothing, however the flag reads', () => {
    expect(pushSwitchIsOn({ granted: false, offOnThisDevice: false, platform: 'ios' })).toBe(false)
  })

  it('is on only when both agree', () => {
    expect(pushSwitchIsOn({ granted: true, offOnThisDevice: false, platform: 'ios' })).toBe(true)
    expect(pushSwitchIsOn({ granted: true, offOnThisDevice: true, platform: 'ios' })).toBe(false)
  })

  /** No push on the web at all, so there is no permission to reflect. */
  it('keeps meaning the flag alone on web', () => {
    expect(pushSwitchIsOn({ granted: false, offOnThisDevice: false, platform: 'web' })).toBe(true)
    expect(pushSwitchIsOn({ granted: false, offOnThisDevice: true, platform: 'web' })).toBe(false)
  })
})

describe('what turning that switch on has to do', () => {
  /** A phone with permission and no device row is the failure this is for. */
  it('registers the token when permission is already granted', () => {
    expect(pushSwitchAction({ granted: true, canAskAgain: true, platform: 'ios' })).toBe('register')
  })

  it('raises the dialog when the OS will still show one', () => {
    expect(pushSwitchAction({ granted: false, canAskAgain: true, platform: 'ios' })).toBe('ask')
  })

  /** Somebody who tapped this switch gets an answer, not a switch that springs back. */
  it('sends them to the OS settings when it will not', () => {
    expect(pushSwitchAction({ granted: false, canAskAgain: false, platform: 'ios' })).toBe(
      'openSettings',
    )
  })

  it('does nothing on web', () => {
    expect(pushSwitchAction({ granted: false, canAskAgain: true, platform: 'web' })).toBe('none')
  })
})

describe('what the guide screen says', () => {
  const native = { granted: false, canAskAgain: true, offOnThisDevice: false, platform: 'ios' }

  it('offers the dialog while the OS will still show one', () => {
    expect(pushGuideStatus(native)).toBe('askable')
  })

  /** The one state the app cannot fix from the inside. */
  it('sends them to the Settings app once it will not', () => {
    expect(pushGuideStatus({ ...native, canAskAgain: false })).toBe('blocked')
  })

  it('says so when everything is on', () => {
    expect(pushGuideStatus({ ...native, granted: true })).toBe('granted')
  })

  /**
   * Permission granted and our own switch off: nothing for the Settings app to
   * do, and "notifications are on" would be a lie to somebody receiving none.
   */
  it('separates a phone silenced in LangX from one the OS refused', () => {
    expect(pushGuideStatus({ ...native, granted: true, offOnThisDevice: true })).toBe('silenced')
  })

  it('answers web before it looks at anything else', () => {
    expect(pushGuideStatus({ ...native, platform: 'web' })).toBe('web')
    expect(pushGuideStatus({ ...native, granted: true, platform: 'web' })).toBe('web')
  })
})

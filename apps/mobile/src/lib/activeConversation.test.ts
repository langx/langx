import { afterEach, describe, expect, it } from 'vitest'
import {
  getActiveConversation,
  resetActiveConversationForTest,
  setActiveConversation,
} from './activeConversation'

describe('the conversation on screen', () => {
  afterEach(() => {
    resetActiveConversationForTest()
  })

  it('is nothing until a thread says otherwise', () => {
    expect(getActiveConversation()).toBeNull()
  })

  it('remembers the last thread focused', () => {
    setActiveConversation('c1')
    expect(getActiveConversation()).toBe('c1')
  })

  /**
   * The blur half of `useFocusEffect`. Without it the app believes a thread is
   * still being read after the user leaves it — this screen is a hidden tab
   * route and never unmounts.
   */
  it('clears when the thread is left', () => {
    setActiveConversation('c1')
    setActiveConversation(null)
    expect(getActiveConversation()).toBeNull()
  })
})

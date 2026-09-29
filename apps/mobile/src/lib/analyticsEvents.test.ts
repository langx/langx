import { describe, expect, it } from 'vitest'
import {
  FORBIDDEN_PROPERTY_KEYS,
  sanitizeEventProperties,
  type AnalyticsEvent,
} from './analyticsEvents'

describe('sanitizeEventProperties', () => {
  it('keeps primitives and null, and nothing else', () => {
    expect(
      sanitizeEventProperties({
        kind: 'text',
        reply: false,
        count: 3,
        feature: null,
        nested: { a: 1 },
        list: [1, 2],
        fn: () => 1,
        missing: undefined,
        nan: Number.NaN,
      }),
    ).toEqual({ kind: 'text', reply: false, count: 3, feature: null })
  })

  /**
   * The store declaration says bodies and personal details never reach
   * analytics. A spread of the wrong object is the way that promise would be
   * broken by accident, so the keys such an object would carry are dropped.
   */
  it('drops every forbidden key', () => {
    const properties: Record<string, unknown> = { kind: 'text' }
    for (const key of FORBIDDEN_PROPERTY_KEYS) properties[key] = 'leaked'
    expect(sanitizeEventProperties(properties)).toEqual({ kind: 'text' })
  })

  it('cuts a string that is far longer than any legitimate value', () => {
    const clean = sanitizeEventProperties({ note: 'x'.repeat(1000) })
    expect(clean.note).toHaveLength(200)
  })
})

/**
 * Every event, with the properties its call site sends, put through the
 * sanitizer.
 *
 * The union already stops a *declared* forbidden key at compile time. This is
 * the other half: a property whose name is fine to a reader but forbidden to
 * the store declaration — a `handle` on the onboarding events, an `email` on
 * the sign-up ones — would be silently dropped on the way out, and the event
 * would arrive missing the thing it was added for. Comparing the round trip
 * to the input is what makes that loud.
 */
describe('every event survives the sanitizer', () => {
  const events: AnalyticsEvent[] = [
    { name: 'welcome_chosen', properties: { choice: 'create' } },
    { name: 'signup_submitted', properties: { method: 'email', from_guest: false } },
    { name: 'signup_verified', properties: { method: 'email' } },
    { name: 'guest_gate_hit', properties: { action: 'message' } },
    {
      name: 'onboarding_step_completed',
      properties: { step: 'levels', guest: false, resumed: true },
    },
    {
      name: 'onboarding_completed',
      properties: {
        referred: false,
        native_languages: 1,
        learning_languages: 2,
        method: 'google',
        from_guest: true,
        seconds_since_install: 214,
      },
    },
    { name: 'message_sent', properties: { kind: 'text', reply: false } },
    {
      name: 'paywall_viewed',
      properties: { feature: null, tier: 'free', source: 'onboarding', gift: false },
    },
    { name: 'paywall_dismissed', properties: { source: 'onboarding', seconds_open: 4 } },
    {
      name: 'purchase_started',
      properties: {
        offer: 'langx_fluent_yearly',
        tier: 'pro',
        period: 'yearly',
        change: 'buy',
        trial_days: 7,
      },
    },
    {
      name: 'purchase_finished',
      properties: {
        offer: 'langx_fluent_yearly',
        tier: 'pro',
        period: 'yearly',
        change: 'buy',
        trial_days: 7,
        outcome: 'purchased',
      },
    },
    { name: 'gift_code_redeemed', properties: { outcome: 'granted', months: 3 } },
    { name: 'gift_code_redeemed', properties: { outcome: 'rate_limited', months: null } },
    { name: 'review_prompted', properties: { trigger: 'correction' } },
    { name: 'boosted_strip_shown', properties: { count: 4 } },
    { name: 'boosted_strip_tapped', properties: { slot: 0 } },
    { name: 'discovery_card_tapped', properties: { slot: 17 } },
    { name: 'message_received', properties: { kind: 'audio' } },
    { name: 'message_send_failed', properties: { kind: 'media', reason: 'MEDIA_TOO_LARGE' } },
    { name: 'notification_opened', properties: { kind: 'streakReminder', cold_start: true } },
    { name: 'push_registration_failed', properties: { step: 'token', reason: 'Error' } },
    { name: 'filters_applied', properties: { count: 3, pro: true } },
    { name: 'tokens_spent', properties: { sku: 'frame_gold', kind: 'frame', amount: 250 } },
    { name: 'recap_story_viewed', properties: { slides_seen: 4, completed: false } },
    { name: 'echo_ask_opened', properties: { kind: 'pronunciation', entry: 'cards' } },
    {
      name: 'post_created',
      properties: { asks: 'none', media: 2, hasText: false, from: 'feed' },
    },
    { name: 'feed_card_opened', properties: { position: 4, asks: 'both' } },
    { name: 'pro_welcome_shown', properties: { source: 'gift', months: 3 } },
    { name: 'pro_welcome_closed', properties: { source: 'trial', action: 'start' } },
    { name: 'langx_poll_answered', properties: { poll_id: 'launch-poll', option_id: 'yes' } },
    { name: 'langx_card_tapped', properties: { action: 'openRoute' } },
    {
      name: 'share_card_created',
      properties: { kind: 'streak', shape: 'story', link_only: false, failed: false },
    },
    {
      name: 'share_card_created',
      properties: { kind: 'badge', shape: null, link_only: true, failed: false },
    },
    { name: 'fair_use_limit_hit', properties: { kind: 'media' } },
  ]

  for (const event of events) {
    it(`${event.name} keeps every property`, () => {
      expect(sanitizeEventProperties(event.properties)).toEqual(event.properties)
    })
  }
})

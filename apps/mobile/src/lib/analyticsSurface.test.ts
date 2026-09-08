import { describe, expect, it } from 'vitest'
import { stampSurface, surfaceName } from './analyticsEvents'

describe('surfaceName', () => {
  it('names every platform as an app build, never as a website', () => {
    // The website repositories stamp 'website' and 'token-website' into this
    // same PostHog project; nothing here may collide with those.
    expect(surfaceName('ios')).toBe('app-ios')
    expect(surfaceName('android')).toBe('app-android')
    expect(surfaceName('web')).toBe('app-web')
  })
})

describe('stampSurface', () => {
  it('adds the surface without dropping the properties already there', () => {
    const event = { event: 'message_sent', properties: { kind: 'text' } }
    expect(stampSurface(event, 'app-ios').properties).toEqual({
      kind: 'text',
      langx_surface: 'app-ios',
    })
  })

  it('builds a properties object when the event arrived without one', () => {
    // The trap this function exists for: `properties` is optional on the SDK's
    // CaptureEvent, so assigning into it would throw on a lifecycle event.
    const event: { event: string; properties?: Record<string, unknown> } = {
      event: 'Application Opened',
    }
    expect(stampSurface(event, 'app-android').properties).toEqual({
      langx_surface: 'app-android',
    })
  })

  it('passes null through, because before_send may be handed one', () => {
    expect(stampSurface(null, 'app-web')).toBeNull()
  })
})

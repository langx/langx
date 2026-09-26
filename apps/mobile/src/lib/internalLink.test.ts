import { inviteUrl, postUrl, profileUrl } from '@langx/shared'
import { describe, expect, it } from 'vitest'
import { internalTarget } from './internalLink'

const POST_ID = '66f1c2a4b5d6e7f8a9b0c1d2'

describe('internalTarget', () => {
  it('reads the links the app itself writes', () => {
    expect(internalTarget(profileUrl('deniz'))).toEqual({ kind: 'profile', handle: 'deniz' })
    expect(internalTarget(inviteUrl('deniz'))).toEqual({ kind: 'profile', handle: 'deniz' })
    expect(internalTarget(postUrl(POST_ID))).toEqual({ kind: 'post', id: POST_ID })
  })

  it('reads a profile from the web address bar, and one typed in capitals', () => {
    expect(internalTarget('https://app.langx.io/profile/deniz?from=%2F')).toEqual({
      kind: 'profile',
      handle: 'deniz',
    })
    expect(internalTarget('https://App.LangX.io/Deniz')).toEqual({
      kind: 'profile',
      handle: 'deniz',
    })
  })

  it('treats a trailing slash, a query and a fragment as the same page', () => {
    for (const href of [
      'https://app.langx.io/deniz/',
      'https://app.langx.io/deniz?utm=x',
      'https://app.langx.io/deniz#top',
      'http://app.langx.io/deniz',
    ]) {
      expect(internalTarget(href)).toEqual({ kind: 'profile', handle: 'deniz' })
    }
  })

  it('does not take a screen for a person', () => {
    for (const route of ['chats', 'discover', 'settings', 'post', 'profile']) {
      expect(internalTarget(`https://app.langx.io/${route}`)).toBeNull()
    }
  })

  it('still reads the official accounts, which live under reserved names', () => {
    expect(internalTarget(profileUrl('langx'))).toEqual({ kind: 'profile', handle: 'langx' })
  })

  it('opens nothing it cannot name', () => {
    for (const href of [
      'https://app.langx.io/',
      'https://app.langx.io',
      'https://app.langx.io/deniz/photos',
      'https://app.langx.io/post/not-an-id',
      'https://app.langx.io/magic-link?token=x',
      'https://app.langx.io//deniz',
    ]) {
      expect(internalTarget(href)).toBeNull()
    }
  })

  it('does not trust another host that only starts like ours', () => {
    for (const href of [
      'https://app.langx.io.evil.example/deniz',
      'https://app.langx.io@evil.example/deniz',
      'https://evil.example/deniz',
      'https://langx.io/deniz',
    ]) {
      expect(internalTarget(href)).toBeNull()
    }
  })
})

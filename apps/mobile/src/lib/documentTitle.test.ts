import { describe, expect, it } from 'vitest'
import { createTranslate } from '../i18n/runtime'
import { documentTitle, pageTitleKey } from './documentTitle'

describe('documentTitle', () => {
  it('names the page, then the app', () => {
    expect(documentTitle('Chats', undefined)).toBe('Chats · LangX')
  })

  it('is the app alone on a page with no name', () => {
    expect(documentTitle(undefined, undefined)).toBe('LangX')
    expect(documentTitle('  ', undefined)).toBe('LangX')
  })

  /** Leading, so a narrow tab still shows the part worth seeing. */
  it('puts the unread count first, in brackets', () => {
    expect(documentTitle('Kula', 3)).toBe('(3) Kula · LangX')
    expect(documentTitle(undefined, 1)).toBe('(1) LangX')
  })

  it('says nothing about zero', () => {
    expect(documentTitle('Chats', 0)).toBe('Chats · LangX')
  })

  it('caps the count the way the Chats tab badge does', () => {
    expect(documentTitle('Chats', 1482)).toBe('(99+) Chats · LangX')
  })

  it('does not repeat the name of the @langx channel', () => {
    expect(documentTitle('LangX', 2)).toBe('(2) LangX')
  })
})

describe('pageTitleKey', () => {
  const t = createTranslate('en')

  it('names the tabs by the words under their icons', () => {
    expect(pageTitleKey('/chats')).toBe('tabs.chats')
    expect(pageTitleKey('/discover')).toBe('tabs.discover')
  })

  it('names a page nested under another', () => {
    expect(pageTitleKey('/settings/privacy')).toBe('settings.privacySection')
    expect(t(pageTitleKey('/wallet/store') ?? 'tabs.me')).toBe('Store')
  })

  it('ignores a trailing slash', () => {
    expect(pageTitleKey('/settings/')).toBe('settings.title')
  })

  it('falls back to a generic name on a page named after somebody', () => {
    expect(pageTitleKey('/chat/66f1a2b3c4d5e6f708192a3b')).toBe('chat.title')
  })

  it('leaves a page it does not know to the app name', () => {
    expect(pageTitleKey('/')).toBeUndefined()
    expect(pageTitleKey('/about-you')).toBeUndefined()
  })
})

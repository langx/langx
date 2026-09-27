import { describe, expect, it } from 'vitest'
import { acceptsSends, pickableConversations, type PickerPartner } from './conversationPicker'

const row = (id: string, partner: PickerPartner | undefined) => ({ id, partner })

const rows = [
  row('ada', { displayName: 'Ada Lovelace', handle: 'ada' }),
  row('jose', { displayName: 'José', handle: 'jose_m' }),
  row('langx', { displayName: 'LangX', handle: 'langx', official: true }),
  row('gone', { displayName: 'Gone', handle: 'gone', accountStatus: 'deleted' }),
  row('held', { displayName: 'Held', handle: 'held', accountStatus: 'suspended' }),
  row('pending', undefined),
]

const ids = (query: string) => pickableConversations(rows, query).map((r) => r.id)

describe('pickableConversations', () => {
  it('leaves out every thread a send would be refused in', () => {
    expect(ids('')).toEqual(['ada', 'jose', 'pending'])
  })

  it('finds by name or by handle, with or without the @', () => {
    expect(ids('love')).toEqual(['ada'])
    expect(ids('@jose_')).toEqual(['jose'])
    expect(ids('  ADA ')).toEqual(['ada'])
  })

  it('ignores accents in either direction', () => {
    expect(ids('jose')).toEqual(['jose'])
    expect(ids('josé')).toEqual(['jose'])
  })

  it('never offers a channel, even when it is what was typed', () => {
    expect(ids('langx')).toEqual([])
  })
})

describe('acceptsSends', () => {
  it('lets a person through, and an official account nobody has listed', () => {
    expect(acceptsSends({ displayName: 'A' })).toBe(true)
    expect(acceptsSends({ displayName: 'New', handle: 'newbot', official: true })).toBe(true)
  })
})

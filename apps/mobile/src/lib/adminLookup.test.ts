import { describe, expect, it } from 'vitest'
import { adminLookupKey, adminLookupState } from './adminLookup'

describe('adminLookupKey', () => {
  it('drops the @ and the spaces, and keeps the case for the server to fold', () => {
    expect(adminLookupKey(' @Sofia ')).toBe('Sofia')
    expect(adminLookupKey('@ sofia')).toBe('sofia')
    expect(adminLookupKey('Sofia@Example.com')).toBe('Sofia@Example.com')
  })
})

describe('adminLookupState', () => {
  const settled = { typed: '@anna', lookup: 'anna', hasData: false, isFetching: false }

  it('is idle under two characters', () => {
    expect(adminLookupState({ ...settled, typed: '@a', lookup: 'a', error: null })).toBe('idle')
  })

  it('is searching while the typing has not settled, whatever the old answer was', () => {
    const notFound = { status: 404 }
    expect(adminLookupState({ ...settled, typed: '@ann', error: notFound })).toBe('searching')
    expect(adminLookupState({ ...settled, typed: '@annab', hasData: true, error: null })).toBe(
      'searching',
    )
  })

  it('is searching while the request is out', () => {
    expect(adminLookupState({ ...settled, isFetching: true, error: null })).toBe('searching')
  })

  it('keeps a found account on screen while it refetches after a toggle', () => {
    expect(adminLookupState({ ...settled, hasData: true, isFetching: true, error: null })).toBe(
      'found',
    )
  })

  it('says not found only for a 404', () => {
    expect(adminLookupState({ ...settled, error: { status: 404 } })).toBe('notFound')
    expect(adminLookupState({ ...settled, error: { status: 500 } })).toBe('error')
    expect(adminLookupState({ ...settled, error: new TypeError('Failed to fetch') })).toBe('error')
  })
})

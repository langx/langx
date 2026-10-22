import { describe, expect, it } from 'vitest'
import { markJustPosted, takeJustPosted } from './justPosted'

describe('justPosted', () => {
  it('hands the post over once', () => {
    markJustPosted('p1')
    expect(takeJustPosted()).toBe('p1')
    expect(takeJustPosted()).toBeNull()
  })

  it('keeps only the latest post', () => {
    markJustPosted('p1')
    markJustPosted('p2')
    expect(takeJustPosted()).toBe('p2')
    expect(takeJustPosted()).toBeNull()
  })

  it('is null when nothing was posted', () => {
    expect(takeJustPosted()).toBeNull()
  })
})

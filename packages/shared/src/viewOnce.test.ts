import { describe, expect, it } from 'vitest'
import { sendMediaMessageSchema } from './chat'
import type { Media } from './media'
import { viewOnceMaxOpens, viewOnceState } from './viewOnce'

const photo: Media = {
  url: 'https://cdn.example.com/messages/c/a.jpg',
  contentType: 'image/jpeg',
  sizeBytes: 1024,
}
const clip: Media = {
  url: 'https://cdn.example.com/messages/c/b.mp4',
  contentType: 'video/mp4',
  sizeBytes: 4096,
  durationSeconds: 12,
}
const note: Media = {
  url: 'https://cdn.example.com/messages/c/c.m4a',
  contentType: 'audio/mp4',
  sizeBytes: 2048,
  durationSeconds: 3,
}

function send(extra: Record<string, unknown>) {
  return sendMediaMessageSchema.safeParse({ conversationId: 'c', ...extra })
}

describe('view-once sends', () => {
  it('takes one photo or one video', () => {
    expect(send({ attachments: [photo], viewOnce: { replay: false } }).success).toBe(true)
    expect(send({ attachments: [clip], viewOnce: { replay: true } }).success).toBe(true)
  })

  it('refuses two files, a voice note, a caption and an answer', () => {
    expect(send({ attachments: [photo, photo], viewOnce: { replay: false } }).success).toBe(false)
    expect(send({ attachments: [note], viewOnce: { replay: false } }).success).toBe(false)
    expect(send({ attachments: [photo], body: 'look', viewOnce: { replay: false } }).success).toBe(
      false,
    )
    expect(
      send({ attachments: [photo], answersMessageId: 'm', viewOnce: { replay: false } }).success,
    ).toBe(false)
  })

  it('leaves an ordinary send alone', () => {
    expect(send({ attachments: [photo, clip], body: 'two' }).success).toBe(true)
  })
})

describe('viewOnceState', () => {
  it('walks unopened → opened → gone for a replay', () => {
    const max = viewOnceMaxOpens(true)
    expect(max).toBe(2)
    expect(viewOnceState({ opens: 0, opensLeft: 2 })).toBe('unopened')
    expect(viewOnceState({ opens: 1, opensLeft: 1 })).toBe('opened')
    expect(viewOnceState({ opens: 2, opensLeft: 0 })).toBe('gone')
  })

  it('goes straight to gone for view once', () => {
    expect(viewOnceMaxOpens(false)).toBe(1)
    expect(viewOnceState({ opens: 1, opensLeft: 0 })).toBe('gone')
  })
})

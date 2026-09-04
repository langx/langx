import { describe, expect, it } from 'vitest'
import { sendMediaMessageSchema } from './chat'
import { createPostSchema } from './feed'
import {
  MAX_ATTACHMENTS,
  attachmentKindsValid,
  attachmentsOf,
  mediaKindOfContentType,
  type Media,
} from './media'

const image: Media = {
  url: 'https://cdn.example.com/messages/x/a.jpg',
  contentType: 'image/jpeg',
  sizeBytes: 1024,
  width: 800,
  height: 600,
}
const video: Media = {
  url: 'https://cdn.example.com/messages/x/a.mp4',
  contentType: 'video/mp4',
  sizeBytes: 4 * 1024 * 1024,
  durationSeconds: 30,
  width: 1280,
  height: 720,
}
const voice: Media = {
  url: 'https://cdn.example.com/messages/x/a.m4a',
  contentType: 'audio/m4a',
  sizeBytes: 2048,
  durationSeconds: 7,
}

describe('mediaKindOfContentType', () => {
  it('knows the two containers a phone actually produces', () => {
    expect(mediaKindOfContentType('video/mp4')).toBe('video')
    expect(mediaKindOfContentType('video/quicktime')).toBe('video')
  })

  it('refuses a container iOS cannot decode', () => {
    // Accepting webm would store files half the recipients cannot open.
    expect(mediaKindOfContentType('video/webm')).toBeNull()
  })

  it('still answers for images and audio', () => {
    expect(mediaKindOfContentType('image/png')).toBe('image')
    expect(mediaKindOfContentType('audio/m4a')).toBe('audio')
    expect(mediaKindOfContentType('application/pdf')).toBeNull()
  })
})

describe('attachmentsOf', () => {
  it('reads a row written before the field existed', () => {
    expect(attachmentsOf({ media: image })).toEqual([image])
  })

  it('prefers the many-attachment field when both are there', () => {
    // New writes fill both; `media` is only the first item, repeated.
    expect(attachmentsOf({ attachments: [image, video], media: image })).toEqual([image, video])
  })

  it('is empty for a message with no attachment at all', () => {
    expect(attachmentsOf({})).toEqual([])
  })
})

describe('attachmentKindsValid', () => {
  it('lets photos and videos travel together', () => {
    expect(attachmentKindsValid([image, video])).toBe('ok')
  })

  it('does not send a voice note alongside a picture', () => {
    expect(attachmentKindsValid([voice])).toBe('ok')
    expect(attachmentKindsValid([image, voice])).toBe('audio-must-be-alone')
    expect(attachmentKindsValid([voice, video])).toBe('audio-must-be-alone')
  })

  it('lets a pronunciation answer carry its two takes', () => {
    // The fast take and the deliberate slow one are one message, not two.
    expect(attachmentKindsValid([voice, { ...voice, url: `${voice.url}-slow` }])).toBe('ok')
  })
})

describe('sendMediaMessageSchema', () => {
  const conversationId = 'c1'

  it('accepts the one-attachment body an installed build still sends', () => {
    const parsed = sendMediaMessageSchema.parse({ conversationId, kind: 'image', media: image })
    expect(parsed).toEqual({ conversationId, attachments: [image] })
  })

  it('accepts a gallery', () => {
    const parsed = sendMediaMessageSchema.parse({
      conversationId,
      attachments: [image, video],
      body: 'look',
    })
    expect(parsed.attachments).toHaveLength(2)
  })

  it('refuses more than the ceiling', () => {
    const tooMany = Array.from({ length: MAX_ATTACHMENTS + 1 }, () => image)
    expect(() => sendMediaMessageSchema.parse({ conversationId, attachments: tooMany })).toThrow()
  })

  it('refuses an empty attachment list rather than writing a blank message', () => {
    expect(() => sendMediaMessageSchema.parse({ conversationId, attachments: [] })).toThrow()
  })
})

describe('createPostSchema', () => {
  it('rewrites a legacy single attachment the same way chat does', () => {
    const parsed = createPostSchema.parse({ body: 'hi', language: 'en', media: image })
    expect(parsed.attachments).toEqual([image])
  })

  it('takes a gallery on a post', () => {
    const parsed = createPostSchema.parse({
      body: 'hi',
      language: 'en',
      attachments: [image, video],
    })
    expect(parsed.attachments).toHaveLength(2)
  })
})

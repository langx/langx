import { describe, expect, it, vi } from 'vitest'

const send = vi.fn().mockResolvedValue({ data: { id: 'e1' }, error: null })
const batchSend = vi.fn().mockResolvedValue({ data: { data: [] }, error: null })

vi.mock('resend', () => ({
  Resend: class {
    emails = { send }
    batch = { send: batchSend }
  },
}))

const {
  ConsoleEmailSender,
  EmailRejectedError,
  ResendEmailSender,
  createEmailSender,
  isUndeliverableAddress,
} = await import('./sender')
const { LOGO_SRC, inlineSrc } = await import('./logo')

const withLogo = (to: string) => ({
  to,
  subject: 's',
  html: `<img src="${LOGO_SRC}" /><p>hi</p>`,
  text: 'hi',
})
const plain = (to: string) => ({ to, subject: 's', html: '<p>hi</p>', text: 'hi' })

describe('the Resend sender and the logo', () => {
  const sender = new ResendEmailSender('re_test', 'LangX <hi@langx.io>')

  it('attaches the logo inline when the body shows it, and not otherwise', async () => {
    await sender.send(withLogo('a@example.com'))
    expect(send).toHaveBeenLastCalledWith(
      expect.objectContaining({
        to: 'a@example.com',
        attachments: [
          expect.objectContaining({ contentId: 'langx-logo', contentType: 'image/png' }),
        ],
      }),
    )
    const [payload] = send.mock.lastCall as [{ attachments: { content: Buffer }[] }]
    const attached = payload.attachments[0]?.content
    // A PNG, not an empty buffer or a base64 string somebody forgot to decode.
    expect(attached?.subarray(1, 4).toString()).toBe('PNG')

    await sender.send(plain('b@example.com'))
    expect(send.mock.lastCall?.[0]).not.toHaveProperty('attachments')
  })

  it('attaches every inline image the body shows, and only those', async () => {
    await sender.send({
      to: 'c@example.com',
      subject: 's',
      html: `<img src="${LOGO_SRC}" /><img src="${inlineSrc('langx-qr-get-langx-io')}" />`,
      text: 'hi',
    })
    const [payload] = send.mock.lastCall as [{ attachments: { contentId: string }[] }]
    expect(payload.attachments.map((a) => a.contentId).sort()).toEqual([
      'langx-logo',
      'langx-qr-get-langx-io',
    ])
  })

  /** The batch endpoint takes no attachments, so a logo forces one request per person. */
  it('sends a batch one by one when the logo is in it', async () => {
    send.mockClear()
    batchSend.mockClear()
    vi.useFakeTimers()
    const pending = sender.sendBatch([withLogo('a@example.com'), withLogo('b@example.com')])
    await vi.runAllTimersAsync()
    await pending
    vi.useRealTimers()
    expect(batchSend).not.toHaveBeenCalled()
    expect(send).toHaveBeenCalledTimes(2)

    await sender.sendBatch([plain('a@example.com'), plain('b@example.com')])
    expect(batchSend).toHaveBeenCalledTimes(1)
  })

  it('tells a rejected message apart from a service that is down', async () => {
    send.mockResolvedValueOnce({
      data: null,
      error: { name: 'validation_error', message: 'Invalid `to` field', statusCode: 422 },
    })
    await expect(sender.send(plain('bad@test.com1'))).rejects.toBeInstanceOf(EmailRejectedError)

    send.mockResolvedValueOnce({
      data: null,
      error: { name: 'rate_limit_exceeded', message: 'Too many requests', statusCode: 429 },
    })
    const outage = sender.send(plain('c@example.com'))
    await expect(outage).rejects.toThrow('Too many requests')
    await expect(outage).rejects.not.toBeInstanceOf(EmailRejectedError)
  })
})

describe('addresses that can never be delivered', () => {
  const warn = vi.fn()
  const sender = new ResendEmailSender('re_test', 'LangX <hi@langx.io>', { warn })

  it('knows the reserved TLD from a domain that merely contains the word', () => {
    expect(isUndeliverableAddress('test_katya@test.langx.invalid')).toBe(true)
    expect(isUndeliverableAddress('bootstrap-warmup@internal.langx.invalid')).toBe(true)
    expect(isUndeliverableAddress('a@GUEST.LANGX.INVALID')).toBe(true)
    expect(isUndeliverableAddress(' a@x.invalid ')).toBe(true)
    // Not the TLD: a real domain may be spelt this way and must still be sent.
    expect(isUndeliverableAddress('a@invalid.com')).toBe(false)
    expect(isUndeliverableAddress('a@invalid.example.org')).toBe(false)
    expect(isUndeliverableAddress('invalid@example.com')).toBe(false)
  })

  it('does not hand one to the provider, and does not throw', async () => {
    send.mockClear()
    warn.mockClear()
    await expect(sender.send(plain('test_anna@test.langx.invalid'))).resolves.toBeUndefined()
    expect(send).not.toHaveBeenCalled()
    expect(warn).toHaveBeenCalledTimes(1)
  })

  it('drops them out of a batch and still sends the rest', async () => {
    send.mockClear()
    batchSend.mockClear()
    await sender.sendBatch([
      plain('a@example.com'),
      plain('test_yuki@test.langx.invalid'),
      plain('b@example.com'),
    ])
    expect(batchSend).toHaveBeenCalledTimes(1)
    const [[batch]] = batchSend.mock.calls as [[{ to: string }[]]]
    expect(batch.map((message) => message.to)).toEqual(['a@example.com', 'b@example.com'])
  })

  it('makes no request at all when a batch is nothing but these', async () => {
    send.mockClear()
    batchSend.mockClear()
    await sender.sendBatch([plain('test_pavel@test.langx.invalid')])
    expect(batchSend).not.toHaveBeenCalled()
    expect(send).not.toHaveBeenCalled()
  })
})

describe('which sender a process gets', () => {
  const env = (over: Record<string, unknown>) =>
    ({ EMAIL_FROM: 'LangX <hi@langx.io>', ...over }) as unknown as Parameters<
      typeof createEmailSender
    >[0]

  it('sends only from production, even with a key in hand', () => {
    const warn = vi.fn()
    expect(
      createEmailSender(env({ NODE_ENV: 'production', RESEND_API_KEY: 're_test' }), { warn }),
    ).toBeInstanceOf(ResendEmailSender)
    expect(
      createEmailSender(env({ NODE_ENV: 'development', RESEND_API_KEY: 're_test' }), { warn }),
    ).toBeInstanceOf(ConsoleEmailSender)
    expect(
      createEmailSender(env({ NODE_ENV: 'test', RESEND_API_KEY: 're_test' }), { warn }),
    ).toBeInstanceOf(ConsoleEmailSender)
    expect(createEmailSender(env({ NODE_ENV: 'production' }), { warn })).toBeInstanceOf(
      ConsoleEmailSender,
    )
  })

  it('says which of the two reasons kept the mail in the log', async () => {
    const warn = vi.fn()
    await createEmailSender(env({ NODE_ENV: 'development', RESEND_API_KEY: 're_test' }), {
      warn,
    }).send(plain('a@example.com'))
    expect(warn.mock.calls[0]?.[1]).toContain('NODE_ENV')

    warn.mockClear()
    await createEmailSender(env({ NODE_ENV: 'production' }), { warn }).send(plain('a@example.com'))
    expect(warn.mock.calls[0]?.[1]).toContain('RESEND_API_KEY not set')
  })
})

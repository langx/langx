import { describe, expect, it, vi } from 'vitest'

const send = vi.fn().mockResolvedValue({ data: { id: 'e1' }, error: null })
const batchSend = vi.fn().mockResolvedValue({ data: { data: [] }, error: null })

vi.mock('resend', () => ({
  Resend: class {
    emails = { send }
    batch = { send: batchSend }
  },
}))

const { ResendEmailSender } = await import('./sender')
const { LOGO_CID, LOGO_SRC } = await import('./logo')

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
        attachments: [expect.objectContaining({ contentId: LOGO_CID, contentType: 'image/png' })],
      }),
    )
    const [payload] = send.mock.lastCall as [{ attachments: { content: Buffer }[] }]
    const attached = payload.attachments[0]?.content
    // A PNG, not an empty buffer or a base64 string somebody forgot to decode.
    expect(attached?.subarray(1, 4).toString()).toBe('PNG')

    await sender.send(plain('b@example.com'))
    expect(send.mock.lastCall?.[0]).not.toHaveProperty('attachments')
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
})

import { describe, expect, it, vi } from 'vitest'
import { createAnalyticsCore, type AnalyticsClient } from './analyticsCore'

function fakeClient() {
  const calls: string[] = []
  let distinctId = 'anon-1'
  const client: AnalyticsClient = {
    capture: (event, properties) => {
      calls.push(`capture:${event}:${JSON.stringify(properties)}`)
    },
    screen: (name) => {
      calls.push(`screen:${name}`)
    },
    identify: (id) => {
      distinctId = id
      calls.push(`identify:${id}`)
    },
    getDistinctId: () => distinctId,
    reset: () => {
      distinctId = 'anon-2'
      calls.push('reset')
    },
    optIn: () => {
      calls.push('optIn')
    },
    optOut: () => {
      calls.push('optOut')
    },
  }
  return { calls, client }
}

function deferred<T>() {
  let resolve!: (value: T) => void
  const promise = new Promise<T>((r) => {
    resolve = r
  })
  return { promise, resolve }
}

function setup(optOut = false) {
  const fake = fakeClient()
  const loadClient = vi.fn(() => Promise.resolve(fake.client))
  const writeOptOut = vi.fn(() => Promise.resolve())
  const core = createAnalyticsCore({
    loadClient,
    readOptOut: () => Promise.resolve(optOut),
    writeOptOut,
  })
  return { ...fake, loadClient, writeOptOut, core }
}

describe('createAnalyticsCore', () => {
  /**
   * The first screen of a launch is captured before the stored answer has
   * come back. It must neither be lost nor sent early.
   */
  it('queues calls made before the flag is read, then replays them in order', async () => {
    const { core, calls, loadClient } = setup()
    core.screen('index')
    core.identify('user-1')
    core.track({ name: 'message_sent', properties: { kind: 'text', reply: false } })
    expect(calls).toEqual([])
    expect(loadClient).not.toHaveBeenCalled()

    await core.start()
    expect(calls).toEqual([
      'screen:index',
      'identify:user-1',
      'capture:message_sent:{"kind":"text","reply":false}',
    ])
  })

  it('drops everything, and never loads the SDK, when the stored answer is no', async () => {
    const { core, calls, loadClient } = setup(true)
    core.screen('index')
    await core.start()
    core.screen('(app)/discover')
    expect(calls).toEqual([])
    expect(loadClient).not.toHaveBeenCalled()
    expect(core.isEnabled()).toBe(false)
  })

  it('does not send a second identify for an id the client already carries', async () => {
    const { core, calls } = setup()
    await core.start()
    core.identify('user-1')
    core.identify('user-1')
    expect(calls).toEqual(['identify:user-1'])
  })

  /**
   * A signed-out launch calls `forget` like a sign-out does. Resetting there
   * would give the install a new anonymous id on every cold start and cut it
   * off from the sign-up that follows.
   */
  it('resets only after somebody was identified', async () => {
    const { core, calls } = setup()
    await core.start()
    core.forget()
    expect(calls).toEqual([])
    core.identify('user-1')
    core.forget()
    expect(calls).toEqual(['identify:user-1', 'reset'])
  })

  it('opting out resets, opts the client out and drops what follows', async () => {
    const { core, calls, writeOptOut } = setup()
    await core.start()
    core.identify('user-1')
    await core.setEnabled(false)
    expect(writeOptOut).toHaveBeenCalledWith(true)
    expect(calls).toEqual(['identify:user-1', 'reset', 'optOut'])
    core.screen('(app)/discover')
    core.track({ name: 'message_sent', properties: { kind: 'text', reply: false } })
    expect(calls).toHaveLength(3)
    expect(core.isEnabled()).toBe(false)
  })

  it('opting back in opts the client in and re-identifies the signed-in account', async () => {
    const { core, calls, writeOptOut, loadClient } = setup(true)
    await core.start()
    core.identify('user-1')
    await core.setEnabled(true)
    expect(writeOptOut).toHaveBeenCalledWith(false)
    expect(loadClient).toHaveBeenCalledTimes(1)
    expect(calls).toEqual(['optIn', 'identify:user-1'])
    core.screen('(app)/settings')
    expect(calls).toContain('screen:(app)/settings')
  })

  /**
   * The switch can be flipped while the boot read is still in flight. The
   * flip has to win, or the stale answer arriving a moment later would undo
   * a refusal that was just made.
   */
  it('a toggle during the boot read is applied after it, not lost under it', async () => {
    const fake = fakeClient()
    const read = deferred<boolean>()
    const core = createAnalyticsCore({
      loadClient: () => Promise.resolve(fake.client),
      readOptOut: () => read.promise,
      writeOptOut: () => Promise.resolve(),
    })
    void core.start()
    const toggled = core.setEnabled(false)
    core.screen('index')
    read.resolve(false)
    await toggled
    expect(core.isEnabled()).toBe(false)
    // The queued screen was replayed while still opted in, then the refusal
    // took the client away.
    expect(fake.calls).toEqual(['screen:index', 'reset', 'optOut'])
  })

  it('tells subscribers when the answer changes, and when it is first read', async () => {
    const { core } = setup()
    const listener = vi.fn()
    core.subscribe(listener)
    expect(core.isSettled()).toBe(false)
    await core.start()
    expect(core.isSettled()).toBe(true)
    expect(listener).toHaveBeenCalledTimes(1)
    await core.setEnabled(false)
    expect(listener).toHaveBeenCalledTimes(2)
  })

  it('setEnabled with the current answer is a no-op', async () => {
    const { core, writeOptOut } = setup()
    await core.start()
    await core.setEnabled(true)
    expect(writeOptOut).not.toHaveBeenCalled()
  })
})

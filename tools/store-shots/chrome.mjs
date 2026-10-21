/**
 * Headless Chrome over the DevTools protocol, shared by the capture and the
 * composer. No Playwright: this repo deliberately does not depend on it.
 *
 * The browser is found among fixed install locations rather than taken from
 * the environment, and launched with an argument array (no shell), with a
 * profile directory created fresh by `mkdtemp` and removed on close.
 *
 * Page code is never assembled from strings: `call(fn, ...args)` sends the
 * function's own source and passes the values as CDP call arguments, so text
 * from a config or an API response is data in the page, never code.
 */
import { spawn } from 'node:child_process'
import { existsSync, mkdtempSync, rmSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'

const CANDIDATES = [
  '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome',
  '/Applications/Chromium.app/Contents/MacOS/Chromium',
  '/usr/bin/google-chrome',
  '/usr/bin/chromium',
]
const sleep = (ms) => new Promise((r) => setTimeout(r, ms))

export async function launchChrome(port, extraArgs = []) {
  const binary = CANDIDATES.find((path) => existsSync(path))
  if (!binary) throw new Error(`no Chrome found; looked in ${CANDIDATES.join(', ')}`)
  if (!Number.isInteger(port) || port < 1024 || port > 65535) throw new Error(`bad port ${port}`)
  const profile = mkdtempSync(join(tmpdir(), 'store-shots-chrome-'))
  const chrome = spawn(
    binary,
    [
      '--headless=new',
      `--remote-debugging-port=${port}`,
      `--user-data-dir=${profile}`,
      '--no-first-run',
      '--hide-scrollbars',
      ...extraArgs,
      'about:blank',
    ],
    { stdio: 'ignore', shell: false },
  )
  const close = async () => {
    chrome.kill()
    await sleep(500)
    rmSync(profile, { recursive: true, force: true })
  }

  let target
  for (let i = 0; i < 60 && !target; i++) {
    await sleep(250)
    try {
      target = (await (await fetch(`http://127.0.0.1:${port}/json/list`)).json()).find(
        (t) => t.type === 'page',
      )
    } catch {
      // not listening yet
    }
  }
  if (!target) {
    await close()
    throw new Error('headless Chrome did not start')
  }
  const ws = new WebSocket(target.webSocketDebuggerUrl)
  await new Promise((r) => ws.addEventListener('open', r, { once: true }))
  let seq = 0
  const pending = new Map()
  ws.addEventListener('message', (e) => {
    const m = JSON.parse(e.data)
    if (m.id && pending.has(m.id)) {
      pending.get(m.id)(m)
      pending.delete(m.id)
    }
  })
  const send = (method, params = {}) =>
    new Promise((r) => {
      const id = ++seq
      pending.set(id, r)
      ws.send(JSON.stringify({ id, method, params }))
    })

  /** Runs `fn(...args)` in the page; args travel as values, not as source. */
  const call = async (fn, ...args) => {
    const global = await send('Runtime.evaluate', { expression: 'globalThis' })
    const objectId = global.result?.result?.objectId
    const res = await send('Runtime.callFunctionOn', {
      objectId,
      functionDeclaration: fn.toString(),
      arguments: args.map((value) => ({ value })),
      awaitPromise: true,
      returnByValue: true,
    })
    return res.result?.result?.value
  }

  return {
    send,
    call,
    async close() {
      ws.close()
      await close()
    },
  }
}

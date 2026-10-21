/**
 * The isolated stack the store screenshots are taken on: an in-memory replica
 * set, this checkout's API on its own port, the seeded demo world, and the
 * web export served beside it.
 *
 * Never the shared API on :4000 and never a cloud database. Every port here
 * is checked free before it is taken — a peer session's stack holding one is
 * the usual way a capture silently photographs somebody else's server — and
 * everything is stopped through the handles this process holds, never by
 * name.
 */
import { spawn } from 'node:child_process'
import { randomBytes } from 'node:crypto'
import { createReadStream, existsSync, readdirSync, rmSync, statSync } from 'node:fs'
import { createServer, request } from 'node:http'
import { createRequire } from 'node:module'
import { createConnection } from 'node:net'
import { dirname, extname, join, normalize } from 'node:path'
import { fileURLToPath } from 'node:url'

const HERE = dirname(fileURLToPath(import.meta.url))
export const REPO = join(HERE, '../..')
const API_DIR = join(REPO, 'apps/api')
const MOBILE_DIR = join(REPO, 'apps/mobile')
const apiRequire = createRequire(join(API_DIR, 'package.json'))

export const PORTS = {
  mongo: Number(process.env.SHOTS_MONGO_PORT ?? 27170),
  api: Number(process.env.SHOTS_API_PORT ?? 4870),
  web: Number(process.env.SHOTS_WEB_PORT ?? 8870),
}
// Fixture databases must end in `_dev`; see `apps/api/scripts/testAccounts.ts`.
const DB_NAME = 'storeshots_dev'

function portTaken(port) {
  return new Promise((resolve) => {
    const socket = createConnection({ port, host: '127.0.0.1' })
    socket.once('connect', () => (socket.destroy(), resolve(true)))
    socket.once('error', () => resolve(false))
  })
}

export async function assertPortsFree(names = Object.keys(PORTS)) {
  if (Object.values(PORTS).includes(4000)) throw new Error(':4000 belongs to the shared API')
  for (const name of names) {
    const port = PORTS[name]
    if (await portTaken(port)) {
      throw new Error(
        `:${port} (${name}) is already taken — another stack is running. ` +
          `Stop it by port, or move this one with SHOTS_${name.toUpperCase()}_PORT.`,
      )
    }
  }
}

const sleep = (ms) => new Promise((r) => setTimeout(r, ms))

function get(url) {
  return new Promise((resolve) => {
    const req = request(url, (res) => (res.resume(), resolve(res.statusCode)))
    req.once('error', () => resolve(0))
    req.end()
  })
}

function run(cmd, args, opts) {
  return new Promise((resolve, reject) => {
    const child = spawn(cmd, args, { stdio: ['ignore', 'pipe', 'pipe'], ...opts })
    let out = ''
    child.stdout.on('data', (d) => (out += d))
    child.stderr.on('data', (d) => (out += d))
    child.once('exit', (code) =>
      code === 0
        ? resolve(out)
        : reject(new Error(`${cmd} ${args.join(' ')} exited ${code}\n${out.slice(-3000)}`)),
    )
  })
}

/** Starts mongo + API and seeds. Returns the facts the capture needs and a stop(). */
export async function startStack({ log = console.log } = {}) {
  // The web server is the caller's and may already be up.
  await assertPortsFree(['mongo', 'api'])
  const { MongoMemoryReplSet } = await import(apiRequire.resolve('mongodb-memory-server'))
  const replSet = await MongoMemoryReplSet.create({
    replSet: { count: 1, name: 'rs0' },
    instanceOpts: [{ port: PORTS.mongo }],
  })
  const uri = `mongodb://127.0.0.1:${PORTS.mongo}/?replicaSet=rs0&directConnection=true`
  log(`mongo  :${PORTS.mongo}`)

  const seedOut = await run(
    join(API_DIR, 'node_modules/.bin/tsx'),
    [join(HERE, 'seed.mts'), uri, DB_NAME],
    { cwd: API_DIR, env: { PATH: process.env.PATH, HOME: process.env.HOME } },
  )
  const world = JSON.parse(seedOut.trim().split('\n').at(-1))
  log(`seeded @sofia and ${Object.keys(world.ids).length} partners`)

  // A clean environment: nothing from the caller's shell (or a stray .env)
  // reaches this API, so it cannot send mail, push, or talk to a real store.
  const api = spawn(join(API_DIR, 'node_modules/.bin/tsx'), ['src/index.ts'], {
    cwd: API_DIR,
    stdio: ['ignore', 'ignore', 'pipe'],
    env: {
      PATH: process.env.PATH,
      HOME: process.env.HOME,
      NODE_ENV: 'development',
      HOST: '127.0.0.1',
      PORT: String(PORTS.api),
      LOG_LEVEL: 'warn',
      MONGODB_URI: uri,
      MONGODB_DB: DB_NAME,
      BETTER_AUTH_SECRET: randomBytes(32).toString('base64'),
      BETTER_AUTH_URL: `http://localhost:${PORTS.api}`,
      TRUSTED_ORIGINS: `http://localhost:${PORTS.web}`,
    },
  })
  let apiErr = ''
  api.stderr.on('data', (d) => (apiErr = (apiErr + d).slice(-4000)))
  for (let i = 0; i < 120 && (await get(`http://127.0.0.1:${PORTS.api}/health`)) !== 200; i++) {
    if (api.exitCode !== null) throw new Error(`API exited ${api.exitCode}\n${apiErr}`)
    await sleep(500)
  }
  if ((await get(`http://127.0.0.1:${PORTS.api}/health`)) !== 200)
    throw new Error(`API never came up\n${apiErr}`)
  log(`api    :${PORTS.api}`)

  return {
    world,
    apiUrl: `http://localhost:${PORTS.api}`,
    async stop() {
      api.kill('SIGTERM')
      await sleep(500)
      if (api.exitCode === null) api.kill('SIGKILL')
      await replSet.stop()
    },
  }
}

/**
 * The web export of this checkout, pointed at the stack's API. Not Metro: a
 * dev bundle compiles on first paint and photographs its own spinner.
 */
export async function exportWeb(outDir, { log = console.log } = {}) {
  rmSync(outDir, { recursive: true, force: true })
  const tmp = join(outDir, '..', 'tmp')
  log('exporting the web build (a few minutes)…')
  await run('npx', ['expo', 'export', '--platform', 'web', '--output-dir', outDir], {
    cwd: MOBILE_DIR,
    env: {
      ...process.env,
      CI: '1',
      TMPDIR: tmp,
      EXPO_PUBLIC_API_URL: `http://localhost:${PORTS.api}`,
    },
  })
}

const TYPES = {
  '.html': 'text/html; charset=utf-8',
  '.js': 'text/javascript; charset=utf-8',
  '.css': 'text/css; charset=utf-8',
  '.json': 'application/json; charset=utf-8',
  '.png': 'image/png',
  '.jpg': 'image/jpeg',
  '.svg': 'image/svg+xml',
  '.ico': 'image/x-icon',
  '.webp': 'image/webp',
  '.ttf': 'font/ttf',
  '.otf': 'font/otf',
  '.woff': 'font/woff',
  '.woff2': 'font/woff2',
  '.wasm': 'application/wasm',
  '.mp3': 'audio/mpeg',
}

/**
 * Serves an export the way it is laid out (see `tools/promo-video/serve.mjs`):
 * `/discover` is `discover.html`, and a dynamic route is the file with the
 * brackets still in its name.
 */
export function serveWeb(root) {
  const isFile = (p) => existsSync(p) && statSync(p).isFile()
  const resolvePath = (pathname) => {
    const rel = normalize(decodeURIComponent(pathname))
      .replace(/^(\.\.[/\\])+/, '')
      .replace(/^\/+/, '')
    const base = join(root, rel)
    for (const c of [base, `${base}.html`, join(base, 'index.html')]) if (isFile(c)) return c
    const segs = rel.split('/').filter(Boolean)
    if (segs.length > 1) {
      const parent = join(root, ...segs.slice(0, -1))
      if (existsSync(parent)) {
        const dyn = readdirSync(parent).find((n) => n.startsWith('[') && n.endsWith('].html'))
        if (dyn) return join(parent, dyn)
      }
    }
    return join(root, 'index.html')
  }
  const server = createServer((req, res) => {
    const file = resolvePath(new URL(req.url, 'http://x').pathname)
    res.writeHead(200, {
      'content-type': TYPES[extname(file)] ?? 'application/octet-stream',
      'cache-control': 'no-store',
    })
    createReadStream(file).pipe(res)
  })
  return new Promise((resolve) =>
    server.listen(PORTS.web, '127.0.0.1', () =>
      resolve({
        url: `http://localhost:${PORTS.web}`,
        stop: () => new Promise((r) => server.close(r)),
      }),
    ),
  )
}

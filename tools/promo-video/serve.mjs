/**
 * Serves `apps/mobile/dist` on :8081 for the capture run.
 *
 * Why not Metro: `expo start --web` serves an unminified dev bundle, and a
 * recording of it shows the compile on the first frames and drops frames on
 * every scroll. Why not `npx serve`: the export writes one HTML file per
 * static route, and a single-page fallback would swallow them.
 *
 * :8081 and not any free port — the API's TRUSTED_ORIGINS and the sign-in
 * `origin` header in `capture.mjs` both name it.
 *
 * Usage: node tools/promo-video/serve.mjs [port]
 */
import { createReadStream, existsSync, readdirSync, statSync } from 'node:fs'
import { createServer } from 'node:http'
import { dirname, extname, join, normalize } from 'node:path'
import { fileURLToPath } from 'node:url'

const HERE = dirname(fileURLToPath(import.meta.url))
const ROOT = join(HERE, '../../apps/mobile/dist')
const PORT = Number(process.argv[2] ?? 8081)

const TYPES = {
  '.html': 'text/html; charset=utf-8',
  '.js': 'text/javascript; charset=utf-8',
  '.mjs': 'text/javascript; charset=utf-8',
  '.css': 'text/css; charset=utf-8',
  '.json': 'application/json; charset=utf-8',
  '.png': 'image/png',
  '.jpg': 'image/jpeg',
  '.jpeg': 'image/jpeg',
  '.gif': 'image/gif',
  '.svg': 'image/svg+xml',
  '.ico': 'image/x-icon',
  '.webp': 'image/webp',
  '.ttf': 'font/ttf',
  '.otf': 'font/otf',
  '.woff': 'font/woff',
  '.woff2': 'font/woff2',
  '.txt': 'text/plain; charset=utf-8',
  '.map': 'application/json; charset=utf-8',
}

const isFile = (path) => existsSync(path) && statSync(path).isFile()
const isDir = (path) => existsSync(path) && statSync(path).isDirectory()

/** `profile/[handle].html` — the one file that answers for every handle. */
function dynamicIn(dir, suffix) {
  if (!isDir(dir)) return null
  const match = readdirSync(dir).find((name) => name.startsWith('[') && name.endsWith(suffix))
  return match ? join(dir, match) : null
}

/**
 * The export's own layout: `/discover` is `discover.html`, assets are literal,
 * and a dynamic route is a file with the brackets still in its name. Without
 * the last step `/profile/test_marina` falls through to `404.html`, the app
 * hydrates on the wrong route and the screen says "Profile not found" about a
 * profile that is right there in the API.
 */
function resolve(pathname) {
  const decoded = decodeURIComponent(pathname)
  // `normalize` collapses `..` before it can climb out of `dist`.
  const rel = normalize(decoded)
    .replace(/^(\.\.[/\\])+/, '')
    .replace(/^\/+/, '')
  const base = join(ROOT, rel)
  for (const candidate of [base, `${base}.html`, join(base, 'index.html')]) {
    if (isFile(candidate)) return candidate
  }
  const segments = rel.split('/').filter(Boolean)
  if (segments.length > 1) {
    const parent = join(ROOT, ...segments.slice(0, -1))
    const dynamic = dynamicIn(parent, '].html')
    if (dynamic) return dynamic
  }
  return null
}

createServer((request, response) => {
  const { pathname } = new URL(request.url, 'http://localhost')
  const file = resolve(pathname === '/' ? '/index.html' : pathname)
  if (!file) {
    const notFound = join(ROOT, '404.html')
    response.writeHead(404, { 'content-type': TYPES['.html'] })
    if (isFile(notFound)) return createReadStream(notFound).pipe(response)
    return response.end('not found')
  }
  response.writeHead(200, {
    'content-type': TYPES[extname(file)] ?? 'application/octet-stream',
    'cache-control': 'no-store',
  })
  createReadStream(file).pipe(response)
}).listen(PORT, () => {
  if (!existsSync(ROOT)) {
    console.error(`no build at ${ROOT} — run: pnpm -C apps/mobile build:web`)
    process.exit(1)
  }
  console.log(`serving ${ROOT} on http://localhost:${PORT}`)
})

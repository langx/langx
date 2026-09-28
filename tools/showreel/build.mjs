/**
 * Folds `src/` into one self-contained page, `dist/langx-reel.html`: every
 * local script inlined in order, the CDN scripts and font links left as they
 * are. That single file is what gets published and shared — it opens from a
 * disk, a mail attachment or an artifact link with nothing beside it.
 *
 * Usage: node tools/showreel/build.mjs
 */
import { mkdirSync, readFileSync, writeFileSync } from 'node:fs'
import { dirname, join } from 'node:path'
import { fileURLToPath } from 'node:url'

const HERE = dirname(fileURLToPath(import.meta.url))
const SRC = join(HERE, 'src')
const OUT = join(HERE, 'dist', 'langx-reel.html')

let html = readFileSync(join(SRC, 'index.html'), 'utf8')

// The artifact host writes its own charset; locally the dev page needs one, or
// file:// decodes every non-Latin greeting as Windows-1252.
html = html.replace(/^<meta charset="utf-8" \/>\n/, '')

html = html.replace(/<script src="(?!https?:)([^"]+)"><\/script>/g, (_, path) => {
  // A closing tag inside a string would end the inline script early.
  const code = readFileSync(join(SRC, path), 'utf8').replace(/<\/script/gi, '<\\/script')
  return `<script>\n${code}\n</script>`
})

mkdirSync(dirname(OUT), { recursive: true })
writeFileSync(OUT, html)
console.log(`${OUT} (${(Buffer.byteLength(html) / 1024).toFixed(0)} KB)`)

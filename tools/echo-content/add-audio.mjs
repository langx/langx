/**
 * Puts a human voice on the words of a pack that already has candidates.
 *
 * `build-pack.mjs` harvests every recording Wiktionary links for an entry and
 * leaves them in `review.audio`, Lingua Libre first, deliberately unpromoted:
 * its comment said a pack pointing at Commons or at a copy in our own storage
 * was "a decision nobody has taken". It has been taken — **the pack points at
 * Commons** — and this script is the other half of it.
 *
 * **It verifies rather than assumes.** The candidates in one pack are not one
 * licence: a Lingua Libre file is CC BY-SA 4.0 by its project's default, while
 * `En-uk-to_go.ogg` sitting next to it in `beginner.json` is CC BY 3.0 US by
 * "Association Shtooka, Judith Franck". Guessing from the filename would put a
 * file on a card under terms nobody read. So every candidate is looked up on
 * Commons and judged on what comes back — which is also what `docs/echo.md`
 * asks for in as many words: verify at the version downloaded, record it.
 *
 * **Attribution is the point, not a footnote.** Every licence on the allowlist
 * but CC0 requires naming the author, so a file whose author cannot be read is
 * refused rather than played anonymously. The name lands in `audio.speaker`,
 * reaches `EchoAudio.speakerName`, and the session draws it as
 * "Spoken by {name}".
 *
 * Usage:
 *   node tools/echo-content/add-audio.mjs --file content/echo/en/beginner.json
 *   node tools/echo-content/add-audio.mjs --file content/echo/en/beginner.json --apply
 *
 * Dry run unless `--apply`, the same way `seed-echo-packs.ts` works, and it
 * prints every rejection with its reason either way. `review.audio` is never
 * touched: it is the record of what was on offer.
 */
import { readFile, writeFile } from 'node:fs/promises'
import { resolve } from 'node:path'

const API = 'https://commons.wikimedia.org/w/api.php'

/**
 * Wikimedia asks for a descriptive User-Agent that identifies the tool and a
 * way to reach whoever runs it. A default fetch agent is refused outright on
 * some endpoints and rate-limited harder on the rest.
 */
const USER_AGENT = 'LangX-EchoContent/1.0 (https://github.com/langx/langx)'

/** `titles=` takes fifty per request; three packs are then about twenty calls. */
const BATCH = 50

/**
 * What may go on a card, by the machine-readable slug rather than the pretty
 * name: `License` is a stable identifier where `LicenseShortName` is prose
 * that varies between "CC BY-SA 4.0" and "Creative Commons Attribution-Share
 * Alike 4.0". Matching on prose is how a licence gets misread.
 *
 * Non-commercial and no-derivatives are the two that rule a file out of a
 * commercial app, and `content/echo/ATTRIBUTION.md` already rejects a word
 * list for the first of them. Anything unrecognised is refused too: an
 * unreadable licence is not a permissive one.
 */
const ALLOWED = [/^cc0/, /^cc-by(-sa)?-\d/, /^pd/, /^public[-\s]?domain/]
const FORBIDDEN = [/-nc-/, /-nc$/, /-nd-/, /-nd$/]

/** CC0 waives attribution; everything else on the allowlist requires it. */
function needsCredit(slug) {
  return !/^cc0/.test(slug) && !/^pd/.test(slug) && !/^public[-\s]?domain/.test(slug)
}

/** Commons returns `Artist` as HTML — a link, sometimes several. */
export function plainText(html) {
  return html
    .replace(/<[^>]*>/g, ' ')
    .replace(/&amp;/g, '&')
    .replace(/&quot;/g, '"')
    .replace(/&#0?39;/g, "'")
    .replace(/&nbsp;/g, ' ')
    .replace(/\s+/g, ' ')
    .trim()
}

/**
 * Who to credit for a *recording*, which is not always the whole `Artist`.
 *
 * Lingua Libre writes a list — "Speaker: Sapaa", "Recorder: Sapaa" — and
 * flattening it gives "Speaker: Sapaa Recorder: Sapaa", which the session
 * would draw as "Spoken by Speaker: Sapaa Recorder: Sapaa". The speaker is the
 * person whose voice is on the card, so that row wins where there is one.
 *
 * Everything else is one name already: the Shtooka files say "Association
 * Shtooka, Judith Franck" with no markup to pick apart.
 */
export function speakerFrom(html) {
  for (const row of html.split(/<li[^>]*>/i).slice(1)) {
    const text = plainText(row)
    const speaker = /^speakers?\s*:\s*(.+)$/i.exec(text)
    if (speaker?.[1]) return speaker[1].trim()
  }

  const flat = plainText(html)
  /*
   * Commons' own wording where an uploader left the field blank and somebody
   * inferred the author later: "No machine-readable author provided. Dvortygirl
   * assumed (based on copyright claims)." The name in it is the credit Commons
   * itself displays, and taking it is better than dropping a good recording —
   * but the sentence around it is not a name and must not reach the card.
   */
  const assumed = /^no machine-readable author provided\.\s*(.+?)\s+assumed\b/i.exec(flat)
  if (assumed?.[1]) return assumed[1].trim()

  return flat
}

/**
 * A name, or prose that happens to mention one.
 *
 * The session draws this after "Spoken by", so anything sentence-shaped is a
 * parse this script did not anticipate. Refusing is louder than rendering it:
 * the run's report names the file and somebody can teach `speakerFrom` the new
 * shape, where a silent "Spoken by No machine-readable author provided…" would
 * just sit on a card.
 */
function looksLikeAName(text) {
  return text.length > 0 && text.length <= 60 && !/\.\s/.test(text)
}

/**
 * Whether this file may be used, and by whom it was made.
 *
 * Returns a reason instead of a verdict when the answer is no, because the
 * report is the point: a pack that gained audio on a third of its words should
 * say what happened to the other two thirds.
 */
export function judge(metadata) {
  const slug = (metadata?.License?.value ?? '').toLowerCase().trim()
  if (!slug) return { ok: false, why: 'no licence stated' }
  if (FORBIDDEN.some((rule) => rule.test(slug))) return { ok: false, why: `licence ${slug}` }
  if (!ALLOWED.some((rule) => rule.test(slug))) return { ok: false, why: `licence ${slug}` }

  const licence = plainText(metadata.LicenseShortName?.value ?? slug)
  const speaker = speakerFrom(metadata.Artist?.value ?? '')
  // Refused rather than played anonymously: the credit is the term we are
  // relying on, so a file that cannot carry one cannot be used.
  if (needsCredit(slug) && !speaker) return { ok: false, why: `${licence}, no author named` }
  if (speaker && !looksLikeAName(speaker)) {
    return { ok: false, why: `author not parsed as a name: ${speaker.slice(0, 50)}…` }
  }

  return { ok: true, licence, ...(speaker ? { speaker } : {}) }
}

/**
 * One batch of titles, with the back-off the API asks for.
 *
 * A shared egress address meets `429` with a `retry-after` regularly — waiting
 * the stated number of seconds is the whole protocol, and hammering through it
 * is how a tool gets an address blocked.
 */
async function lookup(titles) {
  const params = new URLSearchParams({
    action: 'query',
    format: 'json',
    prop: 'imageinfo',
    iiprop: 'extmetadata',
    titles: titles.join('|'),
  })

  for (let attempt = 0; attempt < 6; attempt++) {
    const response = await fetch(`${API}?${params}`, { headers: { 'User-Agent': USER_AGENT } })
    if (response.status === 429) {
      const wait = Number(response.headers.get('retry-after') ?? 30)
      process.stdout.write(`  rate-limited, waiting ${wait}s\n`)
      await new Promise((done) => setTimeout(done, (Number.isFinite(wait) ? wait : 30) * 1000))
      continue
    }
    if (!response.ok) throw new Error(`Commons answered ${response.status}`)
    const body = await response.json()

    const found = new Map()
    for (const page of Object.values(body.query?.pages ?? {})) {
      if (page.imageinfo?.[0]?.extmetadata) found.set(page.title, page.imageinfo[0].extmetadata)
    }
    /*
     * A title the API normalised — `En-uk-to_go.ogg` comes back as
     * `En-uk-to go.ogg` — has to be findable under the name we asked with, or
     * every underscore in a filename silently loses its recording.
     */
    for (const { from, to } of body.query?.normalized ?? []) {
      if (found.has(to)) found.set(from, found.get(to))
    }
    return found
  }
  throw new Error('Commons kept rate-limiting; try again later')
}

/** `LL-Q1860 (eng)-Sapaa-I know.wav` → `File:LL-Q1860 (eng)-Sapaa-I know.wav` */
function titleOf(file) {
  return `File:${file.replace(/_/g, ' ')}`
}

async function main() {
  const at = process.argv.indexOf('--file')
  const path = at < 0 ? undefined : process.argv[at + 1]
  if (!path) throw new Error('Usage: add-audio.mjs --file <pack.json> [--apply]')
  const apply = process.argv.includes('--apply')

  const full = resolve(path)
  const pack = JSON.parse(await readFile(full, 'utf8'))

  // Every distinct file across the pack, asked about once however many items
  // list it.
  const wanted = new Set()
  for (const item of pack.items) {
    for (const candidate of item.review?.audio ?? []) {
      if (candidate.file) wanted.add(candidate.file)
    }
  }
  const files = [...wanted]
  process.stdout.write(`${pack.id}: ${pack.items.length} items, ${files.length} distinct files\n`)

  const metadata = new Map()
  for (let start = 0; start < files.length; start += BATCH) {
    const batch = files.slice(start, start + BATCH)
    process.stdout.write(`  ${start + 1}-${start + batch.length} of ${files.length}\n`)
    const found = await lookup(batch.map(titleOf))
    for (const file of batch) {
      const entry = found.get(titleOf(file))
      if (entry) metadata.set(file, entry)
    }
  }

  const verdicts = new Map()
  for (const [file, entry] of metadata) verdicts.set(file, judge(entry))

  let matched = 0
  const refusals = new Map()
  for (const item of pack.items) {
    const candidates = item.review?.audio ?? []
    // First that passes: `build-pack.mjs` already sorted Lingua Libre to the
    // front, so the order here is the preference the pipeline encodes.
    const chosen = candidates.find((candidate) => verdicts.get(candidate.file)?.ok)
    if (!chosen) {
      for (const candidate of candidates) {
        const why = verdicts.get(candidate.file)?.why ?? 'not found on Commons'
        refusals.set(why, (refusals.get(why) ?? 0) + 1)
      }
      delete item.audio
      continue
    }
    const verdict = verdicts.get(chosen.file)
    item.audio = {
      url: chosen.url,
      file: chosen.file,
      ...(verdict.speaker ? { speaker: verdict.speaker } : {}),
      licence: verdict.licence,
    }
    matched += 1
  }

  process.stdout.write(`\n${matched} of ${pack.items.length} items have a recording\n`)

  /*
   * The licences actually found, not the ones expected. This is the line that
   * makes the run auditable — and the one that would have caught an allowlist
   * so loose it passed everything.
   */
  const licences = new Map()
  for (const item of pack.items) {
    if (!item.audio) continue
    licences.set(item.audio.licence, (licences.get(item.audio.licence) ?? 0) + 1)
  }
  for (const [licence, count] of [...licences].sort((a, b) => b[1] - a[1])) {
    process.stdout.write(`  ${count}× ${licence}\n`)
  }

  if (refusals.size > 0) {
    process.stdout.write('refused candidates:\n')
    for (const [why, count] of [...refusals].sort((a, b) => b[1] - a[1])) {
      process.stdout.write(`  ${count}× ${why}\n`)
    }
  }

  if (!apply) {
    process.stdout.write('\nDry run. Pass --apply to write.\n')
    return
  }
  await writeFile(full, `${JSON.stringify(pack, null, 2)}\n`)
  process.stdout.write(`\nWrote ${path}\n`)
}

// Importable for the checks above without running the fetch loop.
if (process.argv[1]?.endsWith('add-audio.mjs')) {
  await main()
}

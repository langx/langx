/* global console */
/**
 * Writes the body of a GitHub Release, on stdout.
 *
 *     node scripts/release-notes.mjs v2.6
 *
 * `--generate-notes` wrote one flat list: v2.6 was forty-six lines, every one
 * of them a sentence about a pull request and none of them about the release.
 * The titles in this repo are prose rather than `feat:` prefixes, which reads
 * well one at a time and turns into a wall of it at forty-six.
 *
 * So the body is two things. On top, the release notes the store already has —
 * `docs/store/listing.md` carries them in eight languages for every version,
 * written by a person, and the English one says what the release is. Under it,
 * the pull requests, grouped by what they touched: the app, the server, Echo's
 * content, and everything else folded away. Nothing is dropped, it is only
 * ordered, and the compare link at the bottom is still the whole truth.
 *
 * Two things this deliberately does not do. It does not invent prose — the
 * summary at the top is the one someone wrote for the stores, or there is no
 * summary. And it does not name an author on every line, since in this repo
 * they would all be the same one; a handle is printed only where it differs.
 */
import { execFileSync } from 'node:child_process'
import { dirname, join } from 'node:path'
import { fileURLToPath } from 'node:url'

const root = join(dirname(fileURLToPath(import.meta.url)), '..')

/** `v2.6` and nothing else — the same shape `pnpm release` writes. */
const TAG = /^v(\d+\.\d+)$/

/** ASCII record and unit separators: no commit message contains them. */
const RECORD = '\x1e'
const FIELD = '\x1f'

/**
 * Where a pull request goes is decided by the files it changed, because that
 * is the only signal these titles carry. Ties go to the first match here, so
 * the order is precedence as well as the order of the sections.
 */
const AREAS = [
  {
    heading: 'The app',
    matches: (file) => file.startsWith('apps/mobile/'),
  },
  {
    heading: 'The server',
    matches: (file) => file.startsWith('apps/api/') || file.startsWith('packages/shared/'),
  },
  {
    heading: 'Echo content',
    matches: (file) => file.startsWith('content/echo/') || file.startsWith('tools/echo-content/'),
  },
]

/**
 * The two sections nothing is matched into: whatever the areas above did not
 * claim, and the bumps, which are told apart by their branch rather than by
 * their files.
 */
const OTHER = { heading: 'Docs, CI and tooling', folded: true }
const DEPENDENCIES = { heading: 'Dependencies', folded: true }

/** Sections in the order they are printed. */
const SECTIONS = [...AREAS, OTHER, DEPENDENCIES]

function git(...args) {
  return execFileSync('git', args, {
    cwd: root,
    encoding: 'utf8',
    maxBuffer: 64 * 1024 * 1024,
  }).trim()
}

/**
 * The previous release is the nearest version tag that the tagged commit
 * descends from. `${tag}^` starts the search one commit back so the tag being
 * released cannot find itself.
 */
function previousTag(tag) {
  try {
    return git('describe', '--tags', '--abbrev=0', '--match', 'v[0-9]*', `${tag}^`)
  } catch {
    return null // The first release: everything up to the tag is new.
  }
}

/**
 * The merges on `main`'s first-parent line, which is one per pull request:
 * GitHub writes the number and branch into the subject and the title into the
 * body. A merge made any other way has no number and is skipped rather than
 * listed as a mystery.
 */
function pullRequests(range) {
  const output = git(
    'log',
    '--first-parent',
    '--merges',
    `--format=%H${FIELD}%s${FIELD}%b${RECORD}`,
    range,
  )
  return output
    .split(RECORD)
    .map((record) => record.trim())
    .filter(Boolean)
    .map((record) => {
      const [sha, subject, body] = record.split(FIELD)
      const merge = /^Merge pull request #(\d+) from (\S+)/.exec(subject)
      if (!merge) return null
      const title = (body ?? '')
        .split('\n')
        .map((line) => line.trim())
        .find(Boolean)
      if (!title) return null
      return { sha, number: Number(merge[1]), branch: merge[2], title }
    })
    .filter(Boolean)
    .reverse() // Oldest first: a release reads in the order it was built.
}

/**
 * What the pull request changed, taken from the merge against its base, minus
 * the manifests. A manifest is never evidence of an area: `pnpm release`
 * touches all four of them and belongs to no part of the app, and a bump
 * touches one and belongs to the package it names rather than to whatever
 * happens to depend on it. Dropping them leaves those with nothing matched
 * and sends them to the folded sections, which is where they read best.
 */
const MANIFESTS = /(^|\/)(package\.json|pnpm-lock\.yaml|pnpm-workspace\.yaml)$/

function filesOf(sha) {
  return git('diff', '--name-only', `${sha}^1`, sha)
    .split('\n')
    .filter((file) => file !== '' && !MANIFESTS.test(file))
}

function areaOf(pr) {
  if (pr.branch.includes('dependabot/')) return DEPENDENCIES
  const files = filesOf(pr.sha)
  let best = OTHER
  let bestCount = 0
  for (const area of AREAS) {
    const count = files.filter(area.matches).length
    if (count > bestCount) {
      best = area
      bestCount = count
    }
  }
  return best
}

/**
 * The handle behind each pull request, asked for in one GraphQL request with
 * an alias per number. `gh pr list` would be one line instead of six, but it
 * pages by when a pull request was opened rather than by when it was merged,
 * and a branch that sat open for a month — every Dependabot one does — falls
 * off the end of any page size that is not absurd.
 *
 * Every way this can fail — no `gh`, no token, a rate limit — leaves the notes
 * without handles, which is a smaller loss than not writing them at all.
 */
function authors(slug, numbers) {
  if (numbers.length === 0) return new Map()
  const [owner, name] = slug.split('/')
  const fields = numbers
    .map((number) => `pr${number}: pullRequest(number: ${number}) { author { login __typename } }`)
    .join('\n')
  try {
    const output = execFileSync(
      'gh',
      [
        'api',
        'graphql',
        '-f',
        `query=query { repository(owner: "${owner}", name: "${name}") { ${fields} } }`,
      ],
      { cwd: root, encoding: 'utf8', stdio: ['ignore', 'pipe', 'ignore'] },
    )
    const repository = JSON.parse(output).data?.repository ?? {}
    const byNumber = new Map()
    for (const number of numbers) {
      const author = repository[`pr${number}`]?.author
      // A bot's handle says nothing a reader wants; its section already does.
      if (author?.login && author.__typename !== 'Bot') byNumber.set(number, author.login)
    }
    return byNumber
  } catch {
    return new Map()
  }
}

/**
 * The handle every other line would repeat. One person merges nearly
 * everything here, so naming them forty-six times says nothing; naming the
 * one line that is somebody else says all of it.
 */
function dominantAuthor(byNumber) {
  const counts = new Map()
  for (const login of byNumber.values()) counts.set(login, (counts.get(login) ?? 0) + 1)
  let dominant = null
  for (const [login, count] of counts) {
    if (!dominant || count > counts.get(dominant)) dominant = login
  }
  return dominant
}

/**
 * Whether the prose names this version, with `2.6` not answering for `12.60`.
 *
 * Spelled out rather than built into a `RegExp`, because a regular expression
 * assembled from an argument is `js/regex-injection` and CodeQL fails the pull
 * request on it. `TAG` has already proved the version is two numbers by the
 * time it gets here, but the check and the use are far enough apart that
 * neither CodeQL nor a reader should have to take that on trust.
 */
function mentions(prose, version) {
  // Digits and dots only, so `v2.6` and `2.6's` both count as the version
  // while `12.6` and `2.60` do not.
  const boundary = /[\d.]/
  for (let at = prose.indexOf(version); at !== -1; at = prose.indexOf(version, at + 1)) {
    const before = prose[at - 1] ?? ' '
    const after = prose[at + version.length] ?? ' '
    if (!boundary.test(before) && !boundary.test(after)) return true
  }
  return false
}

/**
 * The English release notes out of `docs/store/listing.md`, read at the tag so
 * a later edit cannot rewrite a published release's summary.
 *
 * The file holds one version's notes at a time and says which version in its
 * own prose. If that is not this version the block is skipped: notes from the
 * release before this one, printed as this one's, would be a false claim
 * rather than a stale file.
 */
function storeNotes(tag, version) {
  let listing
  try {
    listing = execFileSync('git', ['show', `${tag}:docs/store/listing.md`], {
      cwd: root,
      encoding: 'utf8',
      stdio: ['ignore', 'pipe', 'ignore'],
    })
  } catch {
    return null
  }

  const section = listing.split(/^## What's new \(release notes\)$/m)[1]
  if (!section) return null

  const intro = section.split(/^### /m)[0]
  if (!mentions(intro, version)) return null

  const english = section.split(/^### Release notes$/m)[1]?.split(/^\*\*English\*\*$/m)[1]
  if (!english) return null

  const quoted = []
  for (const line of english.split('\n').slice(1)) {
    if (line.startsWith('>')) quoted.push(line.replace(/^>\s?/, ''))
    else if (line.trim() === '') quoted.push('')
    else break
  }
  const notes = quoted.join('\n').trim()
  return notes === '' ? null : notes
}

function repoSlug() {
  if (process.env.GITHUB_REPOSITORY) return process.env.GITHUB_REPOSITORY
  const remote = git('remote', 'get-url', 'origin')
  const match = /github\.com[:/](.+?)(?:\.git)?$/.exec(remote)
  if (!match) throw new Error(`cannot read the repository from the origin remote: ${remote}`)
  return match[1]
}

function write(tag) {
  const version = TAG.exec(tag)?.[1]
  if (!version) throw new Error(`expected a tag like v2.6, got ${tag}`)

  const slug = repoSlug()
  const previous = previousTag(tag)
  const prs = pullRequests(previous ? `${previous}..${tag}` : tag)

  const byNumber = authors(
    slug,
    prs.map((pr) => pr.number),
  )
  const dominant = dominantAuthor(byNumber)

  const grouped = new Map(SECTIONS.map((area) => [area, []]))
  for (const pr of prs) {
    const login = byNumber.get(pr.number)
    grouped.get(areaOf(pr)).push({ ...pr, author: login && login !== dominant ? login : null })
  }

  const parts = []
  const notes = storeNotes(tag, version)
  if (notes) parts.push(notes, '---')

  for (const area of SECTIONS) {
    const entries = grouped.get(area)
    if (entries.length === 0) continue
    const lines = entries.map(
      (entry) => `- ${entry.title} (#${entry.number})${entry.author ? ` by @${entry.author}` : ''}`,
    )
    if (area.folded) {
      parts.push(
        [
          '<details>',
          `<summary>${area.heading} (${entries.length})</summary>`,
          '',
          ...lines,
          '',
          '</details>',
        ].join('\n'),
      )
    } else {
      parts.push([`### ${area.heading}`, '', ...lines].join('\n'))
    }
  }

  parts.push(
    previous
      ? `**Full Changelog**: https://github.com/${slug}/compare/${previous}...${tag}`
      : `**Full Changelog**: https://github.com/${slug}/commits/${tag}`,
  )

  console.log(parts.join('\n\n'))
}

// Thrown, not `process.exit`, for the reason `release.mjs` explains at its own
// bottom: CodeQL reads a branch on argv that ends in an exit as a security
// check the caller can bypass, and fails the pull request on it.
write(process.argv[2] ?? '')

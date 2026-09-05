/* global console */
/**
 * Cuts a release: bumps the version, commits it and tags the commit. One
 * command instead of four files edited by hand and a tag typed from memory.
 *
 *     pnpm release minor    2.0 -> 2.1
 *     pnpm release major    2.1 -> 3.0
 *     pnpm release --print  prints the current version and exits
 *
 * The version is two numbers, `major.minor`, and lives in the root
 * package.json. The workspace packages carry the same number so nothing in
 * the repo disagrees with it, but only the root copy is read: `app.config.ts`
 * imports it, so the store binaries and the web build ship it too.
 *
 * Nothing is pushed. `main` is protected and releases go through the same
 * pull request as everything else; the script prints the two commands that
 * finish the job. Pushing the tag is what creates the GitHub Release
 * (`.github/workflows/github-release.yml`).
 */
import { execFileSync } from 'node:child_process'
import { readFileSync, writeFileSync } from 'node:fs'
import { dirname, join } from 'node:path'
import { fileURLToPath } from 'node:url'

const root = join(dirname(fileURLToPath(import.meta.url)), '..')
const MANIFESTS = [
  'package.json',
  'apps/api/package.json',
  'apps/mobile/package.json',
  'packages/shared/package.json',
]

/** `2.0`, `2.1`, `10.4` — and nothing else, so a typo cannot become a tag. */
const VERSION = /^(\d+)\.(\d+)$/

function readVersion() {
  const { version } = JSON.parse(readFileSync(join(root, MANIFESTS[0]), 'utf8'))
  if (typeof version !== 'string' || !VERSION.test(version)) {
    throw new Error(`root package.json version must look like 2.0, got ${JSON.stringify(version)}`)
  }
  return version
}

function bump(version, part) {
  const [, major, minor] = VERSION.exec(version)
  return part === 'major' ? `${Number(major) + 1}.0` : `${major}.${Number(minor) + 1}`
}

function git(...args) {
  return execFileSync('git', args, { cwd: root, encoding: 'utf8' }).trim()
}

function main(argv) {
  const current = readVersion()
  const [part] = argv

  if (part === '--print') {
    console.log(current)
    return
  }
  if (part !== 'major' && part !== 'minor') {
    console.error('usage: pnpm release <major|minor>  |  pnpm release --print')
    process.exit(2)
  }

  // A release commit must contain the version bump and nothing else, so it
  // refuses to start on top of unrelated edits rather than sweeping them in.
  if (git('status', '--porcelain') !== '') {
    console.error('the working tree has uncommitted changes; commit or stash them first')
    process.exit(1)
  }

  const next = bump(current, part)
  const tag = `v${next}`
  if (git('tag', '--list', tag) !== '') {
    console.error(`${tag} already exists`)
    process.exit(1)
  }

  for (const manifest of MANIFESTS) {
    const path = join(root, manifest)
    // A string replacement, not a parse-and-serialise round trip: the files
    // keep their key order, indentation and trailing newline exactly, so the
    // diff is one line per file and prettier has nothing to say about it.
    const source = readFileSync(path, 'utf8')
    const updated = source.replace(
      /^(\s*"version":\s*)"[^"]*"/m,
      (_match, prefix) => `${prefix}${JSON.stringify(next)}`,
    )
    if (updated === source) throw new Error(`${manifest} has no "version" field to update`)
    writeFileSync(path, updated)
  }

  git('add', ...MANIFESTS)
  git('commit', '--quiet', '--message', `Release ${next}`)
  git('tag', '--annotate', '--message', `LangX ${next}`, tag)

  const branch = git('rev-parse', '--abbrev-ref', 'HEAD')
  console.log(`${current} -> ${next}, committed and tagged ${tag}. To finish:`)
  console.log('')
  console.log(`    git push -u origin ${branch}`)
  console.log(`    git push origin ${tag}`)
  console.log('')
  console.log('Push the tag once the release commit is on main; the tag is what creates the')
  console.log('GitHub Release. A store build is still release.yml on expo.dev.')
}

main(process.argv.slice(2))

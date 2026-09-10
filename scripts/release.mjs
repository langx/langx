/* global console */
/**
 * Cuts a release: bumps the version, commits it and tags the commit. One
 * command instead of four files edited by hand and a tag typed from memory.
 *
 *     pnpm release minor    2.0 -> 2.1, build 148 -> 149
 *     pnpm release major    2.1 -> 3.0, build 149 -> 150
 *     pnpm release build    build 150 -> 151, the version untouched
 *     pnpm release --print  prints the current version and exits
 *
 * The version is two numbers, `major.minor`, and lives in the root
 * package.json; only that copy is read: `app.config.ts` imports it, so the
 * store binaries and the web build ship it too. The workspace packages carry
 * the same number with a `.0` on the end, because `pnpm deploy` matches
 * `@langx/shared@workspace:*` by semver and `2.0` is not one — the API image
 * stopped building the first time the two digits reached those files.
 *
 * The build number lives next to the version, as `buildNumber`, and is both
 * `ios.buildNumber` and `android.versionCode`, so the stores cannot drift
 * apart. A release bumps it because a new version is a new binary; `build`
 * bumps it alone, for a rebuild inside a round (a store refuses a second
 * upload on the same number). Neither store lets it go down.
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
const ROOT_MANIFEST = 'package.json'
/** Workspace packages: semver, `major.minor.0`, because pnpm needs one. */
const WORKSPACE_MANIFESTS = [
  'apps/api/package.json',
  'apps/mobile/package.json',
  'packages/shared/package.json',
]
const MANIFESTS = [ROOT_MANIFEST, ...WORKSPACE_MANIFESTS]

/** `2.0`, `2.1`, `10.4` — and nothing else, so a typo cannot become a tag. */
const VERSION = /^(\d+)\.(\d+)$/

function readVersion() {
  const { version } = JSON.parse(readFileSync(join(root, ROOT_MANIFEST), 'utf8'))
  if (typeof version !== 'string' || !VERSION.test(version)) {
    throw new Error(`root package.json version must look like 2.0, got ${JSON.stringify(version)}`)
  }
  return version
}

function readBuildNumber() {
  const { buildNumber } = JSON.parse(readFileSync(join(root, ROOT_MANIFEST), 'utf8'))
  if (!Number.isInteger(buildNumber) || buildNumber < 1) {
    throw new Error(`root package.json buildNumber must be a positive integer, got ${buildNumber}`)
  }
  return buildNumber
}

/**
 * A string replacement, not a parse-and-serialise round trip: the file keeps
 * its key order, indentation and trailing newline exactly, so the diff is one
 * line and prettier has nothing to say about it.
 */
function replaceField(manifest, pattern, value) {
  const path = join(root, manifest)
  const source = readFileSync(path, 'utf8')
  const updated = source.replace(pattern, (_match, prefix) => `${prefix}${value}`)
  if (updated === source) throw new Error(`${manifest} has nothing matching ${pattern} to update`)
  writeFileSync(path, updated)
}

function writeBuildNumber(next) {
  replaceField(ROOT_MANIFEST, /^(\s*"buildNumber":\s*)\d+/m, next)
}

function bumped(version, part) {
  const [, major, minor] = VERSION.exec(version)
  return part === 'major' ? `${Number(major) + 1}.0` : `${major}.${Number(minor) + 1}`
}

function git(...args) {
  return execFileSync('git', args, { cwd: root, encoding: 'utf8' }).trim()
}

function fail(message) {
  console.error(message)
  process.exit(1)
}

function printVersion() {
  console.log(readVersion())
}

function usage() {
  console.error('usage: pnpm release <major|minor|build>  |  pnpm release --print')
  process.exit(2)
}

function release(part) {
  const current = readVersion()

  // A release commit must contain the version bump and nothing else, so it
  // refuses to start on top of unrelated edits rather than sweeping them in.
  if (git('status', '--porcelain') !== '') {
    fail('the working tree has uncommitted changes; commit or stash them first')
  }

  const next = bumped(current, part)
  const tag = `v${next}`
  if (git('tag', '--list', tag) !== '') fail(`${tag} already exists`)

  for (const manifest of MANIFESTS) {
    const value = manifest === ROOT_MANIFEST ? next : `${next}.0`
    replaceField(manifest, /^(\s*"version":\s*)"[^"]*"/m, JSON.stringify(value))
  }
  const build = readBuildNumber() + 1
  writeBuildNumber(build)

  git('add', ...MANIFESTS)
  git('commit', '--quiet', '--message', `Release ${next}`)
  git('tag', '--annotate', '--message', `LangX ${next}`, tag)

  const branch = git('rev-parse', '--abbrev-ref', 'HEAD')
  console.log(`${current} -> ${next} (build ${build}), committed and tagged ${tag}. To finish:`)
  console.log('')
  console.log(`    git push -u origin ${branch}`)
  console.log(`    git push origin ${tag}`)
  console.log('')
  console.log('Push the tag once the release commit is on main; the tag is what creates the')
  console.log('GitHub Release. A store build is still release.yml on expo.dev.')
}

function releaseBuild() {
  if (git('status', '--porcelain') !== '') {
    fail('the working tree has uncommitted changes; commit or stash them first')
  }
  const current = readBuildNumber()
  const next = current + 1
  writeBuildNumber(next)
  git('add', ROOT_MANIFEST)
  git('commit', '--quiet', '--message', `Build ${next}`)
  console.log(`build ${current} -> ${next}, committed. Push the branch; build once it is on main.`)
}

// A switch that dispatches to functions taking no input, rather than an
// if-chain that exits. CodeQL reads a branch on argv that ends in
// `process.exit` as a security check the caller can bypass (CWE-807), and
// fails the pull request on it. The rule is aimed at servers, but the shape it
// wants is also the simpler one here: the argument picks a command, and the
// commands do the rest without it.
switch (process.argv[2]) {
  case '--print':
    printVersion()
    break
  case 'major':
    release('major')
    break
  case 'minor':
    release('minor')
    break
  case 'build':
    releaseBuild()
    break
  default:
    usage()
}

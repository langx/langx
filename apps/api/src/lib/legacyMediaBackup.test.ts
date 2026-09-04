import { mkdtempSync, mkdirSync, writeFileSync, rmSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { afterEach, describe, expect, it } from 'vitest'
import { buildBackupIndex, readBackupBytes } from './legacyMediaBackup'

const roots: string[] = []

function root(): string {
  const dir = mkdtempSync(join(tmpdir(), 'legacy-backup-'))
  roots.push(dir)
  return dir
}

function file(dir: string, ...parts: string[]): void {
  const path = join(dir, ...parts)
  mkdirSync(join(path, '..'), { recursive: true })
  writeFileSync(path, parts.at(-1) ?? '')
}

afterEach(() => {
  for (const dir of roots.splice(0)) rmSync(dir, { recursive: true, force: true })
})

describe('buildBackupIndex', () => {
  it('indexes a flat bucket layout, which is what the Spaces copy is', () => {
    const dir = root()
    file(dir, 'bucket-a', '652f1c69c60a8c443067.')
    file(dir, 'bucket-a', 'aaaa1111.png')
    file(dir, 'bucket-b', 'bbbb2222.jpg')

    const index = buildBackupIndex(dir)
    expect([...index.byId.keys()].sort()).toEqual(['652f1c69c60a8c443067', 'aaaa1111', 'bbbb2222'])
    expect(index.filesSeen).toBe(3)
    expect(index.collisions).toBe(0)
  })

  it('finds the same ids when the same files are sharded into directories', () => {
    const flat = root()
    file(flat, 'bucket-a', 'aaaa1111.png')
    file(flat, 'bucket-a', 'bbbb2222')

    const sharded = root()
    file(sharded, 'bucket-a', 'aa', 'aa', 'aaaa1111.png')
    file(sharded, 'bucket-a', 'bb', 'bb', 'bbbb2222')

    expect([...buildBackupIndex(sharded).byId.keys()].sort()).toEqual(
      [...buildBackupIndex(flat).byId.keys()].sort(),
    )
    // The one-level walk this replaces indexed `aa` and `bb` as file ids and
    // found none of the files underneath them.
    expect(buildBackupIndex(sharded).directories).toBeGreaterThan(
      buildBackupIndex(flat).directories,
    )
  })

  it('keys a bare id with no extension on the id itself', () => {
    const dir = root()
    file(dir, 'bucket-a', '652fd5d02b4c3365158a')
    expect(buildBackupIndex(dir).byId.has('652fd5d02b4c3365158a')).toBe(true)
  })

  it('counts a collision rather than throwing, and keeps the first', () => {
    const dir = root()
    file(dir, 'bucket-a', 'dupe.png')
    file(dir, 'bucket-b', 'dupe.jpg')

    const index = buildBackupIndex(dir)
    expect(index.byId.size).toBe(1)
    expect(index.filesSeen).toBe(2)
    expect(index.collisions).toBe(1)
    expect(index.byId.get('dupe')).toContain('bucket-a')
  })

  it('reads bytes back, and answers null for a file the backup does not have', () => {
    const dir = root()
    file(dir, 'bucket-a', 'here.png')
    const index = buildBackupIndex(dir)
    expect(readBackupBytes(index, 'here')).toBeInstanceOf(Uint8Array)
    expect(readBackupBytes(index, 'gone')).toBeNull()
  })
})

import { mkdtempSync, rmSync, writeFileSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { afterAll, describe, expect, it, vi } from 'vitest'
import type { Storage } from 'node-appwrite'
import { copyLegacyFile } from './legacyMediaCopy'
import type { BackupIndex } from './legacyMediaBackup'

const PNG = new Uint8Array(16)
PNG.set([0x89, 0x50, 0x4e, 0x47])

const dirs: string[] = []
afterAll(() => {
  for (const dir of dirs) rmSync(dir, { recursive: true, force: true })
})

function backupWith(entries: Record<string, string>): BackupIndex {
  return {
    byId: new Map(Object.entries(entries)),
    filesSeen: Object.keys(entries).length,
    directories: 1,
    collisions: 0,
  }
}

function storageWith(file: { mimeType?: string } | Error): Storage {
  return {
    getFile: vi.fn(() => (file instanceof Error ? Promise.reject(file) : Promise.resolve(file))),
    getFileDownload: vi.fn(() => Promise.resolve(Buffer.from(PNG))),
  } as unknown as Storage
}

describe('copyLegacyFile', () => {
  it('takes the extension from Appwrite’s type, normalised', async () => {
    const put = vi.fn((key: string) => Promise.resolve(`https://cdn/${key}`))
    const url = await copyLegacyFile(
      { storage: storageWith({ mimeType: 'image/jpg' }), put, backup: undefined },
      { bucketId: 'b', fileId: 'f', key: 'legacy/x/avatar' },
    )
    expect(url).toBe('https://cdn/legacy/x/avatar.jpeg')
    expect(put).toHaveBeenCalledWith('legacy/x/avatar.jpeg', expect.any(Uint8Array), 'image/jpeg')
  })

  it('falls back to the bytes when Appwrite cannot say, so v1 can be switched off', async () => {
    const dir = mkdtempSync(join(tmpdir(), 'legacy-copy-'))
    dirs.push(dir)
    const path = join(dir, 'pic')
    writeFileSync(path, PNG)

    const put = vi.fn((key: string) => Promise.resolve(`https://cdn/${key}`))
    const url = await copyLegacyFile(
      {
        storage: storageWith(new Error('project not found')),
        put,
        backup: backupWith({ pic: path }),
      },
      { bucketId: 'b', fileId: 'pic', key: 'legacy/x/photo-0' },
    )
    expect(url).toBe('https://cdn/legacy/x/photo-0.png')
    expect(put).toHaveBeenCalledWith('legacy/x/photo-0.png', expect.any(Uint8Array), 'image/png')
  })

  it('answers null when the backup does not have the bytes', async () => {
    const url = await copyLegacyFile(
      {
        storage: storageWith({ mimeType: 'image/png' }),
        put: vi.fn(),
        backup: backupWith({ other: '/tmp/other.png' }),
      },
      { bucketId: 'b', fileId: 'gone', key: 'k' },
    )
    expect(url).toBeNull()
  })
})

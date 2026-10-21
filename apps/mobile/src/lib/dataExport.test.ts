import { describe, expect, it, vi } from 'vitest'
import { DATA_EXPORT_FILE_NAME, DATA_EXPORT_FILE_TYPE, exportMyData } from './dataExport'

const body = { profile: { username: 'sofia' }, messages: [{ body: 'hola' }] }

describe('exportMyData', () => {
  it('saves what the authenticated fetch returned, as readable JSON', async () => {
    const save = vi.fn().mockResolvedValue(true)
    const outcome = await exportMyData({
      fetchExport: () => Promise.resolve(body),
      save,
      web: false,
    })
    expect(outcome).toBe('shared')
    expect(save).toHaveBeenCalledWith(
      JSON.stringify(body, null, 2),
      DATA_EXPORT_FILE_NAME,
      DATA_EXPORT_FILE_TYPE,
    )
    expect(JSON.parse(save.mock.calls[0]![0] as string)).toEqual(body)
  })

  it('reports a browser download on the web', async () => {
    const save = vi.fn().mockResolvedValue(true)
    expect(await exportMyData({ fetchExport: () => Promise.resolve(body), save, web: true })).toBe(
      'downloaded',
    )
  })

  it('fails without saving anything when the request is refused', async () => {
    const save = vi.fn()
    const fetchExport = () => Promise.reject(new Error('401'))
    expect(await exportMyData({ fetchExport, save, web: false })).toBe('failed')
    expect(save).not.toHaveBeenCalled()
  })

  it('fails when no share sheet or download could be opened', async () => {
    const save = vi.fn().mockResolvedValue(false)
    expect(await exportMyData({ fetchExport: () => Promise.resolve(body), save, web: false })).toBe(
      'failed',
    )
  })

  it('names the file the way the route does', () => {
    expect(DATA_EXPORT_FILE_NAME).toBe('langx-export.json')
  })
})

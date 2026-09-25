import type * as IdbKeyval from 'idb-keyval'
import { Platform } from 'react-native'
import { guardWrites, type ClosableStorage, type KeyValueStorage } from './queryPersistence'

/**
 * Where the persisted query cache is written.
 *
 * `expo-file-system` on a phone and IndexedDB in a browser, because the same
 * build serves both and neither API exists on the other side. The rules —
 * what is written, how much, under which key — are in `queryPersistence.ts`;
 * this file is only the writing, which is why it is separate: vitest cannot
 * load a module that reaches `Platform`.
 *
 * **The cache directory, not the document directory.** iOS may empty it when
 * the phone runs out of space and excludes it from backups, and both are the
 * right call for a copy of what the server holds. Echo's snapshot lives in
 * `Paths.document` because it holds grades not yet sent; nothing here is
 * irreplaceable.
 *
 * **IndexedDB rather than `localStorage`** on the web: a browser's local
 * storage is about five megabytes and a chat history is the thing most likely
 * to fill it. `idb-keyval`'s `get`/`set`/`del` are the persister's storage
 * interface as they are.
 *
 * Every function swallows its failures, as `echoStore` does. A phone with no
 * space left, a private-mode browser that refuses IndexedDB, a file half
 * written by a kill: none of that may stop the app, which merely loads the way
 * it did before any of this existed. Both modules are imported lazily for the
 * reason `localFlags.ts` gives — a native module resolved at module scope is
 * evaluated on the web too, and `idb-keyval` touches `indexedDB` on load.
 */
export function openQueryStorage(): ClosableStorage | null {
  const storage = Platform.OS === 'web' ? webStorage() : fileStorage()
  return storage ? guardWrites(storage) : null
}

/**
 * A database of its own rather than `idb-keyval`'s shared default, which any
 * other script on the origin may also open — and `clear()`. The type import
 * above is erased; the module itself is still only loaded here, on the web.
 */
type OpenIdb = { idb: typeof IdbKeyval; store: IdbKeyval.UseStore }
let idbStore: Promise<OpenIdb> | null = null
function openIdb(): Promise<OpenIdb> {
  idbStore ??= import('idb-keyval').then((idb) => ({
    idb,
    store: idb.createStore('langx-query-cache', 'queries'),
  }))
  return idbStore
}

function webStorage(): KeyValueStorage | null {
  // Also what keeps the static export honest: `expo export` renders the tree
  // in Node, where there is no IndexedDB and nothing to persist.
  if (typeof indexedDB === 'undefined') return null
  return {
    getItem: async (key) => {
      try {
        const { idb, store } = await openIdb()
        return (await idb.get<string>(key, store)) ?? null
      } catch {
        return null
      }
    },
    setItem: async (key, value) => {
      try {
        const { idb, store } = await openIdb()
        await idb.set(key, value, store)
      } catch {
        // A browser that will not store it loads from the network, as before.
      }
    },
    removeItem: async (key) => {
      try {
        const { idb, store } = await openIdb()
        await idb.del(key, store)
      } catch {
        // As above.
      }
    },
  }
}

function fileStorage(): KeyValueStorage {
  const open = async (key: string) => {
    const { File, Paths } = await import('expo-file-system')
    return new File(Paths.cache, `${key}.json`)
  }
  return {
    getItem: async (key) => {
      try {
        const file = await open(key)
        return file.exists ? await file.text() : null
      } catch {
        return null
      }
    },
    setItem: async (key, value) => {
      try {
        const file = await open(key)
        if (!file.exists) file.create({ overwrite: true })
        file.write(value)
      } catch {
        // Nothing here is worth an alert; the next launch fetches instead.
      }
    },
    removeItem: async (key) => {
      try {
        const file = await open(key)
        if (file.exists) file.delete()
      } catch {
        // As above.
      }
    },
  }
}

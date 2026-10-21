/**
 * "Export my data", end to end: fetch `GET /me/export` with the session, then
 * hand the JSON to the share sheet on a phone or to the browser's downloads on
 * the web.
 *
 * It used to open the route's URL instead — `Linking.openURL` on native,
 * `window.open` on the web. On a phone that is Safari or Chrome, which hold no
 * LangX session (native keeps it in SecureStore and attaches it per request,
 * see `apiFetch.ts`), so the API answered 401 to a browser that showed nothing
 * worth reading. The button looked dead. Going through our own client is the
 * only way the request carries the session on every platform.
 *
 * Kept free of native imports, with the fetch and the save passed in, so the
 * decision is testable under vitest, which cannot load `react-native`.
 */

export const DATA_EXPORT_PATH = '/me/export'

/** The same name the route's `content-disposition` gives the file. */
export const DATA_EXPORT_FILE_NAME = 'langx-export.json'

export const DATA_EXPORT_FILE_TYPE = { mimeType: 'application/json', uti: 'public.json' }

/**
 * Far longer than the client's ten-second default: the export walks every
 * collection that mentions the account, and a long-standing member has a lot
 * of messages. It is one deliberate tap, not a screen waiting on a query.
 */
export const DATA_EXPORT_TIMEOUT_MS = 60_000

/** `shared` = the share sheet opened; `downloaded` = the browser saved it. */
export type DataExportOutcome = 'shared' | 'downloaded' | 'failed'

export interface DataExportDeps {
  /** Resolves to the parsed body of `GET /me/export`, sent with the session. */
  fetchExport: () => Promise<unknown>
  /** `saveTextFile` from `saveFile.ts`: `false` when nothing could be opened. */
  save: (
    contents: string,
    name: string,
    type: { mimeType: string; uti: string },
  ) => Promise<boolean>
  web: boolean
}

export async function exportMyData(deps: DataExportDeps): Promise<DataExportOutcome> {
  let data: unknown
  try {
    data = await deps.fetchExport()
  } catch {
    return 'failed'
  }
  // Indented: the person reading this file is the account holder, not a parser.
  const contents = JSON.stringify(data, null, 2)
  const saved = await deps.save(contents, DATA_EXPORT_FILE_NAME, DATA_EXPORT_FILE_TYPE)
  if (!saved) return 'failed'
  return deps.web ? 'downloaded' : 'shared'
}

/**
 * The mark every email carries, as bytes rather than a link.
 *
 * It used to be `<img src="https://langx.io/…">`, and the logo was missing
 * from most inboxes: Outlook blocks remote images until somebody clicks
 * "download pictures", Apple Mail does the same with remote content off, and
 * the app's own file preview does too. An inline attachment referenced as
 * `cid:` is shown by all of them without asking, because it arrived with
 * the mail. `data:` URIs would have been simpler and Gmail strips them.
 *
 * The bytes are the 80×80 `website/static/email/logo.png`, inlined here
 * because the API ships as one bundled `dist/index.js` with no assets beside
 * it. Regenerate with:
 *   base64 -i ../../website/static/email/logo.png | fold -w 96
 *
 * `ResendEmailSender` attaches it to any message whose HTML references
 * `LOGO_SRC`; templates and campaign bodies only have to use that `src`.
 */
export const LOGO_CID = 'langx-logo'
export const LOGO_SRC = `cid:${LOGO_CID}`
export const LOGO_FILENAME = 'logo.png'

const LOGO_PNG_BASE64 =
  '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' +
  'Zy7b/wf1d1D4jPRExgAAAABJRU5ErkJggg=='

export function logoPng(): Buffer {
  return Buffer.from(LOGO_PNG_BASE64, 'base64')
}

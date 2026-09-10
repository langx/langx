import { GENERATED_AVATAR_BACKGROUNDS } from '@langx/shared'
import type { InlineAsset } from './inlineAssets'
import { inlineSrc } from './logo'

/**
 * Faces in an email, which is harder than it sounds.
 *
 * A profile photo lives on `media.langx.io`, and a remote `<img>` is exactly
 * what Outlook and a remote-content-off Apple Mail refuse to load — the
 * problem the rest of `inlineAssets.ts` exists to avoid. But a photo is per
 * recipient, so it cannot be a build-time constant: the bytes are fetched
 * when the mail is built and attached to that one message.
 *
 * The generated avatar is not an option here. It is an SVG, and Gmail drops
 * `<svg>` from mail bodies and will not render an `<img>` pointing at one
 * either — so somebody with no photo gets initials on a coloured disc drawn
 * in HTML, which needs no image at all and therefore cannot fail to render.
 *
 * A fetch that is slow, large or broken falls back to those initials. A
 * digest is worth sending without a face; it is not worth holding a
 * scheduler tick open for one.
 */

/** Nothing larger is worth putting in somebody's inbox for a 48px disc. */
const MAX_AVATAR_BYTES = 512 * 1024
const FETCH_TIMEOUT_MS = 4000

/** What mail clients render without complaint. Not SVG — see above. */
const ALLOWED_TYPES: Record<string, string> = {
  'image/jpeg': 'jpg',
  'image/png': 'png',
  'image/gif': 'gif',
  'image/webp': 'webp',
}

export interface AvatarFace {
  /** Shown under the face. */
  name: string
  /** Set when the photo was fetched; otherwise initials are drawn. */
  asset?: InlineAsset
  /** The account id, which is what picks the fallback colour. */
  seed: string
  /** Their profile. Absent for somebody whose handle we did not read. */
  url?: string
}

/**
 * The same four colours the generated avatars use, picked the same way — by
 * the id, so one person is one colour wherever they appear.
 */
function colourFor(seed: string): string {
  let sum = 0
  for (const character of seed) sum = (sum + character.charCodeAt(0)) % 997
  return `#${GENERATED_AVATAR_BACKGROUNDS[sum % GENERATED_AVATAR_BACKGROUNDS.length] ?? '3b6cf6'}`
}

/** One or two letters, from the display name a person chose. */
export function initialsOf(name: string): string {
  const words = name.trim().split(/\s+/).filter(Boolean)
  const letters = words.slice(0, 2).map((word) => [...word][0] ?? '')
  return letters.join('').toUpperCase() || '?'
}

/**
 * Fetches one avatar for inlining, or answers `null` and lets the caller draw
 * initials instead.
 *
 * `baseUrl` is the storage bucket's public address and the fetch is refused
 * for anything else: `avatarUrl` is checked against it when it is written
 * (`assertOwnBucket`), and checking again here means a row that predates that
 * rule cannot make this process fetch an arbitrary address.
 */
export async function fetchAvatarAsset(
  url: string,
  cid: string,
  baseUrl: string | undefined,
): Promise<InlineAsset | null> {
  if (!baseUrl || !url.startsWith(baseUrl)) return null
  try {
    const response = await fetch(url, { signal: AbortSignal.timeout(FETCH_TIMEOUT_MS) })
    if (!response.ok) return null
    const contentType = (response.headers.get('content-type') ?? '').split(';')[0]?.trim() ?? ''
    const extension = ALLOWED_TYPES[contentType]
    if (!extension) return null
    const bytes = Buffer.from(await response.arrayBuffer())
    if (bytes.byteLength === 0 || bytes.byteLength > MAX_AVATAR_BYTES) return null
    return { cid, filename: `${cid}.${extension}`, contentType, base64: bytes.toString('base64') }
  } catch {
    // A slow bucket, a 404, a body that was not an image: all the same answer.
    return null
  }
}

/**
 * A row of faces with names under them, and "+N" when there are more.
 *
 * Sized for a phone: three fit across the 536px content column with room to
 * spare, and the caller sends at most that many.
 */
export function facesRow(faces: AvatarFace[], more: number, dir: 'ltr' | 'rtl'): string {
  if (faces.length === 0) return ''
  const gap = dir === 'rtl' ? 'padding-left' : 'padding-right'
  const cells = faces.map((face) => {
    const initials = initialsOf(face.name)
    const picture = face.asset
      ? `<img src="${inlineSrc(face.asset.cid)}" width="56" height="56" alt="" border="0" style="display:block; width:56px; height:56px; border-radius:28px;" />`
      : `<table role="presentation" cellpadding="0" cellspacing="0" border="0" width="56" style="width:56px;">
                    <tr>
                      <td align="center" valign="middle" height="56" bgcolor="${colourFor(face.seed)}" style="width:56px; height:56px; border-radius:28px; background-color:${colourFor(face.seed)}; font-family:Nunito, Arial, Helvetica, sans-serif; font-size:20px; font-weight:800; color:#ffffff;">${initials}</td>
                    </tr>
                  </table>`
    const label = `<div style="padding-top:8px; font-family:Arial, Helvetica, sans-serif; font-size:13px; line-height:18px; color:#62676d; word-break:break-word;">${face.name}</div>`
    // The whole cell is the link, picture and name together — a 56px disc is
    // a small target on a phone and the name doubles it.
    const inner = face.url
      ? `<a href="${encodeURI(face.url)}" target="_blank" style="text-decoration:none; color:#62676d;">${picture}${label}</a>`
      : `${picture}${label}`
    return `<td width="72" valign="top" align="center" style="${gap}:16px;">
                  ${inner}
                </td>`
  })
  if (more > 0) {
    cells.push(`<td width="72" valign="top" align="center">
                  <table role="presentation" cellpadding="0" cellspacing="0" border="0" width="56" style="width:56px;">
                    <tr>
                      <td align="center" valign="middle" height="56" bgcolor="#e8eaec" style="width:56px; height:56px; border-radius:28px; background-color:#e8eaec; font-family:Nunito, Arial, Helvetica, sans-serif; font-size:18px; font-weight:800; color:#62676d;">+${more}</td>
                    </tr>
                  </table>
                </td>`)
  }
  return `<table role="presentation" cellpadding="0" cellspacing="0" border="0" dir="${dir}" style="margin-top:20px;">
              <tr>
                ${cells.join('\n                ')}
              </tr>
            </table>`
}

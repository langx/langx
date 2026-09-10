/**
 * The little HTML pages this API renders for whoever reads the support
 * mailbox — paying a bounty, deciding a report.
 *
 * **English, and no locale anywhere near it.** Every other page and mail this
 * service produces is read by the person it is about; these two are read by
 * us. Shared between `feedback.ts` and `moderation.ts` so the second one did
 * not arrive as a copy of the first with a different heading.
 */

/** The person a decision is about, as whoever is deciding would recognise them. */
export function who(handle: string | null | undefined, userId: string): string {
  return handle ? `@${handle}` : userId
}

export function escapeHtml(value: string): string {
  return value.replace(/[&<>"']/g, (c) => `&#${c.charCodeAt(0)};`)
}

export function page(title: string, bodyHtml: string): string {
  return `<!doctype html>
<html lang="en">
  <head><meta charset="utf-8" /><meta name="viewport" content="width=device-width, initial-scale=1" />
  <title>${escapeHtml(title)}</title></head>
  <body style="font-family: -apple-system, system-ui, sans-serif; color:#111; background:#f7f7f7; padding:24px;">
    <div style="max-width:480px; margin:0 auto; background:#fff; border-radius:12px; padding:32px;">
      <h1 style="font-size:18px;margin:0 0 16px;">${escapeHtml(title)}</h1>
      ${bodyHtml.trimStart().startsWith('<') ? bodyHtml : `<p>${bodyHtml}</p>`}
    </div>
  </body>
</html>`
}

export function html(
  reply: { type: (value: string) => { send: (body: string) => unknown } },
  body: string,
) {
  return reply.type('text/html; charset=utf-8').send(body)
}

/** The one committing button these pages have, in the app's own primary. */
export function submitButton(label: string): string {
  return `<button type="submit" style="background:#111;color:#fff;border:0;border-radius:8px;padding:12px 20px;font-weight:600;font-size:15px;cursor:pointer;">${escapeHtml(label)}</button>`
}

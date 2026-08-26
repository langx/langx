/**
 * Plain HTML, no @react-email dependency — Resend's `react` option is only
 * needed if you hand it a component, and one extra rendering dependency buys
 * nothing for two short transactional emails.
 */
function wrap(preheader: string, bodyHtml: string): string {
  return `<!doctype html>
<html>
  <body style="font-family: -apple-system, system-ui, sans-serif; color: #111; background: #f7f7f7; padding: 24px;">
    <span style="display:none">${preheader}</span>
    <div style="max-width: 480px; margin: 0 auto; background: #fff; border-radius: 12px; padding: 32px;">
      <h1 style="font-size: 20px; margin: 0 0 16px;">LangX</h1>
      ${bodyHtml}
      <p style="color: #888; font-size: 12px; margin-top: 32px;">
        If you didn't request this, you can ignore this email.
      </p>
    </div>
  </body>
</html>`
}

function button(url: string, label: string): string {
  return `<a href="${url}" style="display:inline-block; background:#111; color:#fff; text-decoration:none; padding:12px 20px; border-radius:8px; font-weight:600;">${label}</a>`
}

export function verificationEmail(url: string): { subject: string; html: string; text: string } {
  return {
    subject: 'Verify your LangX email',
    html: wrap(
      'Verify your email to finish setting up LangX',
      `<p>Confirm this is your email address to finish setting up your account.</p>
       <p>${button(url, 'Verify email')}</p>
       <p style="font-size: 12px; color: #888;">Or paste this link: ${url}</p>`,
    ),
    text: `Verify your LangX email: ${url}`,
  }
}

export function resetPasswordEmail(url: string): { subject: string; html: string; text: string } {
  return {
    subject: 'Reset your LangX password',
    html: wrap(
      'Reset your LangX password',
      `<p>Someone requested a password reset for this account. If that was you:</p>
       <p>${button(url, 'Reset password')}</p>
       <p style="font-size: 12px; color: #888;">Or paste this link: ${url}</p>`,
    ),
    text: `Reset your LangX password: ${url}`,
  }
}

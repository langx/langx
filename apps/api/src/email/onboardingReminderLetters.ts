import type { ReminderVariant } from '../modules/notifications/onboardingReminder'

/**
 * The two letters the onboarding reminder sends, and the one place they live.
 *
 * They were files under `scripts/letters/` while this was only ever run by
 * hand. A scheduled pass cannot read those: production runs `node
 * dist/index.js` and `scripts/` is not in the image — so the bodies are here,
 * compiled in, and the script now takes them from here too. One copy, because
 * two would drift and only one of them would be the one people receive.
 *
 * **English only, on purpose.** Every other notification mail goes through
 * `templates.ts` and `translator(locale)`, and that would be the house style
 * here too — except `localeFor` answers English for every single person in
 * this cohort, and says why in its own words: it returns `null` "when there is
 * no profile yet — an account is seconds old at sign-up and onboarding is
 * where the languages are picked". Not having finished onboarding *is* the
 * definition of this audience. Eight locales would be sixteen translations
 * that nothing could ever select.
 *
 * `{{unsubscribeUrl}}` is substituted by the sender, in both bodies, the same
 * way `send-campaign.ts` does it.
 */
export interface Letter {
  subject: string
  html: string
  text: string
}

export const ONBOARDING_LETTERS: Record<ReminderVariant, Letter> = {
  reminder: {
    subject: 'Finish setting up your profile',
    html: `<!doctype html>
<html lang="en" dir="ltr">
  <head>
    <meta charset="utf-8" />
    <link
      rel="stylesheet"
      href="https://fonts.googleapis.com/css2?family=Nunito:wght@700;800&display=swap"
    />
  </head>
  <body
    style="
      margin: 0;
      padding: 32px 16px;
      background: #f4f5f7;
      font-family: -apple-system, 'Segoe UI', Roboto, system-ui, sans-serif;
    "
  >
    <span style="display: none; overflow: hidden; line-height: 0; max-height: 0; opacity: 0"
      >Your languages, your level and a username — about a minute.</span
    >
    <table
      role="presentation"
      width="100%"
      cellpadding="0"
      cellspacing="0"
      style="max-width: 480px; margin: 0 auto"
    >
      <tr>
        <td style="padding: 0 4px 20px; text-align: left">
          <span
            style="
              font-family:
                'Nunito',
                -apple-system,
                'Segoe UI',
                Roboto,
                system-ui,
                sans-serif;
              font-size: 20px;
              font-weight: 800;
              letter-spacing: -0.02em;
              color: #111827;
            "
          >
            <img
              src="https://langx.io/favicons/favicon-32x32.png"
              width="20"
              height="20"
              alt=""
              style="vertical-align: middle; margin-right: 8px"
            />LangX</span
          >
        </td>
      </tr>
      <tr>
        <td
          style="
            background: #ffffff;
            border: 1px solid #e7e9ec;
            border-radius: 16px;
            padding: 32px;
            text-align: left;
            font-size: 15px;
            line-height: 1.6;
            color: #111827;
          "
        >
          <p
            style="
              margin: 0 0 16px;
              font-family:
                'Nunito',
                -apple-system,
                'Segoe UI',
                Roboto,
                system-ui,
                sans-serif;
              font-size: 20px;
              font-weight: 800;
              letter-spacing: -0.02em;
            "
          >
            Finish setting up your profile
          </p>
          <p style="margin: 0 0 16px">
            You opened a LangX account but never finished setting up your profile — so there is
            nothing on it yet, and nobody learning your language can find you.
          </p>
          <p style="margin: 0 0 16px">
            It takes about a minute: the languages you speak, the one you are learning and roughly
            how far along you are, and a username.
          </p>
          <p style="margin: 20px 0 0">
            <a
              href="https://app.langx.io"
              style="
                display: inline-block;
                background: #ffc409;
                color: #201900;
                text-decoration: none;
                padding: 13px 22px;
                border-radius: 10px;
                font-family:
                  'Nunito',
                  -apple-system,
                  'Segoe UI',
                  Roboto,
                  system-ui,
                  sans-serif;
                font-weight: 700;
                font-size: 15px;
              "
              >Finish setting up</a
            >
          </p>
          <p style="margin: 20px 0 0">
            Sign in the way you signed up and you will land back where you left off. If that does
            not get you in, ask for a
            <a href="https://app.langx.io/sign-in-link" style="color: #111827">sign-in link</a>
            instead.
          </p>
        </td>
      </tr>
      <tr>
        <td
          style="
            padding: 20px 4px 0;
            text-align: left;
            font-size: 12px;
            line-height: 1.6;
            color: #9aa1a9;
          "
        >
          You are getting this once, because you started an account and did not finish it. If you
          have changed your mind, ignore it — there is no second one.<br />
          <a href="{{unsubscribeUrl}}" style="color: #9aa1a9">Unsubscribe</a>
        </td>
      </tr>
    </table>
  </body>
</html>
`,
    text: `Finish setting up your profile

You opened a LangX account but never finished setting up your profile — so
there is nothing on it yet, and nobody learning your language can find you.

It takes about a minute: the languages you speak, the one you are learning
and roughly how far along you are, and a username.

Finish setting up: https://app.langx.io

Sign in the way you signed up and you will land back where you left off.
If that does not get you in, ask for a sign-in link instead:
https://app.langx.io/sign-in-link

--
You are getting this once, because you started an account and did not finish
it. If you have changed your mind, ignore it — there is no second one.
Unsubscribe: {{unsubscribeUrl}}
`,
  },
  confirm: {
    subject: 'Confirm your address to get in',
    html: `<!doctype html>
<html lang="en" dir="ltr">
  <head>
    <meta charset="utf-8" />
    <link
      rel="stylesheet"
      href="https://fonts.googleapis.com/css2?family=Nunito:wght@700;800&display=swap"
    />
  </head>
  <body
    style="
      margin: 0;
      padding: 32px 16px;
      background: #f4f5f7;
      font-family: -apple-system, 'Segoe UI', Roboto, system-ui, sans-serif;
    "
  >
    <span style="display: none; overflow: hidden; line-height: 0; max-height: 0; opacity: 0"
      >Confirm your address and you are in — about a minute after that.</span
    >
    <table
      role="presentation"
      width="100%"
      cellpadding="0"
      cellspacing="0"
      style="max-width: 480px; margin: 0 auto"
    >
      <tr>
        <td style="padding: 0 4px 20px; text-align: left">
          <span
            style="
              font-family:
                'Nunito',
                -apple-system,
                'Segoe UI',
                Roboto,
                system-ui,
                sans-serif;
              font-size: 20px;
              font-weight: 800;
              letter-spacing: -0.02em;
              color: #111827;
            "
          >
            <img
              src="https://langx.io/favicons/favicon-32x32.png"
              width="20"
              height="20"
              alt=""
              style="vertical-align: middle; margin-right: 8px"
            />LangX</span
          >
        </td>
      </tr>
      <tr>
        <td
          style="
            background: #ffffff;
            border: 1px solid #e7e9ec;
            border-radius: 16px;
            padding: 32px;
            text-align: left;
            font-size: 15px;
            line-height: 1.6;
            color: #111827;
          "
        >
          <p
            style="
              margin: 0 0 16px;
              font-family:
                'Nunito',
                -apple-system,
                'Segoe UI',
                Roboto,
                system-ui,
                sans-serif;
              font-size: 20px;
              font-weight: 800;
              letter-spacing: -0.02em;
            "
          >
            Confirm your address to get in
          </p>
          <p style="margin: 0 0 16px">
            You opened a LangX account with this address, but it was never confirmed — so the
            account has been sitting there unopened, and signing in will not let you through yet.
          </p>
          <p style="margin: 0 0 16px">
            Ask for a sign-in link below and it will confirm the address and let you in at the same
            time. Setting up the profile afterwards takes about a minute: the languages you speak,
            the one you are learning, and a username.
          </p>
          <p style="margin: 20px 0 0">
            <a
              href="https://app.langx.io/sign-in-link"
              style="
                display: inline-block;
                background: #ffc409;
                color: #201900;
                text-decoration: none;
                padding: 13px 22px;
                border-radius: 10px;
                font-family:
                  'Nunito',
                  -apple-system,
                  'Segoe UI',
                  Roboto,
                  system-ui,
                  sans-serif;
                font-weight: 700;
                font-size: 15px;
              "
              >Send me a sign-in link</a
            >
          </p>
          <p style="margin: 20px 0 0">
            If you never meant to open an account, do nothing at all — an unconfirmed address is
            never written to and never mailed again.
          </p>
        </td>
      </tr>
      <tr>
        <td
          style="
            padding: 20px 4px 0;
            text-align: left;
            font-size: 12px;
            line-height: 1.6;
            color: #9aa1a9;
          "
        >
          You are getting this once, because an account was opened with this address and never
          confirmed. If that was not you, ignore it — there is no second one.<br />
          <a href="{{unsubscribeUrl}}" style="color: #9aa1a9">Unsubscribe</a>
        </td>
      </tr>
    </table>
  </body>
</html>
`,
    text: `Confirm your address to get in

You opened a LangX account with this address, but it was never confirmed — so
the account has been sitting there unopened, and signing in will not let you
through yet.

Ask for a sign-in link and it will confirm the address and let you in at the
same time. Setting up the profile afterwards takes about a minute: the
languages you speak, the one you are learning, and a username.

Send me a sign-in link: https://app.langx.io/sign-in-link

If you never meant to open an account, do nothing at all — an unconfirmed
address is never written to and never mailed again.

--
You are getting this once, because an account was opened with this address and
never confirmed. If that was not you, ignore it — there is no second one.
Unsubscribe: {{unsubscribeUrl}}
`,
  },
}

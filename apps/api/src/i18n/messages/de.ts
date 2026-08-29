import type { Localized } from '@langx/shared'
import type { ServerMessages } from './en'

export const de: Localized<ServerMessages> = {
  push: {
    streakTitle: { one: '{count} Tag Serie! 🔥', other: '{count} Tage Serie! 🔥' },
    streakBody: 'Schick heute eine Nachricht, damit sie weiterläuft.',
  },

  email: {
    ignore: 'Wenn du das nicht angefordert hast, kannst du diese E-Mail ignorieren.',
    orPaste: 'Oder füge diesen Link ein: {url}',

    verifySubject: 'Bestätige deine LangX-E-Mail',
    verifyPreheader: 'Bestätige deine E-Mail, um LangX fertig einzurichten',
    verifyBody: 'Bestätige, dass dies deine E-Mail-Adresse ist, um dein Konto fertig einzurichten.',
    verifyButton: 'E-Mail bestätigen',
    verifyText: 'Bestätige deine LangX-E-Mail: {url}',

    resetSubject: 'Setze dein LangX-Passwort zurück',
    resetPreheader: 'Setze dein LangX-Passwort zurück',
    resetBody:
      'Jemand hat für dieses Konto eine Passwortzurücksetzung angefordert. Wenn du das warst:',
    resetButton: 'Passwort zurücksetzen',
    resetText: 'Setze dein LangX-Passwort zurück: {url}',
  },
}

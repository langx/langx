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

    whyThisMail: 'Du bekommst das wegen deiner LangX-Benachrichtigungseinstellungen.',
    unsubscribeLink: 'Diese E-Mails abstellen',
    unsubscribeText: 'Diese E-Mails abstellen: {url}',
    managePrefs: 'Alle Benachrichtigungseinstellungen',
    /** The one button a streak email has. */
    openChats: 'Nachricht senden',

    unsubscribeTitle: 'Diese E-Mails abstellen?',
    unsubscribeBody:
      '{kind} bekommst du dann nicht mehr per E-Mail. Mitteilungen auf dem Telefon bleiben davon unberührt.',
    unsubscribeConfirm: 'Abstellen',
    unsubscribeAll: 'Oder jede E-Mail von LangX abstellen',
    unsubscribedTitle: 'Erledigt — nichts mehr davon.',
    unsubscribedBody:
      'Du kannst sie jederzeit in LangX unter Einstellungen → Mitteilungen wieder einschalten.',
    unsubscribeInvalid:
      'Dieser Link ist ungültig. Öffne LangX und ändere es unter Einstellungen → Mitteilungen.',

    kind: {
      messages: 'Nachrichtenübersichten',
      streak: 'Streak-Erinnerungen',
      profileVisits: 'Übersichten zu Profilbesuchen',
      promotions: 'Neues und Angebote',
      all: 'E-Mails von LangX',
    },
  },
}

import type { Localized } from '@langx/shared'
import type { ServerMessages } from './en'

export const de: Localized<ServerMessages> = {
  push: {
    streakTitle: { one: '{count} Tag Serie! 🔥', other: '{count} Tage Serie! 🔥' },
    streakBody: 'Schick heute eine Nachricht, damit sie weiterläuft.',
    profileVisitsTitle: {
      one: '1 Person hat dein Profil angesehen',
      other: '{count} Personen haben dein Profil angesehen',
    },
    profileVisitsBody: 'Tippe, um zu sehen, wer.',
    badgeOneTitle: 'Neues Abzeichen: {label} 🏅',
    badgeManyTitle: {
      one: 'Du hast 1 neues Abzeichen 🏅',
      other: 'Du hast {count} neue Abzeichen 🏅',
    },
    badgeBody: 'Stark. Weiter so.',
    meetingTitle: 'Dein Sprachaustausch ist in einer Stunde',
    meetingBody: 'Tippe, um das Gespräch zu öffnen.',
    bountyTitle: {
      one: '{count} Token für deinen Hinweis 🎉',
      other: '{count} Token für deinen Hinweis 🎉',
    },
    bountyBody: 'Wir haben gelesen, was du geschickt hast – es hat sich gelohnt.',
  },

  email: {
    ignore: 'Wenn du das nicht angefordert hast, kannst du diese E-Mail ignorieren.',
    orPaste: 'Oder füge diesen Link ein: {url}',

    deleteSubject: 'Bestätige die Löschung deines LangX-Kontos',
    deletePreheader: 'Ein letzter Schritt, um dein LangX-Konto zu löschen',
    deleteBody:
      'Du hast die Löschung deines LangX-Kontos angefordert. Bestätige unten, dann wird es zur Löschung vorgemerkt — du hast 30 Tage, es dir anders zu überlegen: melde dich einfach wieder an.',
    deleteButton: 'Mein Konto löschen',
    deleteText: 'Bestätige die Löschung deines LangX-Kontos: {url}',
    deleteInvalid: 'Dieser Link ist abgelaufen oder wurde bereits verwendet.',
    deleteConfirmTitle: 'LangX-Konto löschen',
    deleteConfirmBody:
      'Damit wird dein Konto zur Löschung vorgemerkt. Eine Anmeldung binnen 30 Tagen bricht das ab.',
    deleteConfirmButton: 'Ja, mein Konto löschen',
    deleteDoneTitle: 'Dein Konto ist zur Löschung vorgemerkt',
    deleteDoneBody: 'Melde dich binnen {days} Tagen an, und alles ist wieder da.',
    deleteDonePurge: 'Die Daten werden am {date} entfernt.',

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
    magicLinkSubject: 'Dein LangX-Anmeldelink',
    magicLinkPreheader: 'Tippe, um dich bei LangX anzumelden',
    magicLinkBody:
      'Tippe auf den Button, um dich anzumelden. Der Link funktioniert einmal und läuft in 15 Minuten ab.',
    magicLinkButton: 'Bei LangX anmelden',
    magicLinkText: 'Bei LangX anmelden (einmal gültig, läuft in 15 Minuten ab): {url}',

    existingSubject: 'Du hast bereits ein LangX-Konto',
    existingPreheader: 'Du hast bereits ein LangX-Konto',
    existingBody:
      'Jemand hat versucht, sich mit dieser E-Mail zu registrieren, aber dafür gibt es bereits ein Konto. Setze dein Passwort zurück oder melde dich mit Google oder Apple über diese Adresse an.',
    existingButton: 'Passwort zurücksetzen',
    existingText: 'Du hast bereits ein LangX-Konto. Setze dein Passwort hier zurück: {url}',

    existingLinkBody:
      'Jemand hat versucht, sich mit dieser E-Mail zu registrieren, aber du hast hier bereits ein Konto, mit deinem Profil darauf. Tippe, um dich anzumelden — es gibt kein Passwort zu merken. Der Link funktioniert einmal und läuft in 15 Minuten ab.',
    existingLinkText:
      'Du hast bereits ein LangX-Konto. Melde dich hier an (einmal gültig, läuft in 15 Minuten ab): {url}',

    whyThisMail: 'Du bekommst das wegen deiner LangX-Benachrichtigungseinstellungen.',
    unsubscribeLink: 'Diese E-Mails abstellen',
    unsubscribeText: 'Diese E-Mails abstellen: {url}',
    managePrefs: 'Alle Benachrichtigungseinstellungen',
    /** The dark panel under every mail: the QR to get.langx.io. */
    getApp: 'Hol dir die App',
    getAppScan: 'Scanne mit deinem Handy oder öffne',
    getAppPlatforms: 'iPhone · Android · Browser',
    /** The one button a streak email has. */
    openChats: 'Nachricht senden',

    digestSubject: {
      one: '1 ungelesene Nachricht auf LangX',
      other: '{count} ungelesene Nachrichten auf LangX',
    },
    digestPreheader: 'Da wartet jemand auf deine Antwort',
    digestBody: {
      one: '{names} hat dir geschrieben, während du weg warst.',
      other: 'Du hast {count} ungelesene Nachrichten, von {names}.',
    },
    digestMore: {
      one: 'Und eine weitere Unterhaltung.',
      other: 'Und {count} weitere Unterhaltungen.',
    },
    digestButton: 'Lesen und antworten',

    visitsSubject: {
      one: 'Diese Woche hat 1 Person dein Profil angesehen',
      other: 'Diese Woche haben {count} Personen dein Profil angesehen',
    },
    visitsPreheader: 'Dein Profil bekommt Aufmerksamkeit',
    visitsBody: {
      one: 'In der letzten Woche hat 1 Person dein Profil angesehen.',
      other: 'In der letzten Woche haben {count} Personen dein Profil angesehen.',
    },
    visitsNames: 'Darunter: {names}.',
    visitsLocked: 'Upgrade, um zu sehen, wer es war.',
    visitsButton: 'Ansehen, wer da war',

    badgeOneSubject: 'Neues Abzeichen: {label}',
    badgeManySubject: { one: 'Du hast 1 neues Abzeichen', other: 'Du hast {count} neue Abzeichen' },
    badgeBody: 'Es steht jetzt in deinem Profil, für alle sichtbar.',
    badgeButton: 'Abzeichen ansehen',

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
      v1contact: 'die eine Nachricht über das neue LangX',
    },
    bountySubject: {
      one: 'Du hast {count} Token für deinen Hinweis bekommen',
      other: 'Du hast {count} Token für deinen Hinweis bekommen',
    },
    bountyPreheader: 'Danke, dass du es uns gesagt hast.',
    bountyBody: {
      one: 'Wir haben deinen Hinweis gelesen und dir {count} Token gutgeschrieben. So wird diese App besser – danke.',
      other:
        'Wir haben deinen Hinweis gelesen und dir {count} Token gutgeschrieben. So wird diese App besser – danke.',
    },
    bountyButton: 'Geldbörse öffnen',
    bountyText: {
      one: 'Für deinen Hinweis wurden dir {count} Token gutgeschrieben: {url}',
      other: 'Für deinen Hinweis wurden dir {count} Token gutgeschrieben: {url}',
    },
  },
}

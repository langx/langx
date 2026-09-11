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
    /** The same nudges on the phone, under the same switches. */
    promo: {
      addPhotoTitle: 'Füge ein Foto hinzu',
      addPhotoBody: 'Profile mit Gesicht bekommen mehr Antworten.',
      streakBrokeTitle: {
        one: 'Deine {count}-Tage-Serie ist gerissen',
        other: 'Deine {count}-Tage-Serie ist gerissen',
      },
      streakBrokeBody: 'Eine Reparatur holt gestern zurück.',
      awayTitle: 'Die Leute sind noch da',
      awayBody: 'Neue Leute zum Üben.',
      awayLongTitle: 'Wir sind da, wenn du willst',
      awayLongBody: 'Deine Serie und deine Token warten.',
      limitReachedTitle: 'Du stößt immer wieder an die Limits',
      limitReachedBody: 'Ein Tarif hebt sie auf.',
      trialEndingTitle: 'Deine Gratiswoche endet in zwei Tagen',
      trialEndingBody: 'Behalten ist ein Tipp.',
      winBackTitle: 'Dein Tarif ist ausgelaufen',
      winBackBody: 'Alles, was du erstellt hast, ist noch da.',
      tokensWaitingTitle: { one: '{count} Token wartet', other: '{count} Token warten' },
      tokensWaitingBody: 'Öffne dein Wallet.',
      inviteFriendTitle: 'Lade jemanden ein',
      inviteFriendBody: 'Ihr bekommt beide Token.',
    },

    /** The feed reacting to something somebody left in it. */

    social: {
      followTitle: '{name} folgt dir jetzt',

      followBody: 'Tippe, um das Profil zu sehen.',

      correctionTitle: '{name} hat deinen Satz korrigiert',

      correctionBody: 'Tippe, um die Korrektur zu lesen.',

      answerTitle: '{name} hat deinen Satz aufgenommen',

      answerBody: 'Tippe zum Anhören.',

      commentTitle: '{name} hat deinen Beitrag kommentiert',

      commentBody: 'Tippe, um ihn zu lesen.',

      likesTitle: { one: 'Dein Beitrag hat 1 Like', other: 'Dein Beitrag hat {count} Likes' },

      likesBody: 'Jemandem gefällt, was du geschrieben hast.',
    },

    /** Tokens arriving. */

    wallet: {
      poolTitle: {
        one: 'Die gestrige Ausschüttung brachte dir 1 Token',
        other: 'Die gestrige Ausschüttung brachte dir {count} Token',
      },

      poolBody: 'Tippe, um dein Wallet zu öffnen.',

      giftTitle: 'Dein stündliches Geschenk ist bereit',

      giftBody: 'Öffne das Wallet und hol es dir.',
    },

    /** Security, which no preference can switch off. */
    /** Billing, which no preference gates either. */
    billingFailedTitle: 'Deine Zahlung ist fehlgeschlagen',
    billingEndedTitle: 'Dein Tarif ist beendet',
    billingBody: 'Tippe, um deinen Tarif zu prüfen.',
    securityBody: 'Öffne LangX, falls du das nicht warst.',
    securityBodyDevice: 'Von {device}. Öffne LangX, falls du das nicht warst.',
    security: {
      newSignInTitle: 'Neue Anmeldung bei deinem Konto',
      passwordChangedTitle: 'Dein Passwort wurde geändert',
      methodLinkedTitle: 'Anmeldemethode hinzugefügt',
      methodUnlinkedTitle: 'Anmeldemethode entfernt',
    },
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

    /** The monthly recap. Two halves: the reader's numbers and everybody's. */

    newsletterSubject: 'Dein {month} bei LangX',

    newsletterPreheader: 'Der Monat in Zahlen — deine und die aller',

    newsletterYours: 'Dein Monat',

    newsletterEverybody: 'Der Monat aller',

    newsletterQuiet:
      'Du warst diesen Monat still — keine Nachrichten, keine Korrekturen. Die Leute unten waren es nicht, und sie sind noch da.',

    newsletterMessages: 'Gesendete Nachrichten',

    newsletterCorrections: 'Gegebene Korrekturen',

    newsletterTokens: 'Verdiente Token',

    newsletterStreak: 'Serie heute',

    newsletterNewMembers: 'Neue Mitglieder',

    newsletterMessagesSent: 'Gesendete Nachrichten',

    newsletterCorrectionsMade: 'Gemachte Korrekturen',

    newsletterButton: 'LangX öffnen',

    /** The day's replies to somebody's posts, in one letter. */

    feedDigestSubject: {
      one: '1 Antwort auf deinen Beitrag heute',
      other: '{count} Antworten auf deine Beiträge heute',
    },

    feedDigestPreheader: 'Man hat auf deine Beiträge geantwortet',

    feedDigestBody: {
      one: 'Jemand hat heute auf einen deiner Sätze geantwortet.',
      other: '{count} Leute haben heute auf deine Sätze geantwortet.',
    },

    feedDigestCorrections: { one: '1 Korrektur', other: '{count} Korrekturen' },

    feedDigestAnswers: { one: '1 Aufnahme', other: '{count} Aufnahmen' },

    feedDigestComments: { one: '1 Kommentar', other: '{count} Kommentare' },

    feedDigestMore: { one: 'Und 1 weiterer Beitrag.', other: 'Und {count} weitere Beiträge.' },

    feedDigestButton: 'Antworten lesen',

    /**

     * The nudges in `modules/notifications/promotions.ts`, in its order.

     * Every one of them is behind a switch and carries a way out.

     */

    promo: {
      addPhotoSubject: 'Füge ein Foto hinzu, damit man dich findet',

      addPhotoBody:
        'Profile mit Gesicht bekommen deutlich mehr Antworten. Es dauert zehn Sekunden und du kannst es jederzeit ändern.',

      addPhotoButton: 'Foto hinzufügen',

      streakBrokeSubject: {
        one: 'Deine {count}-Tage-Serie ist gerissen',
        other: 'Deine {count}-Tage-Serie ist gerissen',
      },

      streakBrokeBody:
        'Gestern hat gefehlt. Eine Reparatur aus dem Store setzt den Tag zurück und die Serie läuft weiter.',

      streakBrokeButton: 'Gestern reparieren',

      awaySubject: 'Es wird weiter geübt, auch ohne dich',

      awayBody:
        'Eine Woche ist vergangen. Es gibt neue Leute zum Reden, und deine Sprachen sind dieselben.',

      awayButton: 'Schauen, wer da ist',

      awayLongSubject: 'Danach schreiben wir nicht mehr',

      awayLongBody:
        'Ein Monat ist lang. Dein Konto, deine Serie und deine Token sind noch da, falls du sie willst — und das ist das Letzte, was wir dazu sagen.',

      awayLongButton: 'LangX öffnen',

      limitReachedSubject: 'Du stößt an die kostenlosen Limits',

      limitReachedBody:
        'Du hast in den letzten Tagen dreimal ein Tageslimit erreicht. Ein Tarif hebt sie auf — mehr Gespräche, mehr Übersetzungen, mehr Anhänge, jeden Tag.',

      limitReachedButton: 'Tarife ansehen',

      trialEndingSubject: 'Deine Gratiswoche endet in zwei Tagen',

      trialEndingBody:
        'Danach fällt dein Konto auf den kostenlosen Tarif zurück. Alles, was du erstellt hast, bleibt; die Limits kommen wieder. Behalten ist ein Tipp.',

      trialEndingButton: 'Tarif behalten',

      winBackSubject: 'Dein Tarif ist vor einer Woche ausgelaufen',

      winBackBody:
        'Nichts wurde weggenommen — deine Serie, deine Token und alles Geschriebene liegen, wo du sie gelassen hast. Aufgehört haben nur die bezahlten Limits.',

      winBackButton: 'Tarife ansehen',

      tokensWaitingSubject: {
        one: '{count} Token wartet auf dich',
        other: '{count} Token warten auf dich',
      },

      tokensWaitingBody:
        'Token kaufen Streak-Freezes, Tagesreparaturen, Rahmen und Titel. Deine liegen seit zwei Wochen da.',

      tokensWaitingButton: 'Wallet öffnen',

      inviteFriendSubject: 'Zu zweit übt es sich besser',

      inviteFriendBody:
        'Lade jemanden ein — ihr bekommt beide Token, wenn er dazukommt. Dein Einladungslink steht in den Einstellungen.',

      inviteFriendButton: 'Einladungslink holen',
    },

    /** Onboarding finished: one mail, once in an account's life. */

    welcomeSubject: 'Willkommen bei LangX',

    welcomePreheader: 'Dein erstes Gespräch ist einen Tipp entfernt',

    welcomeTitle: 'Willkommen, {name}',

    welcomeBody: 'Dein Profil ist unter {handle} online. Das machen die meisten zuerst:',

    welcomeStep1: 'Finde jemanden, der deine Lernsprache spricht, und sag Hallo.',

    welcomeStep2: 'Poste einen Satz im Feed und lass ihn korrigieren.',

    welcomeStep3: 'Komm morgen wieder — zwei Tage hintereinander starten eine Serie.',

    welcomeButton: 'Jemanden zum Üben finden',

    /** A day later, for an address nobody confirmed. */

    verifyReminderSubject: 'Bestätige deine E-Mail-Adresse',

    verifyReminderPreheader: 'Ein Tipp und dein Konto ist bereit',

    verifyReminderBody:
      'Deinem LangX-Konto fehlt nur eines: der Nachweis, dass diese Adresse dir gehört. Der Link unten erledigt das.',

    verifyReminderText: 'Bestätige deine E-Mail-Adresse: {url}',

    /** Money, so no switch — see `billingEmail`. */

    billingPlan: 'Tarif: {tier}',

    billing: {
      paymentFailedTitle: 'Deine LangX-Zahlung ist fehlgeschlagen',

      paymentFailedBody:
        'Der Store konnte die Zahlung für dein Abo nicht einziehen. Er versucht es erneut; dein Tarif bleibt vorerst aktiv.',

      paymentFailedButton: 'Meinen Tarif prüfen',

      planEndedTitle: 'Dein LangX-Tarif ist beendet',

      planEndedBody:
        'Dein Abo ist beendet und dein Konto ist zurück im kostenlosen Tarif. Alles, was du erstellt hast, ist noch da.',

      planEndedButton: 'Tarife ansehen',
    },

    /**

     * The security notices. No switch behind them and no unsubscribe —

     * see `modules/security/notify.ts`.

     */

    securityDevice: 'Gerät',

    securityPlace: 'Ort',

    securityWhen: 'Zeitpunkt',

    securityNotYou:
      'Warst du das nicht, ändere sofort dein Passwort — das meldet alle anderen Geräte ab.',

    securityButton: 'Passwort ändern',

    security: {
      newSignInTitle: 'Neue Anmeldung bei deinem LangX-Konto',

      newSignInBody: 'Jemand hat sich von einem uns unbekannten Gerät bei deinem Konto angemeldet.',

      passwordChangedTitle: 'Dein LangX-Passwort wurde geändert',

      passwordChangedBody: 'Das Passwort deines Kontos wurde soeben geändert.',

      methodLinkedTitle: 'Deinem LangX-Konto wurde eine Anmeldemethode hinzugefügt',

      methodLinkedBody: 'Die Anmeldung mit Google oder Apple wurde mit deinem Konto verbunden.',

      methodUnlinkedTitle: 'Aus deinem LangX-Konto wurde eine Anmeldemethode entfernt',

      methodUnlinkedBody: 'Eine Möglichkeit, dich anzumelden, wurde entfernt.',
    },

    kind: {
      messages: 'Nachrichtenübersichten',
      streak: 'Streak-Erinnerungen',
      profileVisits: 'Übersichten zu Profilbesuchen',
      social: 'Feed-Aktivität',
      wallet: 'Token-Neuigkeiten',
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

    suspendedSubject: 'Dein LangX-Konto wurde gesperrt',
    suspendedPreheader: 'Eine Meldung zu deinem Konto wurde geprüft',
    suspendedUntilBody:
      'Eine Person hat eine Meldung zu deinem Konto geprüft, und dein Konto ist bis zum {until} gesperrt. Bis dahin kannst du LangX nicht nutzen, und dein Profil ist aus Entdecken und der Suche ausgeblendet.',
    suspendedPermanentBody:
      'Eine Person hat eine Meldung zu deinem Konto geprüft, und dein Konto wurde dauerhaft gesperrt. Dein Profil ist aus Entdecken und der Suche ausgeblendet.',
    suspendedReason: 'Grund: {reason}',
    suspendedAppeal:
      'Wenn das aus deiner Sicht falsch ist, kannst du einmal Einspruch erheben — in der App oder als Antwort auf diese Mail.',
    suspendedText:
      'Dein LangX-Konto ist gesperrt. {detail} {reason} Du kannst einmal Einspruch erheben, in der App.',
    suspensionUpdatedSubject: 'Deine LangX-Sperre wurde aktualisiert',
    suspensionUpdatedPreheader: 'Wir haben deinen Einspruch angesehen',
    suspensionUpdatedShortened:
      'Wir haben deinen Einspruch gelesen. Deine Sperre endet jetzt am {until}.',
    suspensionUpdatedLifted:
      'Wir haben deinen Einspruch gelesen. Die Sperre ist aufgehoben — du kannst LangX wieder nutzen.',
    suspensionUpdatedText: 'Deine LangX-Sperre wurde aktualisiert. {detail}',
  },

  reportReason: {
    spam: 'Spam',
    harassment: 'Belästigung',
    hateSpeech: 'Hassrede',
    inappropriateContent: 'Unangemessener Inhalt',
    fakeProfile: 'Fake-Profil',
    underage: 'Unter 16',
    other: 'Etwas anderes',
  },
}

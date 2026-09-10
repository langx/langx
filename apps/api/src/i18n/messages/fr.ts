import type { Localized } from '@langx/shared'
import type { ServerMessages } from './en'

export const fr: Localized<ServerMessages> = {
  push: {
    streakTitle: { one: 'Série de {count} jour ! 🔥', other: 'Série de {count} jours ! 🔥' },
    streakBody: 'Envoyez un message aujourd’hui pour la conserver.',
    profileVisitsTitle: {
      one: '1 personne a consulté votre profil',
      other: '{count} personnes ont consulté votre profil',
    },
    profileVisitsBody: 'Touchez pour voir qui.',
    badgeOneTitle: 'Nouveau badge : {label} 🏅',
    badgeManyTitle: {
      one: 'Vous avez gagné 1 nouveau badge 🏅',
      other: 'Vous avez gagné {count} nouveaux badges 🏅',
    },
    badgeBody: 'Beau travail. Continuez.',
    meetingTitle: 'Ton échange linguistique est dans une heure',
    meetingBody: 'Touche pour ouvrir la conversation.',
    bountyTitle: {
      one: '{count} jeton pour ton signalement 🎉',
      other: '{count} jetons pour ton signalement 🎉',
    },
    bountyBody: 'On a lu ce que tu nous as envoyé, et ça valait le coup.',
    /** Security, which no preference can switch off. */
    securityBody: 'Ouvrez LangX si ce n’était pas vous.',
    securityBodyDevice: 'Depuis {device}. Ouvrez LangX si ce n’était pas vous.',
    security: {
      newSignInTitle: 'Nouvelle connexion à votre compte',
      passwordChangedTitle: 'Votre mot de passe a été modifié',
      methodLinkedTitle: 'Méthode de connexion ajoutée',
      methodUnlinkedTitle: 'Méthode de connexion retirée',
    },
  },

  email: {
    ignore: 'Si vous n’êtes pas à l’origine de cette demande, ignorez cet e-mail.',
    orPaste: 'Ou collez ce lien : {url}',

    deleteSubject: 'Confirmez la suppression de votre compte LangX',
    deletePreheader: 'Une dernière étape pour supprimer votre compte LangX',
    deleteBody:
      'Vous avez demandé la suppression de votre compte LangX. Confirmez ci-dessous et il sera programmé pour suppression — vous avez 30 jours pour changer d’avis en vous reconnectant.',
    deleteButton: 'Supprimer mon compte',
    deleteText: 'Confirmez la suppression de votre compte LangX : {url}',
    deleteInvalid: 'Ce lien a expiré ou a déjà été utilisé.',
    deleteConfirmTitle: 'Supprimer votre compte LangX',
    deleteConfirmBody:
      'Votre compte sera programmé pour suppression. Vous reconnecter sous 30 jours l’annule.',
    deleteConfirmButton: 'Oui, supprimer mon compte',
    deleteDoneTitle: 'Votre compte est programmé pour suppression',
    deleteDoneBody: 'Reconnectez-vous sous {days} jours et tout revient.',
    deleteDonePurge: 'Les données sont supprimées le {date}.',

    verifySubject: 'Vérifiez votre e-mail LangX',
    verifyPreheader: 'Vérifiez votre e-mail pour terminer la configuration de LangX',
    verifyBody:
      'Confirmez qu’il s’agit bien de votre adresse pour terminer la création de votre compte.',
    verifyButton: 'Vérifier l’e-mail',
    verifyText: 'Vérifiez votre e-mail LangX : {url}',

    resetSubject: 'Réinitialisez votre mot de passe LangX',
    resetPreheader: 'Réinitialisez votre mot de passe LangX',
    resetBody:
      'Quelqu’un a demandé la réinitialisation du mot de passe de ce compte. S’il s’agit de vous :',
    resetButton: 'Réinitialiser le mot de passe',
    resetText: 'Réinitialisez votre mot de passe LangX : {url}',
    magicLinkSubject: 'Votre lien de connexion LangX',
    magicLinkPreheader: 'Touchez pour vous connecter à LangX',
    magicLinkBody:
      'Touchez le bouton pour vous connecter. Le lien fonctionne une fois et expire dans 15 minutes.',
    magicLinkButton: 'Se connecter à LangX',
    magicLinkText: 'Connectez-vous à LangX (valable une fois, expire dans 15 minutes) : {url}',

    existingSubject: 'Vous avez déjà un compte LangX',
    existingPreheader: 'Vous avez déjà un compte LangX',
    existingBody:
      'Quelqu’un a tenté de s’inscrire avec cet e-mail, mais un compte existe déjà pour cette adresse. Pour vous connecter, réinitialisez votre mot de passe ou connectez-vous avec Google ou Apple avec cette adresse.',
    existingButton: 'Réinitialiser le mot de passe',
    existingText: 'Vous avez déjà un compte LangX. Réinitialisez votre mot de passe ici : {url}',

    existingLinkBody:
      'Quelqu’un a tenté de s’inscrire avec cet e-mail, mais vous avez déjà un compte ici, avec votre profil dessus. Touchez pour vous connecter — aucun mot de passe à retenir. Le lien fonctionne une fois et expire dans 15 minutes.',
    existingLinkText:
      'Vous avez déjà un compte LangX. Connectez-vous ici (valable une fois, expire dans 15 minutes) : {url}',

    whyThisMail: 'Vous recevez ceci en raison de vos réglages de notifications LangX.',
    unsubscribeLink: 'Désactiver ces e-mails',
    unsubscribeText: 'Désactiver ces e-mails : {url}',
    managePrefs: 'Tous les réglages de notifications',
    /** The dark panel under every mail: the QR to get.langx.io. */
    getApp: 'Téléchargez l’app',
    getAppScan: 'Scannez avec votre téléphone ou ouvrez',
    getAppPlatforms: 'iPhone · Android · Navigateur',
    /** The one button a streak email has. */
    openChats: 'Envoyer un message',

    digestSubject: {
      one: '1 message non lu sur LangX',
      other: '{count} messages non lus sur LangX',
    },
    digestPreheader: 'On attend votre réponse',
    digestBody: {
      one: '{names} vous a écrit pendant votre absence.',
      other: 'Vous avez {count} messages non lus, de {names}.',
    },
    digestMore: { one: 'Et une autre conversation.', other: 'Et {count} autres conversations.' },
    digestButton: 'Lire et répondre',

    visitsSubject: {
      one: '1 personne a consulté votre profil cette semaine',
      other: '{count} personnes ont consulté votre profil cette semaine',
    },
    visitsPreheader: 'Votre profil attire l’attention',
    visitsBody: {
      one: '1 personne a regardé votre profil cette semaine.',
      other: '{count} personnes ont regardé votre profil cette semaine.',
    },
    visitsNames: 'Parmi elles : {names}.',
    visitsLocked: 'Passez à l’offre supérieure pour voir qui.',
    visitsButton: 'Voir qui vous a consulté',

    badgeOneSubject: 'Nouveau badge : {label}',
    badgeManySubject: {
      one: 'Vous avez gagné 1 nouveau badge',
      other: 'Vous avez gagné {count} nouveaux badges',
    },
    badgeBody: 'Il est sur votre profil, visible par tous.',
    badgeButton: 'Voir vos badges',

    unsubscribeTitle: 'Désactiver ces e-mails ?',
    unsubscribeBody:
      'Vous ne recevrez plus {kind} par e-mail. Les notifications sur votre téléphone ne changent pas.',
    unsubscribeConfirm: 'Les désactiver',
    unsubscribeAll: 'Ou désactiver tous les e-mails de LangX',
    unsubscribedTitle: 'C’est fait — vous n’en recevrez plus.',
    unsubscribedBody:
      'Vous pouvez les réactiver à tout moment dans LangX, sous Réglages → Notifications.',
    unsubscribeInvalid:
      'Ce lien n’est pas valide. Ouvrez LangX et modifiez-le dans Réglages → Notifications.',

    /**

     * The security notices. No switch behind them and no unsubscribe —

     * see `modules/security/notify.ts`.

     */

    securityDevice: 'Appareil',

    securityPlace: 'Lieu',

    securityWhen: 'Quand',

    securityNotYou:
      'Si ce n’était pas vous, changez votre mot de passe maintenant : cela déconnecte tous les autres appareils.',

    securityButton: 'Changer mon mot de passe',

    security: {
      newSignInTitle: 'Nouvelle connexion à votre compte LangX',

      newSignInBody:
        'Quelqu’un s’est connecté à votre compte depuis un appareil que nous n’avions jamais vu.',

      passwordChangedTitle: 'Votre mot de passe LangX a été modifié',

      passwordChangedBody: 'Le mot de passe de votre compte vient d’être modifié.',

      methodLinkedTitle: 'Une méthode de connexion a été ajoutée à votre compte LangX',

      methodLinkedBody: 'La connexion avec Google ou Apple a été associée à votre compte.',

      methodUnlinkedTitle: 'Une méthode de connexion a été retirée de votre compte LangX',

      methodUnlinkedBody: 'Une façon de vous connecter a été déconnectée.',
    },

    kind: {
      messages: 'les résumés de messages',
      streak: 'les rappels de série',
      profileVisits: 'les résumés de visites de profil',
      promotions: 'les actualités et offres',
      all: 'les e-mails de LangX',
      v1contact: 'le message unique sur le nouveau LangX',
    },
    bountySubject: {
      one: 'Tu as gagné {count} jeton pour ton signalement',
      other: 'Tu as gagné {count} jetons pour ton signalement',
    },
    bountyPreheader: 'Merci de nous avoir prévenus.',
    bountyBody: {
      one: 'Nous avons lu ton message et ajouté {count} jeton à ton portefeuille. C’est comme ça que l’app s’améliore — merci.',
      other:
        'Nous avons lu ton message et ajouté {count} jetons à ton portefeuille. C’est comme ça que l’app s’améliore — merci.',
    },
    bountyButton: 'Ouvrir mon portefeuille',
    bountyText: {
      one: '{count} jeton a été ajouté à ton portefeuille pour ton signalement : {url}',
      other: '{count} jetons ont été ajoutés à ton portefeuille pour ton signalement : {url}',
    },
  },
}

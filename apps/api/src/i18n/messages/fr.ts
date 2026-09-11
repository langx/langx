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
    /** The same nudges on the phone, under the same switches. */
    promo: {
      addPhotoTitle: 'Ajoutez une photo',
      addPhotoBody: 'Les profils avec un visage reçoivent plus de réponses.',
      streakBrokeTitle: {
        one: 'Votre série de {count} jour est rompue',
        other: 'Votre série de {count} jours est rompue',
      },
      streakBrokeBody: 'Une réparation remet hier.',
      awayTitle: 'Les gens sont toujours là',
      awayBody: 'De nouvelles personnes pour pratiquer.',
      awayLongTitle: 'Nous serons là quand vous voudrez',
      awayLongBody: 'Votre série et vos jetons attendent.',
      tokensWaitingTitle: {
        one: '{count} jeton vous attend',
        other: '{count} jetons vous attendent',
      },
      tokensWaitingBody: 'Ouvrez votre portefeuille.',
      inviteFriendTitle: 'Invitez quelqu’un',
      inviteFriendBody: 'Vous gagnez tous les deux des jetons.',
    },

    /** Security, which no preference can switch off. */
    /** Billing, which no preference gates either. */
    billingFailedTitle: 'Votre paiement n’a pas abouti',
    billingEndedTitle: 'Votre formule a pris fin',
    billingBody: 'Touchez pour vérifier votre formule.',
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

    /** The monthly recap. Two halves: the reader's numbers and everybody's. */

    newsletterSubject: 'Votre {month} sur LangX',

    newsletterPreheader: 'Le mois en chiffres, le vôtre et celui de tous',

    newsletterYours: 'Votre mois',

    newsletterEverybody: 'Le mois de tous',

    newsletterQuiet:
      'Vous avez été silencieux ce mois-ci : aucun message, aucune correction. Les personnes ci-dessous ne l’ont pas été, et elles sont toujours là.',

    newsletterMessages: 'Messages envoyés',

    newsletterCorrections: 'Corrections données',

    newsletterTokens: 'Jetons gagnés',

    newsletterStreak: 'Série aujourd’hui',

    newsletterNewMembers: 'Nouveaux membres',

    newsletterMessagesSent: 'Messages envoyés',

    newsletterCorrectionsMade: 'Corrections faites',

    newsletterButton: 'Ouvrir LangX',

    /**

     * The nudges in `modules/notifications/promotions.ts`, in its order.

     * Every one of them is behind a switch and carries a way out.

     */

    promo: {
      addPhotoSubject: 'Ajoutez une photo, on vous trouvera',

      addPhotoBody:
        'Les profils avec un visage reçoivent bien plus de réponses. Dix secondes, et vous pouvez la changer quand vous voulez.',

      addPhotoButton: 'Ajouter ma photo',

      streakBrokeSubject: {
        one: 'Votre série de {count} jour est rompue',
        other: 'Votre série de {count} jours est rompue',
      },

      streakBrokeBody:
        'Hier a manqué. Une réparation depuis la boutique remet la journée et la série continue.',

      streakBrokeButton: 'Réparer hier',

      awaySubject: 'On continue à pratiquer sans vous',

      awayBody:
        'Une semaine a passé. Il y a de nouvelles personnes à qui parler, et vos langues n’ont pas changé.',

      awayButton: 'Voir qui est là',

      awayLongSubject: 'Après cela, nous n’écrirons plus',

      awayLongBody:
        'Un mois, c’est long. Votre compte, votre série et vos jetons sont toujours là si vous les voulez — et c’est la dernière fois que nous en parlons.',

      awayLongButton: 'Ouvrir LangX',

      tokensWaitingSubject: {
        one: '{count} jeton vous attend',
        other: '{count} jetons vous attendent',
      },

      tokensWaitingBody:
        'Les jetons achètent des gels de série, des réparations, des cadres et des titres. Les vôtres dorment depuis quinze jours.',

      tokensWaitingButton: 'Ouvrir mon portefeuille',

      inviteFriendSubject: 'On pratique mieux à deux',

      inviteFriendBody:
        'Invitez quelqu’un : vous gagnez tous les deux des jetons quand il arrive. Votre lien est dans les Réglages.',

      inviteFriendButton: 'Voir mon lien',
    },

    /** Onboarding finished: one mail, once in an account's life. */

    welcomeSubject: 'Bienvenue sur LangX',

    welcomePreheader: 'Votre première conversation est à un geste',

    welcomeTitle: 'Bienvenue, {name}',

    welcomeBody: 'Votre profil est en ligne sur @{handle}. Voici ce que les gens font en premier :',

    welcomeStep1: 'Trouvez quelqu’un qui parle la langue que vous apprenez et dites bonjour.',

    welcomeStep2: 'Publiez une phrase dans le Fil et laissez-la corriger.',

    welcomeStep3: 'Revenez demain — deux jours d’affilée lancent une série.',

    welcomeButton: 'Trouver quelqu’un pour pratiquer',

    /** A day later, for an address nobody confirmed. */

    verifyReminderSubject: 'Confirmez votre adresse e-mail',

    verifyReminderPreheader: 'Un geste et votre compte est prêt',

    verifyReminderBody:
      'Il ne manque qu’une chose à votre compte LangX : la preuve que cette adresse est la vôtre. Le lien ci-dessous s’en charge.',

    verifyReminderText: 'Confirmez votre adresse e-mail : {url}',

    /** Money, so no switch — see `billingEmail`. */

    billingPlan: 'Formule : {tier}',

    billing: {
      paymentFailedTitle: 'Votre paiement LangX n’a pas abouti',

      paymentFailedBody:
        'La boutique n’a pas pu prélever votre abonnement. Elle réessaiera, et votre formule reste active entre-temps.',

      paymentFailedButton: 'Vérifier ma formule',

      planEndedTitle: 'Votre formule LangX a pris fin',

      planEndedBody:
        'Votre abonnement a pris fin et votre compte est revenu à la formule gratuite. Tout ce que vous avez créé est toujours là.',

      planEndedButton: 'Voir les formules',
    },

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
  official: {
    welcome:
      'Salut, bienvenue sur LangX ! 👋 Content de t’avoir ici.\n\nLe meilleur commence dans Découvrir : trouve quelqu’un qui apprend ta langue et parle celle que tu vises, dis bonjour, et la pratique fait le reste. Tu gagnes des jetons au passage.\n\nC’est ici qu’arrivent les nouvelles de LangX, ça vaut le coup d’y jeter un œil. Et LangX est open source : il s’améliore parce que les gens nous disent des choses. Si quelque chose casse, ou si tu penses à un truc qu’on devrait faire, Réglages → À propos → Commentaires arrive directement chez nous. On lit tout. Et si tu connais quelqu’un à qui ça plairait, Réglages → Partager et inviter vous rapporte des jetons à tous les deux.',
    welcomeRate:
      'Un dernier truc, si le cœur t’en dit : noter LangX sur {store} aide vraiment les gens à nous trouver. Aucune pression.',
    assistantOffline:
      'Je ne peux pas répondre aux messages pour le moment. Si ça peut attendre, réessaie plus tard ; sinon, écris à {email} et une personne te lira.',
    assistantLimit:
      'Je ne peux pas répondre davantage pour l’instant — réessaie dans quelques heures.\n\nRien ne dépend de moi : tu peux signaler quelqu’un depuis son profil, envoyer un bug ou une idée depuis les Réglages, et {email} joint une personne à tout moment.',
    assistantError: 'Quelque chose a échoué de mon côté. Réessaie dans un instant.',
    assistantRefusal:
      'Je ne peux pas t’aider là-dessus. Si je me trompe, {email} joint une personne.',
  },
}

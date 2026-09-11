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
      limitReachedTitle: 'Vous butez souvent sur les limites',
      limitReachedBody: 'Une formule les lève.',
      trialEndingTitle: 'Votre semaine gratuite se termine dans deux jours',
      trialEndingBody: 'La garder tient en un geste.',
      winBackTitle: 'Votre formule a pris fin',
      winBackBody: 'Tout ce que vous avez créé est toujours là.',
      tokensWaitingTitle: {
        one: '{count} jeton vous attend',
        other: '{count} jetons vous attendent',
      },
      tokensWaitingBody: 'Ouvrez votre portefeuille.',
      inviteFriendTitle: 'Invitez quelqu’un',
      inviteFriendBody: 'Vous gagnez tous les deux des jetons.',
    },

    /** The feed reacting to something somebody left in it. */

    social: {
      followTitle: '{name} vous suit',

      followBody: 'Touchez pour voir son profil.',

      correctionTitle: '{name} a corrigé votre phrase',

      correctionBody: 'Touchez pour lire la correction.',

      answerTitle: '{name} a enregistré votre phrase',

      answerBody: 'Touchez pour écouter.',

      commentTitle: '{name} a commenté votre publication',

      commentBody: 'Touchez pour la lire.',

      likesTitle: {
        one: 'Votre publication a 1 j’aime',
        other: 'Votre publication a {count} j’aime',
      },

      likesBody: 'Quelqu’un a aimé ce que vous avez écrit.',
    },

    /** Tokens arriving. */

    wallet: {
      poolTitle: {
        one: 'La distribution d’hier vous a versé 1 jeton',
        other: 'La distribution d’hier vous a versé {count} jetons',
      },

      poolBody: 'Touchez pour ouvrir votre portefeuille.',

      giftTitle: 'Votre cadeau horaire est prêt',

      giftBody: 'Ouvrez le portefeuille et récupérez-le.',
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

    /** The day's replies to somebody's posts, in one letter. */

    feedDigestSubject: {
      one: '1 réponse à ce que vous avez écrit aujourd’hui',
      other: '{count} réponses à ce que vous avez écrit aujourd’hui',
    },

    feedDigestPreheader: 'On a répondu à vos publications',

    feedDigestBody: {
      one: 'Quelqu’un a répondu à une phrase que vous avez publiée aujourd’hui.',
      other: '{count} personnes ont répondu à vos phrases publiées aujourd’hui.',
    },

    feedDigestCorrections: { one: '1 correction', other: '{count} corrections' },

    feedDigestAnswers: { one: '1 enregistrement', other: '{count} enregistrements' },

    feedDigestComments: { one: '1 commentaire', other: '{count} commentaires' },

    feedDigestMore: { one: 'Et 1 autre publication.', other: 'Et {count} autres publications.' },

    feedDigestButton: 'Lire les réponses',

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

      limitReachedSubject: 'Vous butez sur les limites gratuites',

      limitReachedBody:
        'Vous avez atteint une limite quotidienne trois fois ces derniers jours. Une formule les lève : plus de conversations, plus de traductions, plus de pièces jointes, chaque jour.',

      limitReachedButton: 'Voir les formules',

      trialEndingSubject: 'Votre semaine gratuite se termine dans deux jours',

      trialEndingBody:
        'Ensuite, votre compte revient à la formule gratuite. Tout ce que vous avez créé reste ; les limites reviennent. La garder tient en un geste.',

      trialEndingButton: 'Garder ma formule',

      winBackSubject: 'Votre formule a pris fin il y a une semaine',

      winBackBody:
        'Rien n’a été retiré : votre série, vos jetons et tout ce que vous avez écrit sont là où vous les avez laissés. Ce sont les limites payantes qui se sont arrêtées.',

      winBackButton: 'Voir les formules',

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

    welcomeBody: 'Votre profil est en ligne sur {handle}. Voici ce que les gens font en premier :',

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
      social: 'l’activité du fil',
      wallet: 'les nouvelles de jetons',
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

    suspendedSubject: 'Ton compte LangX a été suspendu',
    suspendedPreheader: 'Un signalement sur ton compte a été examiné',
    suspendedUntilBody:
      'Une personne a examiné un signalement concernant ton compte, et celui-ci est suspendu jusqu’au {until}. D’ici là tu ne peux pas utiliser LangX, et ton profil n’apparaît ni dans Découvrir ni dans la recherche.',
    suspendedPermanentBody:
      'Une personne a examiné un signalement concernant ton compte, et celui-ci est suspendu définitivement. Ton profil n’apparaît ni dans Découvrir ni dans la recherche.',
    suspendedReason: 'Motif : {reason}',
    suspendedAppeal:
      'Si tu penses que c’est une erreur, tu peux faire appel une fois depuis l’app, ou en répondant à cet e-mail.',
    suspendedText:
      'Ton compte LangX est suspendu. {detail} {reason} Tu peux faire appel une fois depuis l’app.',
    suspensionUpdatedSubject: 'Ta suspension LangX a été mise à jour',
    suspensionUpdatedPreheader: 'Nous avons examiné ton appel',
    suspensionUpdatedShortened: 'Nous avons lu ton appel. Ta suspension prend fin le {until}.',
    suspensionUpdatedLifted:
      'Nous avons lu ton appel. Ta suspension est levée — tu peux réutiliser LangX.',
    suspensionUpdatedText: 'Ta suspension LangX a été mise à jour. {detail}',
  },

  reportReason: {
    spam: 'Spam',
    harassment: 'Harcèlement',
    hateSpeech: 'Discours haineux',
    inappropriateContent: 'Contenu inapproprié',
    fakeProfile: 'Faux profil',
    underage: 'Moins de 16 ans',
    other: 'Autre chose',
  },
}

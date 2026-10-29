import type { Localized } from '@langx/shared'
import type { ServerMessages } from './en'

/**
 * French, addressing the reader as "tu", as the app does, and without guessing
 * their gender (`addressForm.test.ts`, `readerGender.test.ts`).
 */
export const fr: Localized<ServerMessages> = {
  push: {
    streakTitle: { one: 'Série de {count} jour ! 🔥', other: 'Série de {count} jours ! 🔥' },
    streakBody: 'Ouvre LangX aujourd’hui pour la conserver.',
    streakRepairTitle: 'Reprends ta série',
    streakRepairBody: 'Une réparation comble la journée d’hier, et ta série continue.',
    echoTitle: {
      one: '1 carte est prête',
      other: '{count} cartes sont prêtes',
    },
    echoBody: 'Quelques minutes maintenant, et elles restent.',
    profileVisitsTitle: {
      one: '1 personne a consulté ton profil',
      other: '{count} personnes ont consulté ton profil',
    },
    profileVisitsBody: 'Touche pour voir qui.',
    badgeOneTitle: 'Nouveau badge : {label} 🏅',
    badgeManyTitle: {
      one: 'Tu as gagné 1 nouveau badge 🏅',
      other: 'Tu as gagné {count} nouveaux badges 🏅',
    },
    badgeBody: 'Beau travail. Continue.',
    meetingTitle: 'Ton échange linguistique est dans une heure',
    meetingBody: 'Touche pour ouvrir la conversation.',
    callIncomingVoice: 'Appel vocal entrant',
    callIncomingVideo: 'Appel vidéo entrant',
    bountyTitle: {
      one: '{count} jeton pour ton signalement 🎉',
      other: '{count} jetons pour ton signalement 🎉',
    },
    bountyBody: 'On a lu ce que tu nous as envoyé, et ça valait le coup.',
    reportRewardTitle: {
      one: '{count} jeton pour avoir aidé à protéger LangX 🛡️',
      other: '{count} jetons pour avoir aidé à protéger LangX 🛡️',
    },
    reportRewardBody: 'Nous avons examiné ton signalement. Merci.',
    moderatorRewardTitle: {
      one: '{count} jeton pour avoir modéré LangX 🛡️',
      other: '{count} jetons pour avoir modéré LangX 🛡️',
    },
    moderatorRewardBody: 'Un opérateur a examiné l’une de tes décisions. Merci.',
    /** The same nudges on the phone, under the same switches. */
    promo: {
      addPhotoTitle: 'Ajoute une photo',
      addPhotoBody: 'Les profils avec un visage reçoivent plus de réponses.',
      awayTitle: 'Les gens sont toujours là',
      awayBody: 'De nouvelles personnes pour pratiquer.',
      awayLongTitle: 'Nous serons là quand tu voudras',
      awayLongBody: 'Ta série et tes jetons attendent.',
      limitReachedTitle: 'Tu butes souvent sur les limites',
      limitReachedBody: 'Une formule les lève.',
      trialEndingTitle: 'Ta semaine gratuite se termine dans deux jours',
      trialEndingBody: 'La garder tient en un geste.',
      winBackTitle: 'Ta formule a pris fin',
      winBackBody: 'Tout ce que tu as créé est toujours là.',
      tokensWaitingTitle: {
        one: '{count} jeton t’attend',
        other: '{count} jetons t’attendent',
      },
      tokensWaitingBody: 'Ouvre ton portefeuille.',
      inviteFriendTitle: 'Invite quelqu’un',
      inviteFriendBody: 'Vous gagnez tous les deux des jetons.',
    },

    /** The feed reacting to something somebody left in it. */

    social: {
      followTitle: '{name} te suit',

      followBody: 'Touche pour voir son profil.',

      correctionTitle: '{name} a corrigé ta phrase',

      correctionBody: 'Touche pour lire la correction.',

      answerTitle: '{name} a enregistré ta phrase',

      answerBody: 'Touche pour écouter.',

      commentTitle: '{name} a commenté ta publication',

      commentBody: 'Touche pour la lire.',

      commentReplyTitle: '{name} a répondu à ton commentaire',

      commentReplyBody: 'Touche pour lire la réponse.',

      testimonialTitle: '{name} a écrit un avis sur ton profil',

      testimonialBody: 'Touche pour le lire.',

      likesTitle: {
        one: 'Ta publication a 1 j’aime',
        other: 'Ta publication a {count} j’aime',
      },

      likesBody: 'Quelqu’un a aimé ta publication.',
    },

    /** Tokens arriving. */

    wallet: {
      poolTitle: {
        one: 'Le pot commun d’hier t’a versé 1 jeton',
        other: 'Le pot commun d’hier t’a versé {count} jetons',
      },

      poolBody: 'Touche pour ouvrir ton portefeuille.',

      giftTitle: 'Ton cadeau horaire est prêt',

      giftBody: 'Ouvre le portefeuille et récupère-le.',
    },

    /** Security, which no preference can switch off. */
    /** Billing, which no preference gates either. */
    billingFailedTitle: 'Ton paiement n’a pas abouti',
    billingEndedTitle: 'Ta formule a pris fin',
    billingBody: 'Touche pour vérifier ta formule.',
    billingTrialEndingTitle: 'Ton essai gratuit se termine le {date}',
    billingTrialEndingBody: 'Touche pour voir ta formule et comment résilier.',
    lifetimeGiftTitle: '{plan}, à vie 🎉',
    lifetimeGiftBody: {
      one: 'Ton {total} jeton de v1 te l’a valu.',
      other: 'Tes {total} jetons de v1 te l’ont valu.',
    },
    securityBody: 'Ouvre LangX si ce n’était pas toi.',
    securityBodyDevice: 'Depuis {device}. Ouvre LangX si ce n’était pas toi.',
    security: {
      newSignInTitle: 'Nouvelle connexion à ton compte',
      passwordChangedTitle: 'Ton mot de passe a été modifié',
      methodLinkedTitle: 'Méthode de connexion ajoutée',
      methodUnlinkedTitle: 'Méthode de connexion retirée',
    },
  },

  email: {
    ignore: 'Si tu n’es pas à l’origine de cette demande, ignore cet e-mail.',
    orPaste: 'Ou colle ce lien : {url}',

    deleteSubject: 'Confirme la suppression de ton compte LangX',
    deletePreheader: 'Une dernière étape pour supprimer ton compte LangX',
    deleteBody: {
      one: 'Tu as demandé la suppression de ton compte LangX. Confirme ci-dessous et il sera programmé pour suppression — tu as {count} jour pour changer d’avis en te reconnectant.',
      other:
        'Tu as demandé la suppression de ton compte LangX. Confirme ci-dessous et il sera programmé pour suppression — tu as {count} jours pour changer d’avis en te reconnectant.',
    },
    deleteButton: 'Supprimer mon compte',
    deleteText: 'Confirme la suppression de ton compte LangX : {url}',
    deleteInvalid: 'Ce lien a expiré ou a déjà été utilisé.',
    deleteConfirmTitle: 'Supprimer ton compte LangX',
    deleteConfirmBody: {
      one: 'Ton compte sera programmé pour suppression. Si tu te reconnectes sous {count} jour, c’est annulé.',
      other:
        'Ton compte sera programmé pour suppression. Si tu te reconnectes sous {count} jours, c’est annulé.',
    },
    deleteConfirmButton: 'Oui, supprimer mon compte',
    deleteDoneTitle: 'Ton compte est programmé pour suppression',
    deleteDoneBody: {
      one: 'Reconnecte-toi sous {count} jour et tout revient.',
      other: 'Reconnecte-toi sous {count} jours et tout revient.',
    },
    deleteDonePurge: 'Les données sont supprimées le {date}.',

    verifySubject: 'Vérifie ton e-mail LangX',
    verifyPreheader: 'Vérifie ton e-mail pour terminer la configuration de LangX',
    verifyBody:
      'Confirme qu’il s’agit bien de ton adresse pour terminer la création de ton compte.',
    verifyButton: 'Vérifier l’e-mail',
    verifyText: 'Vérifie ton e-mail LangX : {url}',

    resetSubject: 'Réinitialise ton mot de passe LangX',
    resetPreheader: 'Réinitialise ton mot de passe LangX',
    resetBody:
      'Quelqu’un a demandé la réinitialisation du mot de passe de ce compte. Si c’était toi :',
    resetButton: 'Réinitialiser le mot de passe',
    resetText: 'Réinitialise ton mot de passe LangX : {url}',
    magicLinkSubject: 'Ton lien de connexion LangX',
    magicLinkPreheader: 'Touche pour te connecter à LangX',
    magicLinkBody:
      'Touchez le bouton pour vous connecter. Le lien fonctionne une fois et expire dans 15 minutes.',
    magicLinkButton: 'Se connecter à LangX',
    magicLinkText: 'Connectez-vous à LangX (valable une fois, expire dans 15 minutes) : {url}',

    existingSubject: 'Tu as déjà un compte LangX',
    existingPreheader: 'Tu as déjà un compte LangX',
    existingBody:
      'Quelqu’un a tenté de s’inscrire avec cet e-mail, mais un compte existe déjà pour cette adresse. Pour te connecter, réinitialise ton mot de passe ou connecte-toi avec Google ou Apple avec cette adresse.',
    existingButton: 'Réinitialiser le mot de passe',
    existingText: 'Tu as déjà un compte LangX. Réinitialise ton mot de passe ici : {url}',

    existingLinkBody:
      'Quelqu’un a tenté de s’inscrire avec cet e-mail, mais vous avez déjà un compte ici, avec votre profil dessus. Touchez pour vous connecter — aucun mot de passe à retenir. Le lien fonctionne une fois et expire dans 15 minutes.',
    existingLinkText:
      'Vous avez déjà un compte LangX. Connectez-vous ici (valable une fois, expire dans 15 minutes) : {url}',

    whyThisMail: 'Tu reçois ceci en raison de tes réglages de notifications LangX.',
    unsubscribeLink: 'Désactiver ces e-mails',
    unsubscribeText: 'Désactiver ces e-mails : {url}',
    managePrefs: 'Tous les réglages de notifications',
    /** The dark panel under every mail: the QR to get.langx.io. */
    getApp: 'Télécharge l’app',
    getAppScan: 'Scanne avec ton téléphone ou ouvre',
    getAppPlatforms: 'iPhone · Android · Navigateur',
    /** The one button a streak email has. */
    openChats: 'Envoyer un message',

    digestSubject: {
      one: '1 message non lu sur LangX',
      other: '{count} messages non lus sur LangX',
    },
    digestPreheader: 'On attend ta réponse',
    digestBody: {
      one: '{names} t’a écrit pendant ton absence.',
      other: 'Tu as {count} messages non lus, de {names}.',
    },
    digestMore: { one: 'Et une autre conversation.', other: 'Et {count} autres conversations.' },
    digestButton: 'Lire et répondre',

    visitsSubject: {
      one: '1 personne a consulté ton profil cette semaine',
      other: '{count} personnes ont consulté ton profil cette semaine',
    },
    visitsPreheader: 'Ton profil attire l’attention',
    visitsBody: {
      one: '1 personne a regardé ton profil cette semaine.',
      other: '{count} personnes ont regardé ton profil cette semaine.',
    },
    visitsNames: 'Parmi elles : {names}.',
    visitsLocked: 'Passe à l’offre supérieure pour voir qui.',
    visitsButton: 'Voir qui a consulté ton profil',

    badgeOneSubject: 'Nouveau badge : {label}',
    badgeManySubject: {
      one: 'Tu as gagné 1 nouveau badge',
      other: 'Tu as gagné {count} nouveaux badges',
    },
    badgeBody: 'Il est sur ton profil, visible par tous.',
    badgeButton: 'Voir tes badges',

    unsubscribeTitle: 'Désactiver ces e-mails ?',
    unsubscribeBody:
      'Tu ne recevras plus {kind} par e-mail. Les notifications sur ton téléphone ne changent pas.',
    unsubscribeConfirm: 'Les désactiver',
    unsubscribeAll: 'Ou désactiver tous les e-mails de LangX',
    unsubscribedTitle: 'C’est fait — tu n’en recevras plus.',
    unsubscribedBody:
      'Tu peux les réactiver à tout moment dans LangX, sous Réglages → Notifications.',
    unsubscribeInvalid:
      'Ce lien n’est pas valide. Ouvre LangX et modifie-le dans Réglages → Notifications.',

    /** The monthly recap. Two halves: the reader's numbers and everybody's. */

    newsletterSubject: 'Ton {month} sur LangX',

    newsletterPreheader: 'Le mois en chiffres, le tien et celui de tous',

    newsletterYours: 'Ton mois',

    newsletterEverybody: 'Le mois de tous',

    newsletterQuiet:
      'Un mois calme pour toi : aucun message, aucune correction. Les personnes ci-dessous ne sont pas restées silencieuses, et elles sont toujours là.',

    newsletterMessages: 'Messages envoyés',

    newsletterCorrections: 'Corrections données',
    newsletterPosts: 'Publications partagées',

    newsletterTokens: 'Jetons gagnés',

    newsletterStreak: 'Série aujourd’hui',

    newsletterNewMembers: 'Nouveaux membres',

    newsletterMessagesSent: 'Messages envoyés',

    newsletterCorrectionsMade: 'Corrections faites',

    newsletterTokensGiven: 'Jetons distribués',

    newsletterButton: 'Ouvrir LangX',

    newsletterSeeMonth: 'Voir ton mois',

    /** The day's replies to somebody's posts, in one letter. */

    feedDigestSubject: {
      one: '1 réponse à ce que vous avez publié aujourd’hui',
      other: '{count} réponses à ce que vous avez publié aujourd’hui',
    },

    feedDigestPreheader: 'On a répondu à tes publications',

    feedDigestBody: {
      one: 'Quelqu’un a répondu à ce que vous avez publié aujourd’hui.',
      other: 'Ce que vous avez publié aujourd’hui a reçu {count} réponses.',
    },

    feedDigestCorrections: { one: '1 correction', other: '{count} corrections' },

    feedDigestAnswers: { one: '1 enregistrement', other: '{count} enregistrements' },

    feedDigestComments: { one: '1 commentaire', other: '{count} commentaires' },

    feedDigestMore: { one: 'Et 1 autre publication.', other: 'Et {count} autres publications.' },

    feedDigestButton: 'Lire les réponses',

    feedDigestPhoto: 'Ta photo',

    feedDigestVideo: 'Ta vidéo',

    /** The digest's one passenger: people the reader has never spoken to. */
    matchesSubject: 'Des personnes avec qui pratiquer',

    matchesPreheader: 'De nouvelles personnes dont les langues correspondent aux tiennes',

    matchesBody: '{names} parlent les langues que tu apprends — et apprennent la tienne.',

    matchesButton: 'Voir qui est là',

    /** Yesterday's pool, as a paragraph rather than the letter it never was. */
    walletBody:
      "Ils sont déjà dans ton portefeuille. Le pot commun est partagé chaque nuit entre celles et ceux qui ont aidé quelqu'un la veille.",

    walletButton: 'Ouvrir mon portefeuille',

    /** Tomorrow's diary. The hour-before reminder is still a push. */
    meetingsSubject: {
      one: 'Un appel demain',
      other: '{count} appels demain',
    },

    meetingsPreheader: 'Ce qui t’attend demain',

    meetingsBody: {
      one: 'Tu as accepté un appel pour demain.',
      other: 'Tu as accepté {count} appels pour demain.',
    },

    meetingsButton: 'Ouvrir mes discussions',

    /**

     * The nudges in `modules/notifications/promotions.ts`, in its order.

     * Every one of them is behind a switch and carries a way out.

     */

    promo: {
      addPhotoSubject: 'Ajoute une photo, on te trouvera',

      addPhotoBody:
        'Les profils avec un visage reçoivent bien plus de réponses. Dix secondes, et tu peux la changer quand tu veux.',

      addPhotoButton: 'Ajouter ma photo',

      streakBrokeSubject: {
        one: 'Ta série de {count} jour est rompue',
        other: 'Ta série de {count} jours est rompue',
      },

      streakBrokeBody:
        'Hier a manqué. Une réparation depuis la boutique remet la journée et la série continue.',

      streakBrokeButton: 'Réparer hier',

      awaySubject: 'On continue à pratiquer sans toi',

      awayBody:
        'Une semaine a passé. Il y a de nouvelles personnes à qui parler, et tes langues n’ont pas changé.',

      awayButton: 'Voir qui est là',

      awayLongSubject: 'Après cela, nous n’écrirons plus',

      awayLongBody:
        'Un mois, c’est long. Ton compte, ta série et tes jetons sont toujours là si tu les veux — et c’est la dernière fois que nous en parlons.',

      awayLongButton: 'Ouvrir LangX',

      limitReachedSubject: 'Tu butes sur les limites gratuites',

      limitReachedBody:
        'Tu as atteint une limite quotidienne trois fois ces derniers jours. Une formule les lève : plus de conversations et plus de traductions, chaque jour.',

      limitReachedButton: 'Voir les formules',

      trialEndingSubject: 'Ta semaine gratuite se termine dans deux jours',

      trialEndingBody:
        'Ensuite, ton compte revient à la formule gratuite. Tout ce que tu as créé reste ; les limites reviennent. La garder tient en un geste.',

      trialEndingButton: 'Garder ma formule',

      winBackSubject: 'Ta formule a pris fin il y a une semaine',

      winBackBody:
        'Rien n’a été retiré : ta série, tes jetons et tout ce que tu as écrit sont là où tu les as laissés. Ce sont les limites payantes qui se sont arrêtées.',

      winBackButton: 'Voir les formules',

      tokensWaitingSubject: {
        one: '{count} jeton t’attend',
        other: '{count} jetons t’attendent',
      },

      tokensWaitingBody:
        'Les jetons achètent des gels de série, des réparations, des cadres et des titres. Les tiens dorment depuis quinze jours.',

      tokensWaitingButton: 'Ouvrir mon portefeuille',

      inviteFriendSubject: 'On pratique mieux à deux',

      inviteFriendBody:
        'Invite quelqu’un : vous gagnez tous les deux des jetons quand il arrive. Ton lien est dans les Réglages.',

      inviteFriendButton: 'Voir mon lien',
    },

    /** Onboarding finished: one mail, once in an account's life. */

    welcomeSubject: 'Bienvenue sur LangX',

    welcomePreheader: 'Ta première conversation est à un geste',

    welcomeTitle: 'Bienvenue, {name}',

    welcomeBody: 'Ton profil est en ligne sur {handle}. Voici ce que les gens font en premier :',

    welcomeStep1: 'Trouve quelqu’un qui parle la langue que tu apprends et dis bonjour.',

    welcomeStep2:
      'Partage un moment de ta journée dans le Fil — et demande une correction si tu le souhaites.',

    welcomeStep3: 'Reviens demain — deux jours d’affilée lancent une série.',

    welcomeButton: 'Trouver quelqu’un pour pratiquer',

    /** A day later, for an address nobody confirmed. */

    verifyReminderSubject: 'Confirme ton adresse e-mail',

    verifyReminderPreheader: 'Un geste et ton compte est prêt',

    verifyReminderBody:
      'Il ne manque qu’une chose à ton compte LangX : la preuve que cette adresse est la tienne. Le lien ci-dessous s’en charge.',

    verifyReminderText: 'Confirme ton adresse e-mail : {url}',

    /** Money, so no switch — see `billingEmail`. */

    billingPlan: 'Formule : {tier}',

    billing: {
      paymentFailedTitle: 'Ton paiement LangX n’a pas abouti',

      paymentFailedBody:
        'La boutique n’a pas pu prélever ton abonnement. Elle réessaiera, et ta formule reste active entre-temps.',

      paymentFailedButton: 'Vérifier ma formule',

      planEndedTitle: 'Ta formule LangX a pris fin',

      planEndedBody:
        'Ton abonnement a pris fin et ton compte est revenu à la formule gratuite. Tout ce que tu as créé est toujours là.',

      planEndedButton: 'Voir les formules',
      trialEndingTitle: 'Ton essai de LangX Pro se termine le {date}',
      trialEndingBody:
        'Si tu le gardes, la boutique où tu as pris ton abonnement facturera le {date} la formule choisie, au prix qu’elle t’a indiqué, puis la renouvellera jusqu’à résiliation. Résilie avant et tu ne paies rien ; Pro reste actif jusqu’au {date}.',
      trialEndingCancelAppStore:
        'Pour résilier sur iPhone ou iPad : Réglages → ton nom → Abonnements → LangX → Annuler l’abonnement. Apple le demande au moins un jour avant la fin de l’essai.',
      trialEndingCancelPlayStore:
        'Pour résilier sur Android : Google Play → ta photo de profil → Paiements et abonnements → Abonnements → LangX → Résilier l’abonnement.',
      trialEndingCancelWeb:
        'Pour résilier : LangX sur le web → Réglages → Abonnement → Gérer ou résilier.',
      trialEndingCancelOther:
        'Pour résilier, ouvre la page des abonnements de la boutique où tu as pris ton abonnement.',
      trialEndingButton: 'Voir ma formule',
    },

    /**

     * The security notices. No switch behind them and no unsubscribe —

     * see `modules/security/notify.ts`.

     */

    securityDevice: 'Appareil',

    securityPlace: 'Lieu',

    securityWhen: 'Quand',

    securityNotYou:
      'Si ce n’était pas toi, change ton mot de passe maintenant : cela déconnecte tous les autres appareils.',

    securityButton: 'Changer mon mot de passe',

    security: {
      newSignInTitle: 'Nouvelle connexion à ton compte LangX',

      newSignInBody:
        'Quelqu’un s’est connecté à ton compte depuis un appareil que nous n’avions jamais vu.',

      passwordChangedTitle: 'Ton mot de passe LangX a été modifié',

      passwordChangedBody: 'Le mot de passe de ton compte vient d’être modifié.',

      methodLinkedTitle: 'Une méthode de connexion a été ajoutée à ton compte LangX',

      methodLinkedBody: 'La connexion avec Google ou Apple a été associée à ton compte.',

      methodUnlinkedTitle: 'Une méthode de connexion a été retirée de ton compte LangX',

      methodUnlinkedBody: 'Une façon de te connecter a été déconnectée.',
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
    officialNoteSubject: 'Un message de LangX',
    officialNotePreheader: 'Un mot de l’équipe LangX',
    officialNoteInApp: 'Le même message se trouve dans ton chat @langx dans l’app.',
    lifetimeGiftSubject: '{plan}, à vie',
    lifetimeGiftButton: 'Voir ma formule',
    proGiftSubject: '🎁 LangX Pro, offert',
    proGiftButton: 'Ouvrir LangX',
    proGiftEndingSubject: '⏳ Ton cadeau Pro se termine le {date}',
    proGiftEndingButton: 'Voir ma formule',
  },

  lifetimeGift: {
    intro: 'Félicitations — {plan} est à toi, à vie.',
    earned: {
      one: 'Tu as terminé v1 avec {total} jeton. C’est ce qui te l’a valu : le cadeau est allé aux comptes qui ont bâti l’ancien LangX. Ça n’expire jamais, et il n’y a rien à payer.',
      other:
        'Tu as terminé v1 avec {total} jetons. C’est ce qui te l’a valu : le cadeau est allé aux comptes qui ont bâti l’ancien LangX. Ça n’expire jamais, et il n’y a rien à payer.',
    },
    wallet: {
      one: 'Ton ancien solde a été converti à raison de cent jetons v1 pour un, donc {carried} d’entre eux sont dans ton nouveau portefeuille. Il contient {balance} jeton aujourd’hui.',
      other:
        'Ton ancien solde a été converti à raison de cent jetons v1 pour un, donc {carried} d’entre eux sont dans ton nouveau portefeuille. Il contient {balance} jetons aujourd’hui.',
    },
  },
  proGift: {
    introAdmin: {
      one: '🎁 {count} mois de LangX Pro, offert. Merci d’être là !',
      other: '🎁 {count} mois de LangX Pro, offerts. Merci d’être là !',
    },
    introReferral: {
      one: '🎉 {friends} amis que tu as invités discutent sur LangX. {count} mois de Pro pour toi !',
      other:
        '🎉 {friends} amis que tu as invités discutent sur LangX. {count} mois de Pro pour toi !',
    },
    introReferralWeeks: {
      one: '🎉 Une personne que tu as invitée discute sur LangX. {count} semaine de Pro pour toi, et du Pro pour elle aussi !',
      other:
        '🎉 Une personne que tu as invitée discute sur LangX. {count} semaines de Pro pour toi, et du Pro pour elle aussi !',
    },
    introInvitedWeeks: {
      one: '🎉 Ta première vraie conversation sur LangX ! Tu as rejoint LangX grâce à une invitation, alors {count} semaine de Pro est pour toi.',
      other:
        '🎉 Ta première vraie conversation sur LangX ! Tu as rejoint LangX grâce à une invitation, alors {count} semaines de Pro sont pour toi.',
    },
    introStreak: {
      one: '🔥 {days} jours d’affilée, chapeau ! Pour te remercier, on t’offre {count} mois de Pro.',
      other:
        '🔥 {days} jours d’affilée, chapeau ! Pour te remercier, on t’offre {count} mois de Pro.',
    },
    introStreakWeeks: {
      one: '🔥 {days} jours d’affilée, bravo ! Pour te remercier, on t’offre {count} semaine de Pro.',
      other:
        '🔥 {days} jours d’affilée, bravo ! Pour te remercier, on t’offre {count} semaines de Pro.',
    },
    introCode: {
      one: '🎟️ Le code {code} a marché : {count} mois de LangX Pro pour toi.',
      other: '🎟️ Le code {code} a marché : {count} mois de LangX Pro pour toi.',
    },
    perks:
      'Tu peux maintenant :\n💬 lancer de nouvelles conversations sans limite\n🌍 traduire sans limite\n👀 voir qui a consulté ton profil, et naviguer incognito\n✨ te démarquer dans Découvrir et filtrer par genre et par ville',
    andMore: '…et plus encore.',
    until: 'Profite-en jusqu’au {date}. 💛',
    untilPaying:
      'Ton abonnement continue comme d’habitude — et s’il se termine un jour, Pro reste jusqu’au {date}.',
    reminderWeek:
      '⏳ Petit rappel : ton cadeau Pro se termine le {date}. Tes options de formule sont dans Réglages → Abonnement.',
    reminderDay: '⏳ Ton cadeau Pro se termine demain, le {date}.',
    ended:
      'Ton cadeau Pro est terminé. Merci d’avoir pratiqué avec nous — à bientôt dans les discussions ! 💛',
    reminderWeekWelcome:
      '⏳ Petit rappel : ta semaine Pro se termine le {date}. Tes options de formule sont dans Réglages → Abonnement.',
    reminderDayWelcome:
      '⏳ Ta semaine Pro se termine demain, le {date}. Tes options de formule sont dans Réglages → Abonnement.',
    endedWelcome:
      'Ta semaine Pro est terminée. Merci d’avoir pratiqué avec nous — à bientôt dans les discussions ! 💛',
    languagesPauseSoon:
      '🌍 Les langues ajoutées pendant cette période seront mises en pause dans Découvrir quand tu repasseras au forfait gratuit. Elles restent sur ton profil.',
    languagesPaused:
      '🌍 Les langues ajoutées pendant cette période sont en pause dans Découvrir maintenant que tu es au forfait gratuit. Elles restent sur ton profil.',
  },
  reportReason: {
    spam: 'Spam',
    scam: 'Arnaque ou demande d’argent',
    harassment: 'Harcèlement',
    hateSpeech: 'Discours haineux',
    inappropriateContent: 'Contenu inapproprié',
    fakeProfile: 'Faux profil',
    underage: 'Moins de 16 ans',
    other: 'Autre chose',
  },
  official: {
    welcome:
      'Salut, bienvenue sur LangX ! 👋 Content de t’avoir ici.\n\nLe meilleur commence dans Découvrir : trouve quelqu’un qui apprend ta langue et parle celle que tu vises, dis bonjour, et la pratique fait le reste. Tu gagnes des jetons au passage.\n\nC’est ici qu’arrivent les nouvelles de LangX, ça vaut le coup d’y jeter un œil. Et LangX est open source : il s’améliore parce que les gens nous disent des choses. Si quelque chose casse, ou si tu penses à un truc qu’on devrait faire, Réglages → À propos → Commentaires arrive directement chez nous. On lit tout. Et si tu connais quelqu’un à qui ça plairait, Réglages → Partager et inviter vous rapporte des jetons à tous les deux.',
    welcomeRate:
      'Un dernier truc, si le cœur t’en dit : noter LangX sur {store} aide vraiment les gens à nous trouver. Aucune pression.',
    welcomeClosing: 'Bonne pratique — et bon courage. 💛',
    welcomeBack:
      'Salut — content de te revoir. 👋 Tu étais là pour le premier LangX, et il y a maintenant un badge sur ton profil qui le dit. Seules les personnes venues de la v1 l’ont, et personne de nouveau ne l’aura jamais.',
    welcomeBackWhatsNew:
      'Beaucoup de choses ont bougé. Les corrections sont devenues une chose à part entière, tu gagnes des jetons en aidant les autres, et Découvrir cherche quelqu’un qui apprend ta langue et parle celle que tu vises. La même idée, avec cette fois la place de bien la faire — fais un tour.',
    welcomeBackClosing:
      'C’est ici qu’arrivent les nouvelles de LangX, ça vaut le coup d’y jeter un œil. S’il manque quelque chose ou si quelque chose casse, Réglages → À propos → Commentaires arrive directement chez nous. Content de te retrouver. 💛',
    heardAbout: {
      question:
        'Petite question, et après je te laisse : comment as-tu entendu parler de LangX ? Touche la réponse qui correspond — ça nous dit où trouver d’autres personnes comme toi.',
      store: 'App Store ou Google Play',
      search: 'Google ou un autre moteur de recherche',
      ai: 'ChatGPT ou une autre IA',
      friend: 'Par un proche',
      tiktokInstagram: 'TikTok ou Instagram',
      youtube: 'YouTube',
      appList: 'Une liste d’applis ou un site d’avis',
      other: 'Ailleurs',
    },
    reportReward: {
      one: 'Merci pour ton signalement. Nous l’avons examiné et ajouté {count} jeton à ton portefeuille, pour avoir aidé à faire de LangX un bon endroit pour apprendre. La personne signalée ne saura jamais qui l’a signalée.',
      other:
        'Merci pour ton signalement. Nous l’avons examiné et ajouté {count} jetons à ton portefeuille, pour avoir aidé à faire de LangX un bon endroit pour apprendre. La personne signalée ne saura jamais qui l’a signalée.',
    },
    moderatorReward: {
      one: 'Merci de modérer LangX. Un opérateur a examiné l’une de tes décisions et ajouté {count} jeton à ton portefeuille.',
      other:
        'Merci de modérer LangX. Un opérateur a examiné l’une de tes décisions et ajouté {count} jetons à ton portefeuille.',
    },
    suspensionEnded:
      'Ta suspension est terminée et ton compte est de nouveau ouvert. 👋 Ton profil est de retour dans Découvrir et dans la recherche, et tes conversations sont là où tu les as laissées.\n\nAide-nous à garder LangX comme un bon endroit pour apprendre : un autre signalement confirmé pourrait fermer le compte pour de bon. Si tu penses que quelque chose a mal tourné, Réglages → À propos → Commentaires arrive chez une vraie personne.',
    assistantOffline:
      'Je ne peux pas répondre aux messages pour le moment. Si ça peut attendre, réessaie plus tard ; sinon, écris à {email} et une personne te lira.',
    assistantLimit:
      'Je ne peux pas répondre davantage pour l’instant — réessaie dans quelques heures.\n\nRien ne dépend de moi : tu peux signaler quelqu’un depuis son profil, envoyer un bug ou une idée depuis les Réglages, et {email} joint une personne à tout moment.',
    assistantError: 'Quelque chose a échoué de mon côté. Réessaie dans un instant.',
    assistantRefusal:
      'Je ne peux pas t’aider là-dessus. Si je me trompe, {email} joint une personne.',
  },
  feedbackReply: {
    bug: 'Bonjour ! Merci pour ton signalement — on l’a lu et on s’en occupe.',
    feature: 'Bonjour ! Merci pour l’idée — on l’a lue et elle est sur notre liste.',
    copilot:
      'Bonjour ! Merci d’avoir signalé cette réponse de Copilot — on l’a lue, et les signalements comme le tien nous aident à améliorer Copilot.',
    issue: 'Tu peux suivre ça ici : {url}',
  },
  cards: {
    badgeKicker: 'Nouveau badge',
    badgeEarnedOn: 'Gagné le {date}',
  },
  badgeNames: {
    v3: {
      languages_2: 'Deux fils',
      languages_3: 'Tresse',
      languages_5: 'Cinq brins',
      calls_1: 'Téléphone à ficelle',
      calls_10: 'Longue ligne',
      calls_50: 'Standard',
      echo_100: 'Ondulation',
      echo_1000: 'Vague',
      echo_5000: 'Marée',
      testimonials_1: 'Carré de patchwork',
      testimonials_5: 'Patchwork',
      testimonials_20: 'Courtepointe',
      guide_3: 'Reprise',
      guide_10: 'Raccommodage',
      guide_50: 'Tisserand',
      openers_10: 'Porte ouverte',
      openers_50: 'Lampe du perron',
      openers_200: 'Maison ouverte',
    },
    firstCorrection: 'Première correction',
    streakDays: {
      one: '{formatted} jour',
      other: '{formatted} jours',
    },
    corrections: {
      one: '{formatted} correction',
      other: '{formatted} corrections',
    },
    messagesSent: {
      one: '{formatted} message',
      other: '{formatted} messages',
    },
    tokensEarned: {
      one: '{formatted} jeton gagné',
      other: '{formatted} jetons gagnés',
    },
    memberDays: {
      one: '{formatted} jour de membre',
      other: '{formatted} jours de membre',
    },
    earlyAdopter: 'Membre de la première heure',
    languages: {
      one: '{formatted} langue',
      other: '{formatted} langues',
    },
    calls: {
      one: '{formatted} appel',
      other: '{formatted} appels',
    },
    echo: {
      one: '{formatted} révision',
      other: '{formatted} révisions',
    },
    testimonials: {
      one: '{formatted} partenaire',
      other: '{formatted} partenaires',
    },
    guide: {
      one: '{formatted} personne',
      other: '{formatted} personnes',
    },
    openers: {
      one: '{formatted} réponse',
      other: '{formatted} réponses',
    },
  },
}

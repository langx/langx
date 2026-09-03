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
  },

  email: {
    ignore: 'Si vous n’êtes pas à l’origine de cette demande, ignorez cet e-mail.',
    orPaste: 'Ou collez ce lien : {url}',

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

    existingSubject: 'Vous avez déjà un compte LangX',
    existingPreheader: 'Vous avez déjà un compte LangX',
    existingBody:
      'Quelqu’un a tenté de s’inscrire avec cet e-mail, mais un compte existe déjà pour cette adresse. Pour vous connecter, réinitialisez votre mot de passe ou connectez-vous avec Google ou Apple avec cette adresse.',
    existingButton: 'Réinitialiser le mot de passe',
    existingText: 'Vous avez déjà un compte LangX. Réinitialisez votre mot de passe ici : {url}',

    whyThisMail: 'Vous recevez ceci en raison de vos réglages de notifications LangX.',
    unsubscribeLink: 'Désactiver ces e-mails',
    unsubscribeText: 'Désactiver ces e-mails : {url}',
    managePrefs: 'Tous les réglages de notifications',
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

    kind: {
      messages: 'les résumés de messages',
      streak: 'les rappels de série',
      profileVisits: 'les résumés de visites de profil',
      promotions: 'les actualités et offres',
      all: 'les e-mails de LangX',
      v1contact: 'le message unique sur le nouveau LangX',
    },
  },
}

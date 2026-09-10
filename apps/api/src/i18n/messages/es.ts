import type { Localized } from '@langx/shared'
import type { ServerMessages } from './en'

export const es: Localized<ServerMessages> = {
  push: {
    streakTitle: { one: '¡Racha de {count} día! 🔥', other: '¡Racha de {count} días! 🔥' },
    streakBody: 'Envía un mensaje hoy para mantenerla.',
    profileVisitsTitle: {
      one: '1 persona vio tu perfil',
      other: '{count} personas vieron tu perfil',
    },
    profileVisitsBody: 'Toca para ver quién.',
    badgeOneTitle: 'Nueva insignia: {label} 🏅',
    badgeManyTitle: {
      one: 'Ganaste 1 insignia nueva 🏅',
      other: 'Ganaste {count} insignias nuevas 🏅',
    },
    badgeBody: 'Bien hecho. Sigue así.',
    meetingTitle: 'Tu intercambio de idiomas es en una hora',
    meetingBody: 'Toca para abrir la conversación.',
    bountyTitle: {
      one: '{count} ficha por tu aviso 🎉',
      other: '{count} fichas por tu aviso 🎉',
    },
    bountyBody: 'Leímos lo que nos enviaste y valió la pena.',
    /** The same nudges on the phone, under the same switches. */
    promo: {
      addPhotoTitle: 'Añade una foto',
      addPhotoBody: 'Los perfiles con cara reciben más respuestas.',
      streakBrokeTitle: {
        one: 'Tu racha de {count} día se ha roto',
        other: 'Tu racha de {count} días se ha roto',
      },
      streakBrokeBody: 'Una reparación devuelve el día.',
      awayTitle: 'La gente sigue aquí',
      awayBody: 'Gente nueva con quien practicar.',
      awayLongTitle: 'Aquí cuando quieras',
      awayLongBody: 'Tu racha y tus tokens te esperan.',
      tokensWaitingTitle: { one: '{count} token esperando', other: '{count} tokens esperando' },
      tokensWaitingBody: 'Abre tu cartera.',
      inviteFriendTitle: 'Invita a alguien',
      inviteFriendBody: 'Los dos ganáis tokens.',
    },

    /** Security, which no preference can switch off. */
    /** Billing, which no preference gates either. */
    billingFailedTitle: 'Tu pago no se pudo procesar',
    billingEndedTitle: 'Tu plan ha terminado',
    billingBody: 'Toca para ver tu plan.',
    securityBody: 'Abre LangX si no fuiste tú.',
    securityBodyDevice: 'Desde {device}. Abre LangX si no fuiste tú.',
    security: {
      newSignInTitle: 'Nuevo inicio de sesión en tu cuenta',
      passwordChangedTitle: 'Tu contraseña ha cambiado',
      methodLinkedTitle: 'Método de inicio de sesión añadido',
      methodUnlinkedTitle: 'Método de inicio de sesión eliminado',
    },
  },

  email: {
    ignore: 'Si no has solicitado esto, puedes ignorar este correo.',
    orPaste: 'O pega este enlace: {url}',

    deleteSubject: 'Confirma que quieres eliminar tu cuenta de LangX',
    deletePreheader: 'Un paso más para eliminar tu cuenta de LangX',
    deleteBody:
      'Pediste eliminar tu cuenta de LangX. Confírmalo abajo y quedará programada para eliminarse: tienes 30 días para cambiar de opinión volviendo a iniciar sesión.',
    deleteButton: 'Eliminar mi cuenta',
    deleteText: 'Confirma la eliminación de tu cuenta de LangX: {url}',
    deleteInvalid: 'Este enlace ha caducado o ya se ha usado.',
    deleteConfirmTitle: 'Eliminar tu cuenta de LangX',
    deleteConfirmBody:
      'Esto programa la eliminación de tu cuenta. Si vuelves a iniciar sesión en 30 días, se cancela.',
    deleteConfirmButton: 'Sí, eliminar mi cuenta',
    deleteDoneTitle: 'Tu cuenta está programada para eliminarse',
    deleteDoneBody: 'Vuelve a iniciar sesión en {days} días y todo regresa.',
    deleteDonePurge: 'Los datos se eliminan el {date}.',

    verifySubject: 'Verifica tu correo de LangX',
    verifyPreheader: 'Verifica tu correo para terminar de configurar LangX',
    verifyBody: 'Confirma que esta es tu dirección de correo para terminar de crear tu cuenta.',
    verifyButton: 'Verificar correo',
    verifyText: 'Verifica tu correo de LangX: {url}',

    resetSubject: 'Restablece tu contraseña de LangX',
    resetPreheader: 'Restablece tu contraseña de LangX',
    resetBody: 'Alguien ha solicitado restablecer la contraseña de esta cuenta. Si has sido tú:',
    resetButton: 'Restablecer contraseña',
    resetText: 'Restablece tu contraseña de LangX: {url}',
    magicLinkSubject: 'Tu enlace para entrar en LangX',
    magicLinkPreheader: 'Toca para entrar en LangX',
    magicLinkBody:
      'Toca el botón para iniciar sesión. El enlace funciona una vez y caduca en 15 minutos.',
    magicLinkButton: 'Entrar en LangX',
    magicLinkText: 'Entra en LangX (funciona una vez, caduca en 15 minutos): {url}',

    existingSubject: 'Ya tienes una cuenta de LangX',
    existingPreheader: 'Ya tienes una cuenta de LangX',
    existingBody:
      'Alguien ha intentado registrarse con este correo, pero ya existe una cuenta para esta dirección. Para entrar, restablece tu contraseña o inicia sesión con Google o Apple usando este correo.',
    existingButton: 'Restablecer contraseña',
    existingText: 'Ya tienes una cuenta de LangX. Restablece tu contraseña aquí: {url}',

    existingLinkBody:
      'Alguien ha intentado registrarse con este correo, pero ya tienes una cuenta aquí, con tu perfil en ella. Toca para entrar: no hay contraseña que recordar. El enlace funciona una vez y caduca en 15 minutos.',
    existingLinkText:
      'Ya tienes una cuenta de LangX. Entra aquí (funciona una vez, caduca en 15 minutos): {url}',

    whyThisMail: 'Recibes esto por tus ajustes de notificaciones de LangX.',
    unsubscribeLink: 'Desactivar estos correos',
    unsubscribeText: 'Desactivar estos correos: {url}',
    managePrefs: 'Todos los ajustes de notificaciones',
    /** The dark panel under every mail: the QR to get.langx.io. */
    getApp: 'Descarga la app',
    getAppScan: 'Escanea con tu móvil o abre',
    getAppPlatforms: 'iPhone · Android · Navegador',
    /** The one button a streak email has. */
    openChats: 'Enviar un mensaje',

    digestSubject: {
      one: '1 mensaje sin leer en LangX',
      other: '{count} mensajes sin leer en LangX',
    },
    digestPreheader: 'Hay quien espera tu respuesta',
    digestBody: {
      one: '{names} te escribió mientras no estabas.',
      other: 'Tienes {count} mensajes sin leer, de {names}.',
    },
    digestMore: { one: 'Y una conversación más.', other: 'Y {count} conversaciones más.' },
    digestButton: 'Leer y responder',

    visitsSubject: {
      one: '1 persona vio tu perfil esta semana',
      other: '{count} personas vieron tu perfil esta semana',
    },
    visitsPreheader: 'Tu perfil está llamando la atención',
    visitsBody: {
      one: '1 persona miró tu perfil en la última semana.',
      other: '{count} personas miraron tu perfil en la última semana.',
    },
    visitsNames: 'Entre ellas: {names}.',
    visitsLocked: 'Mejora tu plan para ver quiénes fueron.',
    visitsButton: 'Ver quién te visitó',

    badgeOneSubject: 'Nueva insignia: {label}',
    badgeManySubject: {
      one: 'Ganaste 1 insignia nueva',
      other: 'Ganaste {count} insignias nuevas',
    },
    badgeBody: 'Ya está en tu perfil, a la vista de quien entre.',
    badgeButton: 'Ver tus insignias',

    unsubscribeTitle: '¿Desactivar estos correos?',
    unsubscribeBody:
      'Dejarás de recibir {kind} por correo. Las notificaciones del teléfono no cambian.',
    unsubscribeConfirm: 'Desactivarlos',
    unsubscribeAll: 'O desactivar todos los correos de LangX',
    unsubscribedTitle: 'Listo, no llegarán más.',
    unsubscribedBody:
      'Puedes volver a activarlos cuando quieras en LangX, en Ajustes → Notificaciones.',
    unsubscribeInvalid:
      'Este enlace no es válido. Abre LangX y cámbialo en Ajustes → Notificaciones.',

    /** The monthly recap. Two halves: the reader's numbers and everybody's. */

    newsletterSubject: 'Tu {month} en LangX',

    newsletterPreheader: 'El mes en números, el tuyo y el de todos',

    newsletterYours: 'Tu mes',

    newsletterEverybody: 'El mes de todos',

    newsletterQuiet:
      'Este mes estuviste en silencio: ni mensajes ni correcciones. La gente de abajo no lo estuvo, y sigue aquí.',

    newsletterMessages: 'Mensajes enviados',

    newsletterCorrections: 'Correcciones hechas',

    newsletterTokens: 'Tokens ganados',

    newsletterStreak: 'Racha hoy',

    newsletterNewMembers: 'Nuevos miembros',

    newsletterMessagesSent: 'Mensajes enviados',

    newsletterCorrectionsMade: 'Correcciones hechas',

    newsletterButton: 'Abrir LangX',

    /**

     * The nudges in `modules/notifications/promotions.ts`, in its order.

     * Every one of them is behind a switch and carries a way out.

     */

    promo: {
      addPhotoSubject: 'Añade una foto y te encontrarán',

      addPhotoBody:
        'Los perfiles con cara reciben muchas más respuestas. Tarda diez segundos y puedes cambiarla cuando quieras.',

      addPhotoButton: 'Añadir mi foto',

      streakBrokeSubject: {
        one: 'Tu racha de {count} día se ha roto',
        other: 'Tu racha de {count} días se ha roto',
      },

      streakBrokeBody:
        'Te faltó ayer. Una reparación de la tienda devuelve el día y la racha continúa.',

      streakBrokeButton: 'Reparar ayer',

      awaySubject: 'La gente sigue practicando sin ti',

      awayBody:
        'Ha pasado una semana. Hay gente nueva con quien hablar, y tus idiomas no han cambiado.',

      awayButton: 'Ver quién está',

      awayLongSubject: 'Después de esto dejaremos de escribir',

      awayLongBody:
        'Un mes es mucho tiempo. Tu cuenta, tu racha y tus tokens siguen aquí si los quieres, y esto es lo último que diremos.',

      awayLongButton: 'Abrir LangX',

      tokensWaitingSubject: {
        one: 'Tienes {count} token esperando',
        other: 'Tienes {count} tokens esperando',
      },

      tokensWaitingBody:
        'Los tokens compran congelaciones de racha, reparaciones, marcos y títulos. Los tuyos llevan quince días ahí.',

      tokensWaitingButton: 'Abrir mi cartera',

      inviteFriendSubject: 'Practicar es mejor con alguien conocido',

      inviteFriendBody:
        'Invita a alguien y los dos ganáis tokens cuando entre. Tu enlace está en Ajustes.',

      inviteFriendButton: 'Ver mi enlace',
    },

    /** Onboarding finished: one mail, once in an account's life. */

    welcomeSubject: 'Te damos la bienvenida a LangX',

    welcomePreheader: 'Tu primera conversación está a un toque',

    welcomeTitle: 'Hola, {name}',

    welcomeBody: 'Tu perfil ya está en @{handle}. Esto es lo que hace la gente primero:',

    welcomeStep1: 'Encuentra a alguien que hable lo que estás aprendiendo y salúdalo.',

    welcomeStep2: 'Publica una frase en el Feed y deja que la corrijan.',

    welcomeStep3: 'Vuelve mañana: dos días seguidos inician una racha.',

    welcomeButton: 'Buscar con quién practicar',

    /** A day later, for an address nobody confirmed. */

    verifyReminderSubject: 'Confirma tu correo electrónico',

    verifyReminderPreheader: 'Un toque y tu cuenta estará lista',

    verifyReminderBody:
      'A tu cuenta de LangX solo le falta una cosa: comprobar que este correo es tuyo. El enlace de abajo lo hace.',

    verifyReminderText: 'Confirma tu correo electrónico: {url}',

    /** Money, so no switch — see `billingEmail`. */

    billingPlan: 'Plan: {tier}',

    billing: {
      paymentFailedTitle: 'Tu pago de LangX no se pudo procesar',

      paymentFailedBody:
        'La tienda no pudo cobrar tu suscripción. Lo intentará de nuevo y tu plan sigue activo mientras tanto.',

      paymentFailedButton: 'Ver mi plan',

      planEndedTitle: 'Tu plan de LangX ha terminado',

      planEndedBody:
        'Tu suscripción terminó y tu cuenta volvió al plan gratuito. Todo lo que creaste sigue ahí.',

      planEndedButton: 'Ver los planes',
    },

    /**

     * The security notices. No switch behind them and no unsubscribe —

     * see `modules/security/notify.ts`.

     */

    securityDevice: 'Dispositivo',

    securityPlace: 'Lugar',

    securityWhen: 'Cuándo',

    securityNotYou:
      'Si no fuiste tú, cambia tu contraseña ahora: cierra la sesión en todos los demás dispositivos.',

    securityButton: 'Cambiar mi contraseña',

    security: {
      newSignInTitle: 'Nuevo inicio de sesión en tu cuenta de LangX',

      newSignInBody:
        'Alguien inició sesión en tu cuenta desde un dispositivo que no habíamos visto antes.',

      passwordChangedTitle: 'Tu contraseña de LangX ha cambiado',

      passwordChangedBody: 'La contraseña de tu cuenta acaba de cambiarse.',

      methodLinkedTitle: 'Se añadió un método de inicio de sesión a tu cuenta de LangX',

      methodLinkedBody: 'Se conectó el inicio de sesión con Google o Apple a tu cuenta.',

      methodUnlinkedTitle: 'Se eliminó un método de inicio de sesión de tu cuenta de LangX',

      methodUnlinkedBody: 'Se desconectó una forma de iniciar sesión en tu cuenta.',
    },

    kind: {
      messages: 'los resúmenes de mensajes',
      streak: 'los recordatorios de racha',
      profileVisits: 'los resúmenes de visitas a tu perfil',
      promotions: 'las novedades y ofertas',
      all: 'el correo de LangX',
      v1contact: 'el único mensaje sobre el nuevo LangX',
    },
    bountySubject: {
      one: 'Ganaste {count} ficha por tu aviso',
      other: 'Ganaste {count} fichas por tu aviso',
    },
    bountyPreheader: 'Gracias por avisarnos.',
    bountyBody: {
      one: 'Leímos lo que nos enviaste y añadimos {count} ficha a tu cartera. Así es como mejora la app: gracias.',
      other:
        'Leímos lo que nos enviaste y añadimos {count} fichas a tu cartera. Así es como mejora la app: gracias.',
    },
    bountyButton: 'Abrir mi cartera',
    bountyText: {
      one: 'Se añadió {count} ficha a tu cartera por el aviso que enviaste: {url}',
      other: 'Se añadieron {count} fichas a tu cartera por el aviso que enviaste: {url}',
    },

    suspendedSubject: 'Tu cuenta de LangX ha sido suspendida',
    suspendedPreheader: 'Se revisó un reporte sobre tu cuenta',
    suspendedUntilBody:
      'Una persona revisó un reporte sobre tu cuenta y queda suspendida hasta el {until}. Hasta entonces no puedes usar LangX, y tu perfil no aparece en Descubrir ni en la búsqueda.',
    suspendedPermanentBody:
      'Una persona revisó un reporte sobre tu cuenta y queda suspendida de forma permanente. Tu perfil no aparece en Descubrir ni en la búsqueda.',
    suspendedReason: 'Motivo: {reason}',
    suspendedAppeal:
      'Si crees que es un error, puedes apelar una vez desde la app o respondiendo a este correo.',
    suspendedText:
      'Tu cuenta de LangX está suspendida. {detail} {reason} Puedes apelar una vez desde la app.',
    suspensionUpdatedSubject: 'Tu suspensión de LangX se ha actualizado',
    suspensionUpdatedPreheader: 'Hemos visto tu apelación',
    suspensionUpdatedShortened: 'Leímos tu apelación. Tu suspensión ahora termina el {until}.',
    suspensionUpdatedLifted:
      'Leímos tu apelación. Tu suspensión se ha levantado: ya puedes usar LangX.',
    suspensionUpdatedText: 'Tu suspensión de LangX se ha actualizado. {detail}',
  },

  reportReason: {
    spam: 'Spam',
    harassment: 'Acoso',
    hateSpeech: 'Discurso de odio',
    inappropriateContent: 'Contenido inapropiado',
    fakeProfile: 'Perfil falso',
    underage: 'Menor de 16 años',
    other: 'Otra cosa',
  },
}

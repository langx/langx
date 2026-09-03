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
  },

  email: {
    ignore: 'Si no has solicitado esto, puedes ignorar este correo.',
    orPaste: 'O pega este enlace: {url}',

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

    whyThisMail: 'Recibes esto por tus ajustes de notificaciones de LangX.',
    unsubscribeLink: 'Desactivar estos correos',
    unsubscribeText: 'Desactivar estos correos: {url}',
    managePrefs: 'Todos los ajustes de notificaciones',
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

    kind: {
      messages: 'los resúmenes de mensajes',
      streak: 'los recordatorios de racha',
      profileVisits: 'los resúmenes de visitas a tu perfil',
      promotions: 'las novedades y ofertas',
      all: 'el correo de LangX',
    },
  },
}

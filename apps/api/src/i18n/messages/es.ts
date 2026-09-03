import type { Localized } from '@langx/shared'
import type { ServerMessages } from './en'

export const es: Localized<ServerMessages> = {
  push: {
    streakTitle: { one: '¡Racha de {count} día! 🔥', other: '¡Racha de {count} días! 🔥' },
    streakBody: 'Envía un mensaje hoy para mantenerla.',
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

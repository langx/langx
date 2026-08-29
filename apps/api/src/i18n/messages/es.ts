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
  },
}

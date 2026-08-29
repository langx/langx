import type { Localized } from '@langx/shared'
import type { ServerMessages } from './en'

export const ptBR: Localized<ServerMessages> = {
  push: {
    streakTitle: { one: 'Sequência de {count} dia! 🔥', other: 'Sequência de {count} dias! 🔥' },
    streakBody: 'Mande uma mensagem hoje para mantê-la.',
  },

  email: {
    ignore: 'Se você não pediu isso, pode ignorar este e-mail.',
    orPaste: 'Ou cole este link: {url}',

    verifySubject: 'Confirme seu e-mail no LangX',
    verifyPreheader: 'Confirme seu e-mail para terminar de configurar o LangX',
    verifyBody: 'Confirme que este é o seu e-mail para terminar de criar sua conta.',
    verifyButton: 'Confirmar e-mail',
    verifyText: 'Confirme seu e-mail no LangX: {url}',

    resetSubject: 'Redefina sua senha do LangX',
    resetPreheader: 'Redefina sua senha do LangX',
    resetBody: 'Alguém pediu para redefinir a senha desta conta. Se foi você:',
    resetButton: 'Redefinir senha',
    resetText: 'Redefina sua senha do LangX: {url}',
  },
}

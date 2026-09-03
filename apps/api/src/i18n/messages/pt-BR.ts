import type { Localized } from '@langx/shared'
import type { ServerMessages } from './en'

export const ptBR: Localized<ServerMessages> = {
  push: {
    streakTitle: { one: 'Sequência de {count} dia! 🔥', other: 'Sequência de {count} dias! 🔥' },
    streakBody: 'Mande uma mensagem hoje para mantê-la.',
    profileVisitsTitle: {
      one: '1 pessoa viu seu perfil',
      other: '{count} pessoas viram seu perfil',
    },
    profileVisitsBody: 'Toque para ver quem.',
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

    whyThisMail: 'Você recebe isto por causa das suas configurações de notificações do LangX.',
    unsubscribeLink: 'Desativar estes e-mails',
    unsubscribeText: 'Desativar estes e-mails: {url}',
    managePrefs: 'Todas as configurações de notificações',
    /** The one button a streak email has. */
    openChats: 'Enviar uma mensagem',

    digestSubject: {
      one: '1 mensagem não lida no LangX',
      other: '{count} mensagens não lidas no LangX',
    },
    digestPreheader: 'Tem gente esperando sua resposta',
    digestBody: {
      one: '{names} te escreveu enquanto você esteve fora.',
      other: 'Você tem {count} mensagens não lidas, de {names}.',
    },
    digestMore: { one: 'E mais uma conversa.', other: 'E mais {count} conversas.' },
    digestButton: 'Ler e responder',

    visitsSubject: {
      one: '1 pessoa viu seu perfil esta semana',
      other: '{count} pessoas viram seu perfil esta semana',
    },
    visitsPreheader: 'Seu perfil está chamando atenção',
    visitsBody: {
      one: '1 pessoa olhou seu perfil na última semana.',
      other: '{count} pessoas olharam seu perfil na última semana.',
    },
    visitsNames: 'Entre elas: {names}.',
    visitsLocked: 'Faça upgrade para ver quem foram.',
    visitsButton: 'Ver quem visitou',

    unsubscribeTitle: 'Desativar estes e-mails?',
    unsubscribeBody:
      'Você deixará de receber {kind} por e-mail. As notificações no telefone não mudam.',
    unsubscribeConfirm: 'Desativar',
    unsubscribeAll: 'Ou desativar todos os e-mails do LangX',
    unsubscribedTitle: 'Pronto — não chegam mais.',
    unsubscribedBody: 'Você pode reativar quando quiser no LangX, em Configurações → Notificações.',
    unsubscribeInvalid:
      'Este link não é válido. Abra o LangX e altere em Configurações → Notificações.',

    kind: {
      messages: 'os resumos de mensagens',
      streak: 'os lembretes de sequência',
      profileVisits: 'os resumos de visitas ao perfil',
      promotions: 'as novidades e ofertas',
      all: 'os e-mails do LangX',
    },
  },
}

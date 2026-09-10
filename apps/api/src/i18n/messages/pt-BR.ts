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
    badgeOneTitle: 'Nova medalha: {label} 🏅',
    badgeManyTitle: {
      one: 'Você ganhou 1 medalha nova 🏅',
      other: 'Você ganhou {count} medalhas novas 🏅',
    },
    badgeBody: 'Mandou bem. Continue assim.',
    meetingTitle: 'Seu intercâmbio de idiomas é daqui a uma hora',
    meetingBody: 'Toque para abrir a conversa.',
    bountyTitle: {
      one: '{count} ficha pelo seu aviso 🎉',
      other: '{count} fichas pelo seu aviso 🎉',
    },
    bountyBody: 'Lemos o que você enviou, e valeu a pena.',
    /** Security, which no preference can switch off. */
    securityBody: 'Abra o LangX se não foi você.',
    securityBodyDevice: 'De {device}. Abra o LangX se não foi você.',
    security: {
      newSignInTitle: 'Novo acesso à sua conta',
      passwordChangedTitle: 'Sua senha foi alterada',
      methodLinkedTitle: 'Método de login adicionado',
      methodUnlinkedTitle: 'Método de login removido',
    },
  },

  email: {
    ignore: 'Se você não pediu isso, pode ignorar este e-mail.',
    orPaste: 'Ou cole este link: {url}',

    deleteSubject: 'Confirme que você quer excluir sua conta LangX',
    deletePreheader: 'Mais um passo para excluir sua conta LangX',
    deleteBody:
      'Você pediu para excluir sua conta LangX. Confirme abaixo e ela entrará na fila de exclusão — você tem 30 dias para mudar de ideia, basta entrar novamente.',
    deleteButton: 'Excluir minha conta',
    deleteText: 'Confirme a exclusão da sua conta LangX: {url}',
    deleteInvalid: 'Este link expirou ou já foi usado.',
    deleteConfirmTitle: 'Excluir sua conta LangX',
    deleteConfirmBody: 'Isso agenda a exclusão da sua conta. Entrar novamente em 30 dias cancela.',
    deleteConfirmButton: 'Sim, excluir minha conta',
    deleteDoneTitle: 'Sua conta está agendada para exclusão',
    deleteDoneBody: 'Entre de novo em até {days} dias e tudo volta.',
    deleteDonePurge: 'Os dados são removidos em {date}.',

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
    magicLinkSubject: 'Seu link de acesso ao LangX',
    magicLinkPreheader: 'Toque para entrar no LangX',
    magicLinkBody: 'Toque no botão para entrar. O link funciona uma vez e expira em 15 minutos.',
    magicLinkButton: 'Entrar no LangX',
    magicLinkText: 'Entre no LangX (funciona uma vez, expira em 15 minutos): {url}',

    existingSubject: 'Você já tem uma conta no LangX',
    existingPreheader: 'Você já tem uma conta no LangX',
    existingBody:
      'Alguém tentou se cadastrar com este e-mail, mas já existe uma conta para ele. Para entrar, redefina sua senha ou entre com Google ou Apple usando este endereço.',
    existingButton: 'Redefinir senha',
    existingText: 'Você já tem uma conta no LangX. Redefina sua senha aqui: {url}',

    existingLinkBody:
      'Alguém tentou se cadastrar com este e-mail, mas você já tem uma conta aqui, com o seu perfil nela. Toque para entrar — não há senha para lembrar. O link funciona uma vez e expira em 15 minutos.',
    existingLinkText:
      'Você já tem uma conta no LangX. Entre aqui (funciona uma vez, expira em 15 minutos): {url}',

    whyThisMail: 'Você recebe isto por causa das suas configurações de notificações do LangX.',
    unsubscribeLink: 'Desativar estes e-mails',
    unsubscribeText: 'Desativar estes e-mails: {url}',
    managePrefs: 'Todas as configurações de notificações',
    /** The dark panel under every mail: the QR to get.langx.io. */
    getApp: 'Baixe o app',
    getAppScan: 'Escaneie com o celular ou abra',
    getAppPlatforms: 'iPhone · Android · Navegador',
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

    badgeOneSubject: 'Nova medalha: {label}',
    badgeManySubject: {
      one: 'Você ganhou 1 medalha nova',
      other: 'Você ganhou {count} medalhas novas',
    },
    badgeBody: 'Já está no seu perfil, à vista de quem entrar.',
    badgeButton: 'Ver suas medalhas',

    unsubscribeTitle: 'Desativar estes e-mails?',
    unsubscribeBody:
      'Você deixará de receber {kind} por e-mail. As notificações no telefone não mudam.',
    unsubscribeConfirm: 'Desativar',
    unsubscribeAll: 'Ou desativar todos os e-mails do LangX',
    unsubscribedTitle: 'Pronto — não chegam mais.',
    unsubscribedBody: 'Você pode reativar quando quiser no LangX, em Configurações → Notificações.',
    unsubscribeInvalid:
      'Este link não é válido. Abra o LangX e altere em Configurações → Notificações.',

    /**

     * The security notices. No switch behind them and no unsubscribe —

     * see `modules/security/notify.ts`.

     */

    securityDevice: 'Dispositivo',

    securityPlace: 'Local',

    securityWhen: 'Quando',

    securityNotYou:
      'Se não foi você, mude sua senha agora — isso desconecta todos os outros dispositivos.',

    securityButton: 'Mudar minha senha',

    security: {
      newSignInTitle: 'Novo acesso à sua conta LangX',

      newSignInBody: 'Alguém entrou na sua conta a partir de um dispositivo que nunca vimos antes.',

      passwordChangedTitle: 'Sua senha do LangX foi alterada',

      passwordChangedBody: 'A senha da sua conta acabou de ser alterada.',

      methodLinkedTitle: 'Um método de login foi adicionado à sua conta LangX',

      methodLinkedBody: 'O login com Google ou Apple foi conectado à sua conta.',

      methodUnlinkedTitle: 'Um método de login foi removido da sua conta LangX',

      methodUnlinkedBody: 'Uma forma de entrar na sua conta foi desconectada.',
    },

    kind: {
      messages: 'os resumos de mensagens',
      streak: 'os lembretes de sequência',
      profileVisits: 'os resumos de visitas ao perfil',
      promotions: 'as novidades e ofertas',
      all: 'os e-mails do LangX',
      v1contact: 'a única mensagem sobre o novo LangX',
    },
    bountySubject: {
      one: 'Você ganhou {count} ficha pelo seu aviso',
      other: 'Você ganhou {count} fichas pelo seu aviso',
    },
    bountyPreheader: 'Obrigado por nos avisar.',
    bountyBody: {
      one: 'Lemos o que você enviou e adicionamos {count} ficha à sua carteira. É assim que o app melhora — obrigado.',
      other:
        'Lemos o que você enviou e adicionamos {count} fichas à sua carteira. É assim que o app melhora — obrigado.',
    },
    bountyButton: 'Abrir minha carteira',
    bountyText: {
      one: '{count} ficha foi adicionada à sua carteira pelo aviso que você enviou: {url}',
      other: '{count} fichas foram adicionadas à sua carteira pelo aviso que você enviou: {url}',
    },
  },
}

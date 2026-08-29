import type { Localized } from '@langx/shared'
import type { ServerMessages } from './en'

export const tr: Localized<ServerMessages> = {
  push: {
    streakTitle: { one: '{count} günlük seri! 🔥', other: '{count} günlük seri! 🔥' },
    streakBody: 'Seriyi sürdürmek için bugün bir mesaj gönder.',
  },

  email: {
    ignore: 'Bunu sen istemediysen bu e-postayı yok sayabilirsin.',
    orPaste: 'Ya da bu bağlantıyı yapıştır: {url}',

    verifySubject: 'LangX e-posta adresini doğrula',
    verifyPreheader: 'LangX kurulumunu bitirmek için e-postanı doğrula',
    verifyBody: 'Hesabının kurulumunu bitirmek için bu adresin sana ait olduğunu onayla.',
    verifyButton: 'E-postayı doğrula',
    verifyText: 'LangX e-posta adresini doğrula: {url}',

    resetSubject: 'LangX parolanı sıfırla',
    resetPreheader: 'LangX parolanı sıfırla',
    resetBody: 'Bu hesap için bir parola sıfırlama isteği geldi. Bu sensen:',
    resetButton: 'Parolayı sıfırla',
    resetText: 'LangX parolanı sıfırla: {url}',
  },
}

import { describe, expect, it } from 'vitest'
import { coversCyrillic, detectCyrillicLang, romanizeCyrillic } from './cyrillic'

describe('romanizeCyrillic — Russian (BGN/PCGN, simplified)', () => {
  it('writes the ordinary letters', () => {
    expect(romanizeCyrillic('Привет, как дела?', 'ru')).toBe('Privet, kak dela?')
    expect(romanizeCyrillic('французских булок', 'ru')).toBe('frantsuzskikh bulok')
  })

  it('iotates е at the start, after a vowel and after a sign', () => {
    expect(romanizeCyrillic('Елена', 'ru')).toBe('Yelena')
    expect(romanizeCyrillic('моё мое', 'ru')).toBe('moyo moye')
    expect(romanizeCyrillic('съешь', 'ru')).toBe('syesh')
    expect(romanizeCyrillic('лето', 'ru')).toBe('leto')
  })

  it('says ё as o after a hushing consonant', () => {
    expect(romanizeCyrillic('шёл ёж', 'ru')).toBe('shol yozh')
  })

  it('keeps a capitalised word capitalised and a shouted one shouted', () => {
    expect(romanizeCyrillic('Щука', 'ru')).toBe('Shchuka')
    expect(romanizeCyrillic('ЩИ', 'ru')).toBe('SHCHI')
    expect(romanizeCyrillic('Я', 'ru')).toBe('Ya')
  })

  it('leaves Latin, digits, punctuation and emoji alone', () => {
    expect(romanizeCyrillic('Мама 😀 123, OK!', 'ru')).toBe('Mama 😀 123, OK!')
  })
})

describe('romanizeCyrillic — the other four', () => {
  it('writes Ukrainian by the 2010 national standard', () => {
    expect(romanizeCyrillic('Київ, Україна', 'uk')).toBe('Kyiv, Ukraina')
    expect(romanizeCyrillic('Юрій Стрий Єва', 'uk')).toBe('Yurii Stryi Yeva')
    expect(romanizeCyrillic('Згорани', 'uk')).toBe('Zghorany')
    // The apostrophe is dropped and does not start a new word.
    expect(romanizeCyrillic('м’ясо', 'uk')).toBe('miaso')
  })

  it('writes Belarusian with ў as w', () => {
    expect(romanizeCyrillic('Беларусь, Мінск, воўк', 'be')).toBe('Belarus, Minsk, vowk')
    expect(romanizeCyrillic("з'ехаць", 'be')).toBe('zyekhats')
  })

  it("writes Serbian in the language's own Latin alphabet", () => {
    expect(romanizeCyrillic('Ђорђе Љубљана џеп Ћуприја', 'sr')).toBe('Đorđe Ljubljana džep Ćuprija')
    expect(romanizeCyrillic('ЉУБАВ', 'sr')).toBe('LJUBAV')
  })

  it('writes Bulgarian by the Streamlined System', () => {
    expect(romanizeCyrillic('България', 'bg')).toBe('Balgaria')
    expect(romanizeCyrillic('щастие, ъгъл, Жълт', 'bg')).toBe('shtastie, agal, Zhalt')
    expect(romanizeCyrillic('моя', 'bg')).toBe('moya')
  })
})

describe('detectCyrillicLang', () => {
  it('reads the letters only one language has', () => {
    expect(detectCyrillicLang('Ђорђе')).toBe('sr')
    expect(detectCyrillicLang('воўк')).toBe('be')
    expect(detectCyrillicLang('Київ')).toBe('uk')
    expect(detectCyrillicLang('Мінськ')).toBe('uk')
    expect(detectCyrillicLang('Мінск і ты')).toBe('be')
    expect(detectCyrillicLang('это ещё')).toBe('ru')
  })

  it('tells Bulgarian by a ъ between consonants', () => {
    expect(detectCyrillicLang('Къде си?')).toBe('bg')
    expect(detectCyrillicLang('подъезд')).toBe('ru')
  })

  it('gives up on letters none of the five has', () => {
    expect(detectCyrillicLang('қазақ тілі')).toBeUndefined()
    expect(coversCyrillic('қазақ', 'ru')).toBe(false)
  })
})

import { readFileSync } from 'node:fs'
import { join } from 'node:path'
import { describe, expect, it } from 'vitest'
import { ECHO_SYNTH_VOICES } from './echoPacks'
import {
  attributedVoices,
  detectSpeechLanguage,
  isSpeakableLength,
  messageSpeechSchema,
  SPEECH_DETECT_ISO3,
  SPEECH_LANGUAGES,
  SPEECH_MIN_DETECT_LENGTH,
  speechLanguageFromIso3,
  speechVoicesFor,
  SPEECH_VOICES,
  TTS_MAX_TEXT_LENGTH,
} from './speech'

describe('the voice table', () => {
  it('reads thirty-seven languages, and not the ones we are not licensed for', () => {
    expect(SPEECH_LANGUAGES).toHaveLength(37)
    // The catalogue has voices for all four. Every one of them is CC BY-NC,
    // which an app that sells subscriptions cannot use — so they stay silent
    // rather than being read by a model we are not allowed to ship.
    for (const unlicensed of ['tr', 'ar', 'ja', 'ko']) {
      expect(speechVoicesFor(unlicensed)).toEqual([])
    }
  })

  it('leads every language with a voice, and keeps Kokoro first where it reads', () => {
    for (const lang of SPEECH_LANGUAGES) {
      expect(speechVoicesFor(lang).length).toBeGreaterThan(0)
    }
    // Chat plays `[0]`, and Echo synthesises Kokoro's list in order. They must
    // agree or the two surfaces write two objects for the same sentence.
    for (const [lang, voices] of Object.entries(ECHO_SYNTH_VOICES)) {
      expect(speechVoicesFor(lang).map((voice) => voice.id)).toEqual([...voices])
      expect(speechVoicesFor(lang)[0]?.engine).toBe('kokoro')
    }
  })

  it('credits every voice whose licence obliges it, and only those', () => {
    for (const voice of Object.values(SPEECH_VOICES).flat()) {
      if (voice.license === 'CC-BY-4.0' || voice.license === 'CC-BY-SA-4.0') {
        expect(voice.attribution, voice.id).toBeTruthy()
      } else {
        expect(voice.attribution, voice.id).toBeUndefined()
      }
      if (voice.engine === 'piper') expect(voice.model, voice.id).toMatch(/\.onnx$/)
    }
    expect(attributedVoices().length).toBeGreaterThan(0)
    expect(attributedVoices().every((voice) => voice.attribution)).toBe(true)
  })

  /**
   * `apps/tts/server.py` keeps its own copy of what Kokoro reads, because it
   * is Python and cannot import this file. Nothing but this test notices when
   * the two drift, and drift here means a language the app offers and the
   * service answers 400 for.
   */
  it('agrees with the voice service about Kokoro and about the length cap', () => {
    const source = readFileSync(join(__dirname, '../../../apps/tts/server.py'), 'utf8')

    const table = source.slice(source.indexOf('LANGUAGES = {'), source.indexOf('MAX_TEXT'))
    const langs = [...table.matchAll(/^\s{4}"([a-z]{2})":/gm)].map((match) => match[1])
    expect(langs.sort()).toEqual(Object.keys(ECHO_SYNTH_VOICES).sort())

    const max = source.match(/^MAX_TEXT = (\d+)$/m)
    expect(Number(max?.[1])).toBe(TTS_MAX_TEXT_LENGTH)
  })
})

describe('detectSpeechLanguage', () => {
  const long = 'guten morgen wie geht es dir heute'

  it('believes a provider that looked at this exact sentence', () => {
    // Beats the detector even when the detector is confident and disagrees.
    expect(detectSpeechLanguage(long, { sourceLang: 'nl', detected: 'deu' })).toBe('nl')
    // ...but not into a language nothing can read.
    expect(detectSpeechLanguage(long, { sourceLang: 'tr', detected: 'deu' })).toBe('de')
  })

  it('takes the detector past the minimum length and ignores it below', () => {
    expect(detectSpeechLanguage(long, { detected: 'deu' })).toBe('de')
    expect('hallo'.length).toBeLessThan(SPEECH_MIN_DETECT_LENGTH)
    expect(detectSpeechLanguage('hallo', { detected: 'deu' })).toBeUndefined()
  })

  it('drops a detected language no voice reads', () => {
    expect(detectSpeechLanguage('bugün hava çok güzel', { detected: 'tur' })).toBeUndefined()
    expect(detectSpeechLanguage('今日はいい天気ですね本当に', { detected: 'jpn' })).toBeUndefined()
  })

  it('falls back to the conversation only when it narrows to one language', () => {
    expect(detectSpeechLanguage('ok', { contextLangs: ['de'] })).toBe('de')
    expect(detectSpeechLanguage('ok', { contextLangs: ['de', 'de'] })).toBe('de')
    // Two candidates is a guess, and a wrong accent is worse than silence.
    expect(detectSpeechLanguage('ok', { contextLangs: ['de', 'nl'] })).toBeUndefined()
    // A context language nothing reads does not count towards the one.
    expect(detectSpeechLanguage('ok', { contextLangs: ['tr', 'de'] })).toBe('de')
    expect(detectSpeechLanguage('ok', { contextLangs: [] })).toBeUndefined()
  })

  it('says nothing about an empty sentence, whatever it is told', () => {
    expect(detectSpeechLanguage('   ', { sourceLang: 'de', detected: 'deu' })).toBeUndefined()
  })
})

describe('the detector contract', () => {
  it('offers the detector only codes some voice can read', () => {
    for (const iso3 of SPEECH_DETECT_ISO3) {
      expect(speechLanguageFromIso3(iso3), iso3).toBeDefined()
    }
    expect(speechLanguageFromIso3('tur')).toBeUndefined()
    expect(speechLanguageFromIso3('nonsense')).toBeUndefined()
  })

  it('maps the varieties a detector names where we name a language', () => {
    expect(speechLanguageFromIso3('cmn')).toBe('zh')
    expect(speechLanguageFromIso3('nob')).toBe('no')
    expect(speechLanguageFromIso3('als')).toBe('sq')
    expect(speechLanguageFromIso3('pes')).toBe('fa')
  })
})

describe('isSpeakableLength', () => {
  it('takes a sentence up to the cap and refuses either side of it', () => {
    expect(isSpeakableLength('a')).toBe(true)
    expect(isSpeakableLength('a'.repeat(TTS_MAX_TEXT_LENGTH))).toBe(true)
    expect(isSpeakableLength('a'.repeat(TTS_MAX_TEXT_LENGTH + 1))).toBe(false)
    expect(isSpeakableLength('   ')).toBe(false)
    // Trimmed before measuring, the way the server trims before hashing.
    expect(isSpeakableLength(`  ${'a'.repeat(TTS_MAX_TEXT_LENGTH)}  `)).toBe(true)
  })
})

describe('messageSpeechSchema', () => {
  it('round-trips a reading and refuses one without a real URL', () => {
    const reading = {
      url: 'https://media.langx.io/echo/tts/de/de_DE-thorsten-medium/abc.m4a',
      voice: 'de_DE-thorsten-medium',
      lang: 'de',
      cached: true,
    }
    expect(messageSpeechSchema.parse(reading)).toEqual(reading)
    expect(messageSpeechSchema.safeParse({ ...reading, url: 'not-a-url' }).success).toBe(false)
    expect(messageSpeechSchema.safeParse({ ...reading, lang: 'zz' }).success).toBe(false)
  })
})

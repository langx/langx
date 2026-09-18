import { describe, expect, it } from 'vitest'
import { ECHO_SYNTH_VOICES } from './echoPacks'
import {
  attributedVoices,
  detectSpeechLanguage,
  isSpeakableLength,
  messageSpeechSchema,
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
})

describe('detectSpeechLanguage', () => {
  const german = 'guten morgen wie geht es dir heute'
  const learners = ['en', 'de']

  it('believes a provider that looked at this exact sentence', () => {
    // Beats the detector even when the detector disagrees, and needs no
    // corroboration: Google read the sentence, it did not guess from trigrams.
    expect(detectSpeechLanguage(german, { sourceLang: 'nl', detected: 'deu' })).toBe('nl')
    // ...but not into a language nothing can read.
    expect(
      detectSpeechLanguage(german, { sourceLang: 'tr', detected: 'deu', contextLangs: learners }),
    ).toBe('de')
  })

  it('takes a detection the conversation corroborates', () => {
    expect(detectSpeechLanguage(german, { detected: 'deu', contextLangs: learners })).toBe('de')
  })

  /*
   * The rule the Turkish case bought. `franc` scores Norwegian above Turkish
   * on a Turkish sentence, and we have a Norwegian voice — so without this,
   * "bugün hava gerçekten çok güzel görünüyor" is read aloud in Norwegian.
   */
  it('refuses a detection nobody in the conversation could have written', () => {
    const turkish = 'bugün hava gerçekten çok güzel görünüyor'
    expect(detectSpeechLanguage(turkish, { detected: 'nob', contextLangs: ['en', 'tr'] })).toBeUndefined()
    // And with no context at all there is nothing to corroborate against.
    expect(detectSpeechLanguage(german, { detected: 'deu' })).toBeUndefined()
  })

  it('ignores the detector below the minimum length', () => {
    expect('hallo'.length).toBeLessThan(SPEECH_MIN_DETECT_LENGTH)
    expect(detectSpeechLanguage('hallo', { detected: 'deu', contextLangs: learners })).toBeUndefined()
  })

  it('drops a detected language no voice reads, corroborated or not', () => {
    expect(
      detectSpeechLanguage('bugün hava gerçekten çok güzel', {
        detected: 'tur',
        contextLangs: ['en', 'tr'],
      }),
    ).toBeUndefined()
    expect(
      detectSpeechLanguage('今日はいい天気ですね本当に', { detected: 'jpn', contextLangs: ['ja'] }),
    ).toBeUndefined()
  })

  /*
   * Deliberately absent: inferring the language from the conversation when
   * detection fails. For a short message it picks the pair's one readable
   * language, which for a Turkish speaker practising English turns every
   * "tamam" into an English reading.
   */
  it('does not guess from the conversation alone', () => {
    expect(detectSpeechLanguage('ok', { contextLangs: ['de'] })).toBeUndefined()
    expect(detectSpeechLanguage('tamam', { contextLangs: ['en'] })).toBeUndefined()
  })

  it('says nothing about an empty sentence, whatever it is told', () => {
    expect(
      detectSpeechLanguage('   ', { sourceLang: 'de', detected: 'deu', contextLangs: learners }),
    ).toBeUndefined()
  })
})

describe('the detector contract', () => {
  /*
   * The detector is asked openly and its answer is dropped here, rather than
   * the detector being confined to what we can read — which cannot refuse, and
   * once answered Turkish with Norwegian.
   */
  it('drops an answer no voice reads, however confident it was', () => {
    expect(speechLanguageFromIso3('tur')).toBeUndefined()
    expect(speechLanguageFromIso3('arb')).toBeUndefined()
    expect(speechLanguageFromIso3('jpn')).toBeUndefined()
    expect(speechLanguageFromIso3('kor')).toBeUndefined()
    expect(speechLanguageFromIso3('nonsense')).toBeUndefined()
    expect(speechLanguageFromIso3('deu')).toBe('de')
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

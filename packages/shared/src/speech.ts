import { z } from 'zod'
import { languageCodeSchema } from './languages'

/**
 * The longest sentence the voice service will read, mirroring `MAX_TEXT` in
 * `apps/tts/server.py`. That file is Python and cannot import this one, so the
 * two numbers are equal by hand — a test reads the source and checks.
 */
export const TTS_MAX_TEXT_LENGTH = 400

/** The shortest text worth guessing a language from. See `detectSpeechLanguage`. */
export const SPEECH_MIN_DETECT_LENGTH = 12

export type SpeechEngine = 'kokoro' | 'piper'

/**
 * A licence we may ship. Every one of these permits commercial use; the two
 * `CC-BY` forms additionally oblige us to say whose recording it was, which is
 * what `attribution` carries and what the credits screen renders.
 *
 * Absent on purpose: `CC-BY-NC` in any form. It is not a preference we are
 * expressing — a non-commercial licence simply cannot be used by an app that
 * sells subscriptions, and the catalogue's only Turkish, Arabic, Japanese and
 * Korean voices are all licensed that way. Those languages stay silent until a
 * clean model exists, rather than being read by one we are not allowed to use.
 */
export type SpeechLicense = 'CC0' | 'MIT' | 'Apache-2.0' | 'CC-BY-4.0' | 'CC-BY-SA-4.0'

export interface SpeechVoice {
  /** Kokoro's own name (`af_heart`) or Piper's (`de_DE-thorsten-medium`). */
  id: string
  engine: SpeechEngine
  /** Piper only: the model's path inside `rhasspy/piper-voices`. */
  model?: string
  license: SpeechLicense
  /** Required for `CC-BY*`: who recorded it and where the dataset lives. */
  attribution?: string
}

/**
 * Every voice we can read a sentence in, by language.
 *
 * **Two engines, one table.** Kokoro reads the six languages it was trained
 * for and reads them best, so those stay with it — and stay on the cache keys
 * they already occupy. Piper covers the other thirty-one: smaller models, one
 * per language, phonemised through the same espeak-ng, at a quality below
 * Kokoro's and far above nothing.
 *
 * **The order matters.** A caller that wants one reading takes the first, so
 * the first entry is the one a language leads with. Echo asks for all of them
 * on a card; chat plays only `[0]`, which is also the voice Echo synthesises
 * first — so a sentence that is both echoed and played shares one object.
 *
 * Sixteen languages the catalogue has voices for are missing from this table,
 * including Turkish and Arabic. See `SpeechLicense`.
 *
 * Piper voices carry no register in their name, so `voiceLabel` falls through
 * to "Synthesised" for them rather than claiming a gender we did not check.
 */
export const SPEECH_VOICES: Readonly<Record<string, readonly SpeechVoice[]>> = {

  /*
   * Kokoro's six, from `ECHO_SYNTH_VOICES` — which stays the definition for
   * Echo and the table `apps/tts/server.py` mirrors. Spelled out here rather
   * than spread in, so this file reads as one list and a reader can see which
   * engine answers for a language without following an import.
   */
  en: [
    { id: 'af_heart', engine: 'kokoro', license: 'Apache-2.0' },
    { id: 'am_michael', engine: 'kokoro', license: 'Apache-2.0' },
  ],
  es: [
    { id: 'ef_dora', engine: 'kokoro', license: 'Apache-2.0' },
    { id: 'em_alex', engine: 'kokoro', license: 'Apache-2.0' },
  ],
  fr: [
    { id: 'ff_siwis', engine: 'kokoro', license: 'Apache-2.0' },
  ],
  it: [
    { id: 'if_sara', engine: 'kokoro', license: 'Apache-2.0' },
    { id: 'im_nicola', engine: 'kokoro', license: 'Apache-2.0' },
  ],
  pt: [
    { id: 'pf_dora', engine: 'kokoro', license: 'Apache-2.0' },
    { id: 'pm_alex', engine: 'kokoro', license: 'Apache-2.0' },
  ],
  hi: [
    { id: 'hf_alpha', engine: 'kokoro', license: 'Apache-2.0' },
    { id: 'hm_omega', engine: 'kokoro', license: 'Apache-2.0' },
  ],
  bg: [
    {
      id: 'bg_BG-dimitar-medium',
      engine: 'piper',
      model: 'bg/bg_BG/dimitar/medium/bg_BG-dimitar-medium.onnx',
      license: 'CC0',
    },
  ],
  bn: [
    {
      id: 'bn_BD-google-medium',
      engine: 'piper',
      model: 'bn/bn_BD/google/medium/bn_BD-google-medium.onnx',
      license: 'CC-BY-SA-4.0',
      attribution: 'google (bn_BD), http://www.openslr.org/37/',
    },
  ],
  ca: [
    {
      id: 'ca_ES-upc_ona-medium',
      engine: 'piper',
      model: 'ca/ca_ES/upc_ona/medium/ca_ES-upc_ona-medium.onnx',
      license: 'CC-BY-SA-4.0',
      attribution: 'upc_ona (ca_ES), https://collectivat.cat/asr#upc-festcat-tts-corpora',
    },
  ],
  cs: [
    {
      id: 'cs_CZ-jirka-medium',
      engine: 'piper',
      model: 'cs/cs_CZ/jirka/medium/cs_CZ-jirka-medium.onnx',
      license: 'CC0',
    },
  ],
  cy: [
    {
      id: 'cy_GB-bu_tts-medium',
      engine: 'piper',
      model: 'cy/cy_GB/bu_tts/medium/cy_GB-bu_tts-medium.onnx',
      license: 'CC-BY-4.0',
      attribution: 'bu_tts (cy_GB), https://huggingface.co/datasets/techiaith/bu-tts-cy-en',
    },
  ],
  da: [
    {
      id: 'da_DK-talesyntese-medium',
      engine: 'piper',
      model: 'da/da_DK/talesyntese/medium/da_DK-talesyntese-medium.onnx',
      license: 'CC0',
    },
  ],
  de: [
    {
      id: 'de_DE-thorsten-medium',
      engine: 'piper',
      model: 'de/de_DE/thorsten/medium/de_DE-thorsten-medium.onnx',
      license: 'CC0',
    },
  ],
  el: [
    {
      id: 'el_GR-rapunzelina-medium',
      engine: 'piper',
      model: 'el/el_GR/rapunzelina/medium/el_GR-rapunzelina-medium.onnx',
      license: 'CC0',
    },
  ],
  et: [
    {
      id: 'et_EE-news-medium',
      engine: 'piper',
      model: 'et/et_EE/news/medium/et_EE-news-medium.onnx',
      license: 'CC-BY-4.0',
      attribution: 'news (et_EE), https://metashare.ut.ee/repository/browse/speech-corpus-of-estonian-news-sentences/37b7c5d6a0d411eebb4773db10791bcfb0c0cf788d2d4030bfaf2f2e6e55dd8d/',
    },
  ],
  fa: [
    {
      id: 'fa_IR-amir-medium',
      engine: 'piper',
      model: 'fa/fa_IR/amir/medium/fa_IR-amir-medium.onnx',
      license: 'CC0',
    },
  ],
  fi: [
    {
      id: 'fi_FI-harri-medium',
      engine: 'piper',
      model: 'fi/fi_FI/harri/medium/fi_FI-harri-medium.onnx',
      license: 'CC0',
    },
  ],
  hu: [
    {
      id: 'hu_HU-anna-medium',
      engine: 'piper',
      model: 'hu/hu_HU/anna/medium/hu_HU-anna-medium.onnx',
      license: 'CC0',
    },
  ],
  kk: [
    {
      id: 'kk_KZ-issai-high',
      engine: 'piper',
      model: 'kk/kk_KZ/issai/high/kk_KZ-issai-high.onnx',
      license: 'CC-BY-4.0',
      attribution: 'issai (kk_KZ), https://github.com/IS2AI/Kazakh_TTS',
    },
  ],
  lt: [
    {
      id: 'lt_LT-reginute1-medium',
      engine: 'piper',
      model: 'lt/lt_LT/reginute1/medium/lt_LT-reginute1-medium.onnx',
      license: 'CC-BY-4.0',
      attribution: 'reginute1 (lt_LT), https://huggingface.co/datasets/meldynamics/liepa-tts',
    },
  ],
  lv: [
    {
      id: 'lv_LV-aivars-medium',
      engine: 'piper',
      model: 'lv/lv_LV/aivars/medium/lv_LV-aivars-medium.onnx',
      license: 'CC0',
    },
  ],
  mr: [
    {
      id: 'mr_IN-google-medium',
      engine: 'piper',
      model: 'mr/mr_IN/google/medium/mr_IN-google-medium.onnx',
      license: 'CC-BY-SA-4.0',
      attribution: 'google (mr_IN), https://openslr.org/64/',
    },
  ],
  ne: [
    {
      id: 'ne_NP-chitwan-medium',
      engine: 'piper',
      model: 'ne/ne_NP/chitwan/medium/ne_NP-chitwan-medium.onnx',
      license: 'CC0',
    },
  ],
  nl: [
    {
      id: 'nl_NL-alex-medium',
      engine: 'piper',
      model: 'nl/nl_NL/alex/medium/nl_NL-alex-medium.onnx',
      license: 'CC0',
    },
  ],
  no: [
    {
      id: 'no_NO-nvcc-medium',
      engine: 'piper',
      model: 'no/no_NO/nvcc/medium/no_NO-nvcc-medium.onnx',
      license: 'CC0',
    },
  ],
  pl: [
    {
      id: 'pl_PL-darkman-medium',
      engine: 'piper',
      model: 'pl/pl_PL/darkman/medium/pl_PL-darkman-medium.onnx',
      license: 'CC0',
    },
  ],
  ro: [
    {
      id: 'ro_RO-mihai-medium',
      engine: 'piper',
      model: 'ro/ro_RO/mihai/medium/ro_RO-mihai-medium.onnx',
      license: 'CC0',
    },
  ],
  ru: [
    {
      id: 'ru_RU-denis-medium',
      engine: 'piper',
      model: 'ru/ru_RU/denis/medium/ru_RU-denis-medium.onnx',
      license: 'CC0',
    },
  ],
  sk: [
    {
      id: 'sk_SK-lili-medium',
      engine: 'piper',
      model: 'sk/sk_SK/lili/medium/sk_SK-lili-medium.onnx',
      license: 'CC0',
    },
  ],
  sl: [
    {
      id: 'sl_SI-artur-medium',
      engine: 'piper',
      model: 'sl/sl_SI/artur/medium/sl_SI-artur-medium.onnx',
      license: 'CC-BY-4.0',
      attribution: 'artur (sl_SI), https://huggingface.co/datasets/ppisljar/artur_studio_tts/',
    },
  ],
  sq: [
    {
      id: 'sq_AL-edon-medium',
      engine: 'piper',
      model: 'sq/sq_AL/edon/medium/sq_AL-edon-medium.onnx',
      license: 'CC0',
    },
  ],
  sv: [
    {
      id: 'sv_SE-nst-medium',
      engine: 'piper',
      model: 'sv/sv_SE/nst/medium/sv_SE-nst-medium.onnx',
      license: 'CC0',
    },
  ],
  te: [
    {
      id: 'te_IN-padmavathi-medium',
      engine: 'piper',
      model: 'te/te_IN/padmavathi/medium/te_IN-padmavathi-medium.onnx',
      license: 'CC-BY-4.0',
      attribution: 'padmavathi (te_IN), https://huggingface.co/datasets/ai4bharat/indicvoices_r',
    },
  ],
  uk: [
    {
      id: 'uk_UA-ukrainian_tts-medium',
      engine: 'piper',
      model: 'uk/uk_UA/ukrainian_tts/medium/uk_UA-ukrainian_tts-medium.onnx',
      license: 'CC0',
    },
  ],
  ur: [
    {
      id: 'ur_PK-aegis_female-medium',
      engine: 'piper',
      model: 'ur/ur_PK/aegis_female/medium/ur_PK-aegis_female-medium.onnx',
      license: 'MIT',
    },
  ],
  vi: [
    {
      id: 'vi_VN-vais1000-medium',
      engine: 'piper',
      model: 'vi/vi_VN/vais1000/medium/vi_VN-vais1000-medium.onnx',
      license: 'CC-BY-4.0',
      attribution: 'vais1000 (vi_VN), https://ieee-dataport.org/documents/vais-1000-vietnamese-speech-synthesis-corpus',
    },
  ],
  zh: [
    {
      id: 'zh_CN-chaowen-medium',
      engine: 'piper',
      model: 'zh/zh_CN/chaowen/medium/zh_CN-chaowen-medium.onnx',
      license: 'CC0',
    },
  ],
}

/** The voices that can read `lang`; empty for a language nothing here speaks. */
export function speechVoicesFor(lang: string): readonly SpeechVoice[] {
  return SPEECH_VOICES[lang] ?? []
}

/** Every language some voice can read, for the detector to choose among. */
export const SPEECH_LANGUAGES: readonly string[] = Object.keys(SPEECH_VOICES)

/**
 * ISO 639-3, which is what `franc` answers in, to the codes this app uses.
 *
 * Only the languages we can actually read — a detector allowed to answer
 * anything else would have its answer thrown away anyway, and restricting it
 * up front is what makes a three-word message land on the right one of five
 * Romance languages instead of the closest of four hundred.
 *
 * Several entries have two spellings because `franc` names a specific variety
 * where we name the language: Mandarin for Chinese, Bokmal for Norwegian,
 * Tosk for Albanian, Western Farsi for Persian.
 */
const ISO3_TO_APP: Readonly<Record<string, string>> = {
  bul: 'bg', ben: 'bn', cat: 'ca', ces: 'cs', cym: 'cy', dan: 'da', deu: 'de',
  ell: 'el', eng: 'en', spa: 'es', est: 'et', fas: 'fa', pes: 'fa', fin: 'fi',
  fra: 'fr', hin: 'hi', hun: 'hu', ita: 'it', kaz: 'kk', lit: 'lt', lav: 'lv',
  mar: 'mr', nep: 'ne', npi: 'ne', nld: 'nl', nor: 'no', nob: 'no', pol: 'pl',
  por: 'pt', ron: 'ro', rus: 'ru', slk: 'sk', slv: 'sl', sqi: 'sq', als: 'sq',
  swe: 'sv', tel: 'te', ukr: 'uk', urd: 'ur', vie: 'vi', cmn: 'zh', zho: 'zh',
}

/** The 639-3 codes to let a detector answer with, given what we can read. */
export const SPEECH_DETECT_ISO3: readonly string[] = Object.keys(ISO3_TO_APP).filter(
  (iso3) => SPEECH_VOICES[ISO3_TO_APP[iso3] as string] !== undefined,
)

/** A detector's 639-3 answer as an app language, if we can read that language. */
export function speechLanguageFromIso3(iso3: string): string | undefined {
  const code = ISO3_TO_APP[iso3]
  return code !== undefined && SPEECH_VOICES[code] !== undefined ? code : undefined
}

export interface SpeechLanguageHint {
  /** What a translation provider said the original was. Believed over guessing. */
  sourceLang?: string
  /** The languages in play in this conversation, for the last-resort guess. */
  contextLangs?: readonly string[]
  /** `franc`'s answer, passed in so this stays a pure function. */
  detected?: string
}

/**
 * Which language a sentence would be read in, or `undefined` when we cannot say.
 *
 * Pure, and takes the detector's answer rather than calling it: the API and the
 * app must agree on the outcome — one decides whether to draw the menu row, the
 * other decides which permanent object gets written — and the only way to
 * guarantee that is for both to run this same function. Keeping `franc` outside
 * it also keeps `@langx/shared` free of a dependency the app would carry into
 * its bundle for a gate.
 *
 * The order is confidence, not convenience:
 *
 * 1. A translation provider's `sourceLang`. Google looked at this exact
 *    sentence and it is already on the message; nothing we compute beats it.
 * 2. The detector, but only past `SPEECH_MIN_DETECT_LENGTH`. Trigram detection
 *    on "ok" or "hahaha" is a coin toss, and the rule this repo keeps coming
 *    back to is that a reading in the wrong accent is worse than no reading.
 * 3. The conversation's own languages, and only when they narrow to exactly
 *    one. Two people who share no other language are almost certainly writing
 *    in the one they do; three candidates is a guess and we do not guess.
 */
export function detectSpeechLanguage(text: string, hint: SpeechLanguageHint = {}): string | undefined {
  const trimmed = text.trim()
  if (trimmed.length === 0) return undefined

  if (hint.sourceLang && SPEECH_VOICES[hint.sourceLang] !== undefined) return hint.sourceLang

  if (trimmed.length >= SPEECH_MIN_DETECT_LENGTH && hint.detected) {
    const code = speechLanguageFromIso3(hint.detected)
    if (code) return code
  }

  const context = [...new Set((hint.contextLangs ?? []).filter((c) => SPEECH_VOICES[c] !== undefined))]
  return context.length === 1 ? context[0] : undefined
}

/** Whether a sentence is one the service would agree to read at all. */
export function isSpeakableLength(text: string): boolean {
  const length = text.trim().length
  return length > 0 && length <= TTS_MAX_TEXT_LENGTH
}

/**
 * What a reading comes back as. `cached` is the flag the app branches on to
 * decide whether to refetch the quota — a hit spent nothing.
 */
export const messageSpeechSchema = z.object({
  url: z.url(),
  voice: z.string().trim().min(1),
  lang: languageCodeSchema,
  cached: z.boolean(),
})
export type MessageSpeech = z.infer<typeof messageSpeechSchema>

/** The voices we are obliged to credit, for the screen that credits them. */
export function attributedVoices(): readonly (SpeechVoice & { lang: string })[] {
  return Object.entries(SPEECH_VOICES)
    .flatMap(([lang, voices]) => voices.map((voice) => ({ ...voice, lang })))
    .filter((voice) => voice.attribution !== undefined)
}

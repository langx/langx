import { z } from 'zod'

/**
 * The full ISO 639-1 set, plus ISO 639-3 codes for languages 639-1 does not
 * cover, as `[code, englishName, nativeName]`. The table is the contract, not
 * the standard: a code is a language here because it is in this list.
 *
 * This is the single dictionary behind three things that must never disagree:
 * the onboarding language picker, the discovery filter UI, and the
 * `profiles.nativeLanguages[].code` / `profiles.learning[].code` fields. v1 kept
 * this list in an Appwrite collection, which meant the client and the database
 * could drift; here it is a compile-time constant.
 */
const RAW = [
  ['ab', 'Abkhazian', 'аԥсуа бызшәа'],
  ['aa', 'Afar', 'Afaraf'],
  ['af', 'Afrikaans', 'Afrikaans'],
  ['ak', 'Akan', 'Akan'],
  ['sq', 'Albanian', 'Shqip'],
  // ISO 639-3. No standard written form, so the native name is the English one.
  ['ase', 'American Sign Language', 'American Sign Language'],
  ['am', 'Amharic', 'አማርኛ'],
  ['ar', 'Arabic', 'العربية'],
  ['an', 'Aragonese', 'aragonés'],
  ['hy', 'Armenian', 'Հայերեն'],
  ['as', 'Assamese', 'অসমীয়া'],
  ['av', 'Avaric', 'авар мацӀ'],
  ['ae', 'Avestan', 'avesta'],
  ['ay', 'Aymara', 'aymar aru'],
  ['az', 'Azerbaijani', 'azərbaycan dili'],
  ['bm', 'Bambara', 'bamanankan'],
  ['ba', 'Bashkir', 'башҡорт теле'],
  ['eu', 'Basque', 'euskara'],
  ['be', 'Belarusian', 'беларуская мова'],
  ['bn', 'Bengali', 'বাংলা'],
  ['bi', 'Bislama', 'Bislama'],
  ['bs', 'Bosnian', 'bosanski jezik'],
  ['br', 'Breton', 'brezhoneg'],
  ['bg', 'Bulgarian', 'български език'],
  ['my', 'Burmese', 'ဗမာစာ'],
  ['ca', 'Catalan', 'català'],
  ['ch', 'Chamorro', 'Chamoru'],
  ['ce', 'Chechen', 'нохчийн мотт'],
  ['ny', 'Chichewa', 'chiCheŵa'],
  ['zh', 'Chinese', '中文'],
  ['cu', 'Church Slavonic', 'ѩзыкъ словѣньскъ'],
  ['cv', 'Chuvash', 'чӑваш чӗлхи'],
  ['kw', 'Cornish', 'Kernewek'],
  ['co', 'Corsican', 'corsu'],
  ['cr', 'Cree', 'ᓀᐦᐃᔭᐍᐏᐣ'],
  ['hr', 'Croatian', 'hrvatski jezik'],
  ['cs', 'Czech', 'čeština'],
  ['da', 'Danish', 'dansk'],
  ['dv', 'Divehi', 'ދިވެހި'],
  ['nl', 'Dutch', 'Nederlands'],
  ['dz', 'Dzongkha', 'རྫོང་ཁ'],
  ['en', 'English', 'English'],
  ['eo', 'Esperanto', 'Esperanto'],
  ['et', 'Estonian', 'eesti'],
  ['ee', 'Ewe', 'Eʋegbe'],
  ['fo', 'Faroese', 'føroyskt'],
  ['fj', 'Fijian', 'vosa Vakaviti'],
  ['fi', 'Finnish', 'suomi'],
  ['fr', 'French', 'français'],
  ['fy', 'Western Frisian', 'Frysk'],
  ['ff', 'Fulah', 'Fulfulde'],
  ['gd', 'Gaelic', 'Gàidhlig'],
  ['gl', 'Galician', 'Galego'],
  ['lg', 'Ganda', 'Luganda'],
  ['ka', 'Georgian', 'ქართული'],
  ['de', 'German', 'Deutsch'],
  ['el', 'Greek', 'Ελληνικά'],
  ['kl', 'Kalaallisut', 'kalaallisut'],
  ['gn', 'Guarani', "Avañe'ẽ"],
  ['gu', 'Gujarati', 'ગુજરાતી'],
  ['ht', 'Haitian', 'Kreyòl ayisyen'],
  ['ha', 'Hausa', 'Hausa'],
  ['he', 'Hebrew', 'עברית'],
  ['hz', 'Herero', 'Otjiherero'],
  ['hi', 'Hindi', 'हिन्दी'],
  ['ho', 'Hiri Motu', 'Hiri Motu'],
  ['hu', 'Hungarian', 'magyar'],
  ['is', 'Icelandic', 'Íslenska'],
  ['io', 'Ido', 'Ido'],
  ['ig', 'Igbo', 'Asụsụ Igbo'],
  ['id', 'Indonesian', 'Bahasa Indonesia'],
  ['ia', 'Interlingua', 'Interlingua'],
  ['ie', 'Interlingue', 'Interlingue'],
  ['iu', 'Inuktitut', 'ᐃᓄᒃᑎᑐᑦ'],
  ['ik', 'Inupiaq', 'Iñupiaq'],
  ['ga', 'Irish', 'Gaeilge'],
  ['it', 'Italian', 'Italiano'],
  ['ja', 'Japanese', '日本語'],
  ['jv', 'Javanese', 'ꦧꦱꦗꦮ'],
  ['kn', 'Kannada', 'ಕನ್ನಡ'],
  ['kr', 'Kanuri', 'Kanuri'],
  ['ks', 'Kashmiri', 'कश्मीरी'],
  ['kk', 'Kazakh', 'қазақ тілі'],
  ['km', 'Central Khmer', 'ខ្មែរ'],
  ['ki', 'Kikuyu', 'Gĩkũyũ'],
  ['rw', 'Kinyarwanda', 'Ikinyarwanda'],
  ['ky', 'Kirghiz', 'Кыргызча'],
  ['kv', 'Komi', 'коми кыв'],
  ['kg', 'Kongo', 'Kikongo'],
  ['ko', 'Korean', '한국어'],
  ['kj', 'Kuanyama', 'Kuanyama'],
  ['ku', 'Kurdish', 'Kurdî'],
  ['lo', 'Lao', 'ພາສາລາວ'],
  ['la', 'Latin', 'latine'],
  ['lv', 'Latvian', 'latviešu valoda'],
  ['li', 'Limburgan', 'Limburgs'],
  ['ln', 'Lingala', 'Lingála'],
  ['lt', 'Lithuanian', 'lietuvių kalba'],
  ['lu', 'Luba-Katanga', 'Kiluba'],
  ['lb', 'Luxembourgish', 'Lëtzebuergesch'],
  ['mk', 'Macedonian', 'македонски јазик'],
  ['mg', 'Malagasy', 'fiteny malagasy'],
  ['ms', 'Malay', 'Bahasa Melayu'],
  ['ml', 'Malayalam', 'മലയാളം'],
  ['mt', 'Maltese', 'Malti'],
  ['gv', 'Manx', 'Gaelg'],
  ['mi', 'Maori', 'te reo Māori'],
  ['mr', 'Marathi', 'मराठी'],
  ['mh', 'Marshallese', 'Kajin M̧ajeļ'],
  ['mn', 'Mongolian', 'Монгол хэл'],
  ['na', 'Nauru', 'Dorerin Naoero'],
  ['nv', 'Navajo', 'Diné bizaad'],
  ['nd', 'North Ndebele', 'isiNdebele'],
  ['nr', 'South Ndebele', 'isiNdebele'],
  ['ng', 'Ndonga', 'Owambo'],
  ['ne', 'Nepali', 'नेपाली'],
  ['se', 'Northern Sami', 'Davvisámegiella'],
  ['no', 'Norwegian', 'Norsk'],
  ['nb', 'Norwegian Bokmål', 'Norsk Bokmål'],
  ['nn', 'Norwegian Nynorsk', 'Norsk Nynorsk'],
  ['oc', 'Occitan', 'occitan'],
  ['oj', 'Ojibwa', 'ᐊᓂᔑᓈᐯᒧᐎᓐ'],
  ['or', 'Oriya', 'ଓଡ଼ିଆ'],
  ['om', 'Oromo', 'Afaan Oromoo'],
  ['os', 'Ossetian', 'ирон æвзаг'],
  ['pi', 'Pali', 'पाऴि'],
  ['ps', 'Pashto', 'پښتو'],
  ['fa', 'Persian', 'فارسی'],
  ['pl', 'Polish', 'język polski'],
  ['pt', 'Portuguese', 'Português'],
  ['pa', 'Punjabi', 'ਪੰਜਾਬੀ'],
  ['qu', 'Quechua', 'Runa Simi'],
  ['ro', 'Romanian', 'Română'],
  ['rm', 'Romansh', 'Rumantsch Grischun'],
  ['rn', 'Rundi', 'Ikirundi'],
  ['ru', 'Russian', 'Русский'],
  ['sm', 'Samoan', "gagana fa'a Samoa"],
  ['sg', 'Sango', 'yângâ tî sängö'],
  ['sa', 'Sanskrit', 'संस्कृतम्'],
  ['sc', 'Sardinian', 'sardu'],
  ['sr', 'Serbian', 'српски језик'],
  ['sn', 'Shona', 'chiShona'],
  ['sd', 'Sindhi', 'सिन्धी'],
  ['si', 'Sinhala', 'සිංහල'],
  ['sk', 'Slovak', 'slovenčina'],
  ['sl', 'Slovenian', 'slovenski jezik'],
  ['so', 'Somali', 'Soomaaliga'],
  ['st', 'Southern Sotho', 'Sesotho'],
  ['es', 'Spanish', 'Español'],
  ['su', 'Sundanese', 'Basa Sunda'],
  ['sw', 'Swahili', 'Kiswahili'],
  ['ss', 'Swati', 'SiSwati'],
  ['sv', 'Swedish', 'Svenska'],
  ['tl', 'Tagalog', 'Wikang Tagalog'],
  ['ty', 'Tahitian', 'Reo Tahiti'],
  ['tg', 'Tajik', 'тоҷикӣ'],
  ['ta', 'Tamil', 'தமிழ்'],
  ['tt', 'Tatar', 'татар теле'],
  ['te', 'Telugu', 'తెలుగు'],
  ['th', 'Thai', 'ไทย'],
  ['bo', 'Tibetan', 'བོད་ཡིག'],
  ['ti', 'Tigrinya', 'ትግርኛ'],
  ['to', 'Tonga', 'faka Tonga'],
  ['ts', 'Tsonga', 'Xitsonga'],
  ['tn', 'Tswana', 'Setswana'],
  ['tr', 'Turkish', 'Türkçe'],
  ['tk', 'Turkmen', 'Türkmen'],
  ['tw', 'Twi', 'Twi'],
  ['ug', 'Uighur', 'ئۇيغۇرچە'],
  ['uk', 'Ukrainian', 'Українська'],
  ['ur', 'Urdu', 'اردو'],
  ['uz', 'Uzbek', 'Oʻzbek'],
  ['ve', 'Venda', 'Tshivenḓa'],
  ['vi', 'Vietnamese', 'Tiếng Việt'],
  ['vo', 'Volapük', 'Volapük'],
  ['wa', 'Walloon', 'walon'],
  ['cy', 'Welsh', 'Cymraeg'],
  ['wo', 'Wolof', 'Wollof'],
  ['xh', 'Xhosa', 'isiXhosa'],
  ['yi', 'Yiddish', 'ייִדיש'],
  ['yo', 'Yoruba', 'Yorùbá'],
  ['za', 'Zhuang', 'Saɯ cueŋƅ'],
  ['zu', 'Zulu', 'isiZulu'],
] as const satisfies readonly (readonly [string, string, string])[]

export type LanguageCode = (typeof RAW)[number][0]

export interface Language {
  code: LanguageCode
  name: string
  nativeName: string
}

export const LANGUAGES: readonly Language[] = RAW.map(([code, name, nativeName]) => ({
  code,
  name,
  nativeName,
}))

const BY_CODE = new Map<string, Language>(LANGUAGES.map((l) => [l.code, l] as const))

export const LANGUAGE_CODES = LANGUAGES.map((l) => l.code)

export function getLanguage(code: string): Language | undefined {
  return BY_CODE.get(code)
}

export function isLanguageCode(code: string): code is LanguageCode {
  return BY_CODE.has(code)
}

/**
 * Languages with no written form. Legitimate to be native in and to be
 * learning — and never a thing to translate *into*: the chat translates a
 * message into the reader's first native language, and a Deaf reader whose
 * first language is ASL would otherwise send every translate tap to Google for
 * a language it does not have, after the quota had been spent. Adding another
 * signed language is one line here and one in the table.
 */
export const SIGNED_LANGUAGE_CODES = ['ase'] as const satisfies readonly LanguageCode[]

const SIGNED = new Set<string>(SIGNED_LANGUAGE_CODES)

/** Whether a language can be a machine-translation source or target. */
export function isTranslatableLanguage(code: string): boolean {
  return isLanguageCode(code) && !SIGNED.has(code)
}

/**
 * Validates a code against the table above. Deliberately strict: discovery
 * indexes are built on these values, so an unknown code would create a bucket
 * nobody can ever be matched out of.
 */
export const languageCodeSchema = z
  .string()
  .refine(isLanguageCode, { message: 'Unknown language code' })

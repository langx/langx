import { z } from 'zod'

/**
 * ISO 3166-1 alpha-2, as `[code, englishName]`.
 *
 * Same role `languages.ts` plays for languages, and here for the same reason:
 * `profiles.country` and the discovery country filter both key on these two
 * letters, so an unknown code creates a bucket nobody can be matched out of.
 * v1 kept its country list in an Appwrite collection, where the client and the
 * database could drift; this is a compile-time constant.
 *
 * Generated from Node's own ICU data and then filtered: deprecated codes
 * (`RH` → Zimbabwe) are dropped by keeping only codes that are their own
 * canonical form, and aggregates that are not places a person is from (the EU,
 * the Eurozone, the UN, the CLDR test regions, and ICU's `ZZ` placeholder —
 * "Unknown Region", which would otherwise validate as a country) are excluded
 * by name. A test asserts `ZZ` is refused, because it slipped through once.
 */
const RAW = [
  ['AF', 'Afghanistan'],
  ['AX', 'Åland Islands'],
  ['AL', 'Albania'],
  ['DZ', 'Algeria'],
  ['AS', 'American Samoa'],
  ['AD', 'Andorra'],
  ['AO', 'Angola'],
  ['AI', 'Anguilla'],
  ['AQ', 'Antarctica'],
  ['AG', 'Antigua & Barbuda'],
  ['AR', 'Argentina'],
  ['AM', 'Armenia'],
  ['AW', 'Aruba'],
  ['AC', 'Ascension Island'],
  ['AU', 'Australia'],
  ['AT', 'Austria'],
  ['AZ', 'Azerbaijan'],
  ['BS', 'Bahamas'],
  ['BH', 'Bahrain'],
  ['BD', 'Bangladesh'],
  ['BB', 'Barbados'],
  ['BY', 'Belarus'],
  ['BE', 'Belgium'],
  ['BZ', 'Belize'],
  ['BJ', 'Benin'],
  ['BM', 'Bermuda'],
  ['BT', 'Bhutan'],
  ['BO', 'Bolivia'],
  ['BA', 'Bosnia & Herzegovina'],
  ['BW', 'Botswana'],
  ['BV', 'Bouvet Island'],
  ['BR', 'Brazil'],
  ['IO', 'British Indian Ocean Territory'],
  ['VG', 'British Virgin Islands'],
  ['BN', 'Brunei'],
  ['BG', 'Bulgaria'],
  ['BF', 'Burkina Faso'],
  ['BI', 'Burundi'],
  ['KH', 'Cambodia'],
  ['CM', 'Cameroon'],
  ['CA', 'Canada'],
  ['IC', 'Canary Islands'],
  ['CV', 'Cape Verde'],
  ['BQ', 'Caribbean Netherlands'],
  ['KY', 'Cayman Islands'],
  ['CF', 'Central African Republic'],
  ['EA', 'Ceuta & Melilla'],
  ['TD', 'Chad'],
  ['CL', 'Chile'],
  ['CN', 'China'],
  ['CX', 'Christmas Island'],
  ['CC', 'Cocos (Keeling) Islands'],
  ['CO', 'Colombia'],
  ['KM', 'Comoros'],
  ['CG', 'Congo - Brazzaville'],
  ['CD', 'Congo - Kinshasa'],
  ['CK', 'Cook Islands'],
  ['CR', 'Costa Rica'],
  ['CI', 'Côte d’Ivoire'],
  ['HR', 'Croatia'],
  ['CU', 'Cuba'],
  ['CW', 'Curaçao'],
  ['CY', 'Cyprus'],
  ['CZ', 'Czechia'],
  ['DK', 'Denmark'],
  ['DJ', 'Djibouti'],
  ['DM', 'Dominica'],
  ['DO', 'Dominican Republic'],
  ['EC', 'Ecuador'],
  ['EG', 'Egypt'],
  ['SV', 'El Salvador'],
  ['GQ', 'Equatorial Guinea'],
  ['ER', 'Eritrea'],
  ['EE', 'Estonia'],
  ['SZ', 'Eswatini'],
  ['ET', 'Ethiopia'],
  ['FK', 'Falkland Islands'],
  ['FO', 'Faroe Islands'],
  ['FJ', 'Fiji'],
  ['FI', 'Finland'],
  ['FR', 'France'],
  ['GF', 'French Guiana'],
  ['PF', 'French Polynesia'],
  ['TF', 'French Southern Territories'],
  ['GA', 'Gabon'],
  ['GM', 'Gambia'],
  ['GE', 'Georgia'],
  ['DE', 'Germany'],
  ['GH', 'Ghana'],
  ['GI', 'Gibraltar'],
  ['GR', 'Greece'],
  ['GL', 'Greenland'],
  ['GD', 'Grenada'],
  ['GP', 'Guadeloupe'],
  ['GU', 'Guam'],
  ['GT', 'Guatemala'],
  ['GG', 'Guernsey'],
  ['GN', 'Guinea'],
  ['GW', 'Guinea-Bissau'],
  ['GY', 'Guyana'],
  ['HT', 'Haiti'],
  ['HM', 'Heard & McDonald Islands'],
  ['HN', 'Honduras'],
  ['HK', 'Hong Kong SAR China'],
  ['HU', 'Hungary'],
  ['IS', 'Iceland'],
  ['IN', 'India'],
  ['ID', 'Indonesia'],
  ['IR', 'Iran'],
  ['IQ', 'Iraq'],
  ['IE', 'Ireland'],
  ['IM', 'Isle of Man'],
  ['IL', 'Israel'],
  ['IT', 'Italy'],
  ['JM', 'Jamaica'],
  ['JP', 'Japan'],
  ['JE', 'Jersey'],
  ['JO', 'Jordan'],
  ['KZ', 'Kazakhstan'],
  ['KE', 'Kenya'],
  ['KI', 'Kiribati'],
  ['XK', 'Kosovo'],
  ['KW', 'Kuwait'],
  ['KG', 'Kyrgyzstan'],
  ['LA', 'Laos'],
  ['LV', 'Latvia'],
  ['LB', 'Lebanon'],
  ['LS', 'Lesotho'],
  ['LR', 'Liberia'],
  ['LY', 'Libya'],
  ['LI', 'Liechtenstein'],
  ['LT', 'Lithuania'],
  ['LU', 'Luxembourg'],
  ['MO', 'Macao SAR China'],
  ['MG', 'Madagascar'],
  ['MW', 'Malawi'],
  ['MY', 'Malaysia'],
  ['MV', 'Maldives'],
  ['ML', 'Mali'],
  ['MT', 'Malta'],
  ['MH', 'Marshall Islands'],
  ['MQ', 'Martinique'],
  ['MR', 'Mauritania'],
  ['MU', 'Mauritius'],
  ['YT', 'Mayotte'],
  ['MX', 'Mexico'],
  ['FM', 'Micronesia'],
  ['MD', 'Moldova'],
  ['MC', 'Monaco'],
  ['MN', 'Mongolia'],
  ['ME', 'Montenegro'],
  ['MS', 'Montserrat'],
  ['MA', 'Morocco'],
  ['MZ', 'Mozambique'],
  ['MM', 'Myanmar (Burma)'],
  ['NA', 'Namibia'],
  ['NR', 'Nauru'],
  ['NP', 'Nepal'],
  ['NL', 'Netherlands'],
  ['NC', 'New Caledonia'],
  ['NZ', 'New Zealand'],
  ['NI', 'Nicaragua'],
  ['NE', 'Niger'],
  ['NG', 'Nigeria'],
  ['NU', 'Niue'],
  ['NF', 'Norfolk Island'],
  ['KP', 'North Korea'],
  ['MK', 'North Macedonia'],
  ['MP', 'Northern Mariana Islands'],
  ['NO', 'Norway'],
  ['OM', 'Oman'],
  ['PK', 'Pakistan'],
  ['PW', 'Palau'],
  ['PS', 'Palestinian Territories'],
  ['PA', 'Panama'],
  ['PG', 'Papua New Guinea'],
  ['PY', 'Paraguay'],
  ['PE', 'Peru'],
  ['PH', 'Philippines'],
  ['PN', 'Pitcairn Islands'],
  ['PL', 'Poland'],
  ['PT', 'Portugal'],
  ['PR', 'Puerto Rico'],
  ['QA', 'Qatar'],
  ['RE', 'Réunion'],
  ['RO', 'Romania'],
  ['RU', 'Russia'],
  ['RW', 'Rwanda'],
  ['WS', 'Samoa'],
  ['SM', 'San Marino'],
  ['ST', 'São Tomé & Príncipe'],
  ['CQ', 'Sark'],
  ['SA', 'Saudi Arabia'],
  ['SN', 'Senegal'],
  ['RS', 'Serbia'],
  ['SC', 'Seychelles'],
  ['SL', 'Sierra Leone'],
  ['SG', 'Singapore'],
  ['SX', 'Sint Maarten'],
  ['SK', 'Slovakia'],
  ['SI', 'Slovenia'],
  ['SB', 'Solomon Islands'],
  ['SO', 'Somalia'],
  ['ZA', 'South Africa'],
  ['GS', 'South Georgia & South Sandwich Islands'],
  ['KR', 'South Korea'],
  ['SS', 'South Sudan'],
  ['ES', 'Spain'],
  ['LK', 'Sri Lanka'],
  ['BL', 'St. Barthélemy'],
  ['SH', 'St. Helena'],
  ['KN', 'St. Kitts & Nevis'],
  ['LC', 'St. Lucia'],
  ['MF', 'St. Martin'],
  ['PM', 'St. Pierre & Miquelon'],
  ['VC', 'St. Vincent & Grenadines'],
  ['SD', 'Sudan'],
  ['SR', 'Suriname'],
  ['SJ', 'Svalbard & Jan Mayen'],
  ['SE', 'Sweden'],
  ['CH', 'Switzerland'],
  ['SY', 'Syria'],
  ['TW', 'Taiwan'],
  ['TJ', 'Tajikistan'],
  ['TZ', 'Tanzania'],
  ['TH', 'Thailand'],
  ['TL', 'Timor-Leste'],
  ['TG', 'Togo'],
  ['TK', 'Tokelau'],
  ['TO', 'Tonga'],
  ['TT', 'Trinidad & Tobago'],
  ['TA', 'Tristan da Cunha'],
  ['TN', 'Tunisia'],
  ['TR', 'Türkiye'],
  ['TM', 'Turkmenistan'],
  ['TC', 'Turks & Caicos Islands'],
  ['TV', 'Tuvalu'],
  ['UM', 'U.S. Outlying Islands'],
  ['VI', 'U.S. Virgin Islands'],
  ['UG', 'Uganda'],
  ['UA', 'Ukraine'],
  ['AE', 'United Arab Emirates'],
  ['GB', 'United Kingdom'],
  ['US', 'United States'],
  ['UY', 'Uruguay'],
  ['UZ', 'Uzbekistan'],
  ['VU', 'Vanuatu'],
  ['VA', 'Vatican City'],
  ['VE', 'Venezuela'],
  ['VN', 'Vietnam'],
  ['WF', 'Wallis & Futuna'],
  ['EH', 'Western Sahara'],
  ['YE', 'Yemen'],
  ['ZM', 'Zambia'],
  ['ZW', 'Zimbabwe'],
] as const

export type CountryCode = (typeof RAW)[number][0]

export interface Country {
  code: CountryCode
  name: string
}

export const COUNTRIES: Country[] = RAW.map(([code, name]) => ({ code, name }))

const BY_CODE = new Map<string, Country>(COUNTRIES.map((c) => [c.code, c] as const))

export const COUNTRY_CODES = COUNTRIES.map((c) => c.code)

export function getCountry(code: string): Country | undefined {
  return BY_CODE.get(code.toUpperCase())
}

export function isCountryCode(code: string): code is CountryCode {
  return BY_CODE.has(code.toUpperCase())
}

/** The flag emoji for a code, built from the regional-indicator block. */
export function countryFlag(code: string): string {
  const upper = code.toUpperCase()
  if (!isCountryCode(upper)) return ''
  return String.fromCodePoint(...[...upper].map((ch) => 0x1f1e6 + ch.charCodeAt(0) - 65))
}

/**
 * Strips diacritics so "tur" finds "Türkiye" and "aland" finds "Åland".
 *
 * Not cosmetic: the English name of the country most of v1's users live in is
 * spelled with a `ü`, so without this the single most likely search on this
 * screen returns Turkmenistan and the Turks & Caicos Islands and nothing else.
 */
function fold(value: string): string {
  return value
    .normalize('NFD')
    .replace(/\p{Diacritic}/gu, '')
    .toLowerCase()
}

/**
 * Names people actually type that ICU does not answer to. Kept deliberately
 * short — these are the ones where the official name is not what a speaker of
 * English would reach for first, not a general synonym list.
 */
const ALIASES: Record<string, string> = {
  turkey: 'TR',
  uk: 'GB',
  britain: 'GB',
  england: 'GB',
  usa: 'US',
  america: 'US',
  holland: 'NL',
  uae: 'AE',
  'ivory coast': 'CI',
  burma: 'MM',
  'czech republic': 'CZ',
  'south korea': 'KR',
  'north korea': 'KP',
  vatican: 'VA',
  russia: 'RU',
}

/**
 * Countries matching a free-text term, best matches first: an exact code, then
 * an alias, then names that start with the term, then names that contain it.
 * An empty term returns nothing — the caller decides what to show before
 * anyone has typed.
 */
export function searchCountries(term: string, limit = 24): Country[] {
  const needle = fold(term.trim())
  if (!needle) return []

  const exact = needle.length === 2 ? getCountry(needle) : undefined
  const aliased = ALIASES[needle] ? getCountry(ALIASES[needle]) : undefined

  const starts: Country[] = []
  const contains: Country[] = []
  for (const country of COUNTRIES) {
    if (country.code === exact?.code || country.code === aliased?.code) continue
    const name = fold(country.name)
    if (name.startsWith(needle)) starts.push(country)
    else if (name.includes(needle)) contains.push(country)
  }

  return [...(exact ? [exact] : []), ...(aliased ? [aliased] : []), ...starts, ...contains].slice(
    0,
    limit,
  )
}

export const countryCodeSchema = z
  .string()
  .trim()
  .toUpperCase()
  .refine(isCountryCode, { message: 'Unknown ISO 3166-1 alpha-2 country code' })

const countryData = [
  {
    value: 'AF', map: '🇦🇫', phoneCode: 93, text: 'Afghanistan',
  },
  {
    value: 'AL', map: '🇦🇱', phoneCode: 355, text: 'Albania',
  },
  {
    value: 'DZ', map: '🇩🇿', phoneCode: 213, text: 'Algeria',
  },
  {
    value: 'AS', map: '🇦🇸', phoneCode: 1684, text: 'American Samoa',
  },
  {
    value: 'AD', map: '🇦🇩', phoneCode: 376, text: 'Andorra',
  },
  {
    value: 'AO', map: '🇦🇴', phoneCode: 244, text: 'Angola',
  },
  {
    value: 'AI', map: '🇦🇮', phoneCode: 1264, text: 'Anguilla',
  },
  {
    value: 'AQ', map: '🇦🇶', phoneCode: 0, text: 'Antarctica',
  },
  {
    value: 'AR', map: '🇦🇷', phoneCode: 54, text: 'Argentina',
  },
  {
    value: 'AM', map: '🇦🇲', phoneCode: 374, text: 'Armenia',
  },
  {
    value: 'AW', map: '🇦🇼', phoneCode: 297, text: 'Aruba',
  },
  {
    value: 'AU', map: '🇦🇺', phoneCode: 61, text: 'Australia',
  },
  {
    value: 'AT', map: '🇦🇹', phoneCode: 43, text: 'Austria',
  },
  {
    value: 'AZ', map: '🇦🇿', phoneCode: 994, text: 'Azerbaijan',
  },
  {
    value: 'BH', map: '🇧🇭', phoneCode: 973, text: 'Bahrain',
  },
  {
    value: 'BD', map: '🇧🇩', phoneCode: 880, text: 'Bangladesh',
  },
  {
    value: 'BB', map: '🇧🇧', phoneCode: 1246, text: 'Barbados',
  },
  {
    value: 'BY', map: '🇧🇾', phoneCode: 375, text: 'Belarus',
  },
  {
    value: 'BE', map: '🇧🇪', phoneCode: 32, text: 'Belgium',
  },
  {
    value: 'BZ', map: '🇧🇿', phoneCode: 501, text: 'Belize',
  },
  {
    value: 'BJ', map: '🇧🇯', phoneCode: 229, text: 'Benin',
  },
  {
    value: 'BM', map: '🇧🇲', phoneCode: 1441, text: 'Bermuda',
  },
  {
    value: 'BT', map: '🇧🇹', phoneCode: 975, text: 'Bhutan',
  },
  {
    value: 'BO', map: '🇧🇴', phoneCode: 591, text: 'Bolivia',
  },
  {
    value: 'BW', map: '🇧🇼', phoneCode: 267, text: 'Botswana',
  },
  {
    value: 'BV', map: '🇧🇻', phoneCode: 0, text: 'Bouvet Island',
  },
  {
    value: 'BR', map: '🇧🇷', phoneCode: 55, text: 'Brazil',
  },
  {
    value: 'IO', map: '🇮🇴', phoneCode: 246, text: 'British Indian Ocean Territory',
  },
  {
    value: 'BN', map: '🇧🇳', phoneCode: 673, text: 'Brunei',
  },
  {
    value: 'BG', map: '🇧🇬', phoneCode: 359, text: 'Bulgaria',
  },
  {
    value: 'BF', map: '🇧🇫', phoneCode: 226, text: 'Burkina Faso',
  },
  {
    value: 'BI', map: '🇧🇮', phoneCode: 257, text: 'Burundi',
  },
  {
    value: 'KH', map: '🇰🇭', phoneCode: 855, text: 'Cambodia',
  },
  {
    value: 'CM', map: '🇨🇲', phoneCode: 237, text: 'Cameroon',
  },
  {
    value: 'CA', map: '🇨🇦', phoneCode: 1, text: 'Canada',
  },
  {
    value: 'CV', map: '🇨🇻', phoneCode: 238, text: 'Cape Verde',
  },
  {
    value: 'KY', map: '🇰🇾', phoneCode: 1345, text: 'Cayman Islands',
  },
  {
    value: 'CF', map: '🇨🇫', phoneCode: 236, text: 'Central African Republic',
  },
  {
    value: 'TD', map: '🇹🇩', phoneCode: 235, text: 'Chad',
  },
  {
    value: 'CL', map: '🇨🇱', phoneCode: 56, text: 'Chile',
  },
  {
    value: 'CN', map: '🇨🇳', phoneCode: 86, text: 'China',
  },
  {
    value: 'CX', map: '🇨🇽', phoneCode: 61, text: 'Christmas Island',
  },
  {
    value: 'CC', map: '🇨🇨', phoneCode: 672, text: 'Cocos (Keeling) Islands',
  },
  {
    value: 'CO', map: '🇨🇴', phoneCode: 57, text: 'Colombia',
  },
  {
    value: 'KM', map: '🇰🇲', phoneCode: 269, text: 'Comoros',
  },
  {
    value: 'CK', map: '🇨🇰', phoneCode: 682, text: 'Cook Islands',
  },
  {
    value: 'CR', map: '🇨🇷', phoneCode: 506, text: 'Costa Rica',
  },
  {
    value: 'CU', map: '🇨🇺', phoneCode: 53, text: 'Cuba',
  },
  {
    value: 'CY', map: '🇨🇾', phoneCode: 357, text: 'Cyprus',
  },
  {
    value: 'DK', map: '🇩🇰', phoneCode: 45, text: 'Denmark',
  },
  {
    value: 'DJ', map: '🇩🇯', phoneCode: 253, text: 'Djibouti',
  },
  {
    value: 'DM', map: '🇩🇲', phoneCode: 1767, text: 'Dominica',
  },
  {
    value: 'DO', map: '🇩🇴', phoneCode: 1809, text: 'Dominican Republic',
  },
  {
    value: 'EC', map: '🇪🇨', phoneCode: 593, text: 'Ecuador',
  },
  {
    value: 'EG', map: '🇪🇬', phoneCode: 20, text: 'Egypt',
  },
  {
    value: 'SV', map: '🇸🇻', phoneCode: 503, text: 'El Salvador',
  },
  {
    value: 'GQ', map: '🇬🇶', phoneCode: 240, text: 'Equatorial Guinea',
  },
  {
    value: 'ER', map: '🇪🇷', phoneCode: 291, text: 'Eritrea',
  },
  {
    value: 'EE', map: '🇪🇪', phoneCode: 372, text: 'Estonia',
  },
  {
    value: 'ET', map: '🇪🇹', phoneCode: 251, text: 'Ethiopia',
  },
  {
    value: 'FK', map: '🇫🇰', phoneCode: 500, text: 'Falkland Islands',
  },
  {
    value: 'FO', map: '🇫🇴', phoneCode: 298, text: 'Faroe Islands',
  },
  {
    value: 'FI', map: '🇫🇮', phoneCode: 358, text: 'Finland',
  },
  {
    value: 'FR', map: '🇫🇷', phoneCode: 33, text: 'France',
  },
  {
    value: 'GF', map: '🇬🇫', phoneCode: 594, text: 'French Guiana',
  },
  {
    value: 'PF', map: '🇵🇫', phoneCode: 689, text: 'French Polynesia',
  },
  {
    value: 'TF', map: '🇹🇫', phoneCode: 0, text: 'French Southern Territories',
  },
  {
    value: 'GA', map: '🇬🇦', phoneCode: 241, text: 'Gabon',
  },
  {
    value: 'GE', map: '🇬🇪', phoneCode: 995, text: 'Georgia',
  },
  {
    value: 'DE', map: '🇩🇪', phoneCode: 49, text: 'Germany',
  },
  {
    value: 'GH', map: '🇬🇭', phoneCode: 233, text: 'Ghana',
  },
  {
    value: 'GI', map: '🇬🇮', phoneCode: 350, text: 'Gibraltar',
  },
  {
    value: 'GR', map: '🇬🇷', phoneCode: 30, text: 'Greece',
  },
  {
    value: 'GL', map: '🇬🇱', phoneCode: 299, text: 'Greenland',
  },
  {
    value: 'GD', map: '🇬🇩', phoneCode: 1473, text: 'Grenada',
  },
  {
    value: 'GP', map: '🇬🇵', phoneCode: 590, text: 'Guadeloupe',
  },
  {
    value: 'GU', map: '🇬🇺', phoneCode: 1671, text: 'Guam',
  },
  {
    value: 'GT', map: '🇬🇹', phoneCode: 502, text: 'Guatemala',
  },
  {
    value: 'GN', map: '🇬🇳', phoneCode: 224, text: 'Guinea',
  },
  {
    value: 'GW', map: '🇬🇼', phoneCode: 245, text: 'Guinea-Bissau',
  },
  {
    value: 'GY', map: '🇬🇾', phoneCode: 592, text: 'Guyana',
  },
  {
    value: 'HT', map: '🇭🇹', phoneCode: 509, text: 'Haiti',
  },
  {
    value: 'HN', map: '🇭🇳', phoneCode: 504, text: 'Honduras',
  },
  {
    value: 'HU', map: '🇭🇺', phoneCode: 36, text: 'Hungary',
  },
  {
    value: 'IS', map: '🇮🇸', phoneCode: 354, text: 'Iceland',
  },
  {
    value: 'IN', map: '🇮🇳', phoneCode: 91, text: 'India',
  },
  {
    value: 'ID', map: '🇮🇩', phoneCode: 62, text: 'Indonesia',
  },
  {
    value: 'IR', map: '🇮🇷', phoneCode: 98, text: 'Iran',
  },
  {
    value: 'IQ', map: '🇮🇶', phoneCode: 964, text: 'Iraq',
  },
  {
    value: 'IE', map: '🇮🇪', phoneCode: 353, text: 'Ireland',
  },
  {
    value: 'IL', map: '🇮🇱', phoneCode: 972, text: 'Israel',
  },
  {
    value: 'IT', map: '🇮🇹', phoneCode: 39, text: 'Italy',
  },
  {
    value: 'JM', map: '🇯🇲', phoneCode: 1876, text: 'Jamaica',
  },
  {
    value: 'JP', map: '🇯🇵', phoneCode: 81, text: 'Japan',
  },
  {
    value: 'JO', map: '🇯🇴', phoneCode: 962, text: 'Jordan',
  },
  {
    value: 'KZ', map: '🇰🇿', phoneCode: 7, text: 'Kazakhstan',
  },
  {
    value: 'KE', map: '🇰🇪', phoneCode: 254, text: 'Kenya',
  },
  {
    value: 'KI', map: '🇰🇮', phoneCode: 686, text: 'Kiribati',
  },
  {
    value: 'KW', map: '🇰🇼', phoneCode: 965, text: 'Kuwait',
  },
  {
    value: 'KG', map: '🇰🇬', phoneCode: 996, text: 'Kyrgyzstan',
  },
  {
    value: 'LA', map: '🇱🇦', phoneCode: 856, text: 'Laos',
  },
  {
    value: 'LV', map: '🇱🇻', phoneCode: 371, text: 'Latvia',
  },
  {
    value: 'LB', map: '🇱🇧', phoneCode: 961, text: 'Lebanon',
  },
  {
    value: 'LS', map: '🇱🇸', phoneCode: 266, text: 'Lesotho',
  },
  {
    value: 'LR', map: '🇱🇷', phoneCode: 231, text: 'Liberia',
  },
  {
    value: 'LY', map: '🇱🇾', phoneCode: 218, text: 'Libya',
  },
  {
    value: 'LI', map: '🇱🇮', phoneCode: 423, text: 'Liechtenstein',
  },
  {
    value: 'LT', map: '🇱🇹', phoneCode: 370, text: 'Lithuania',
  },
  {
    value: 'LU', map: '🇱🇺', phoneCode: 352, text: 'Luxembourg',
  },
  {
    value: 'MK', map: '🇲🇰', phoneCode: 389, text: 'Macedonia',
  },
  {
    value: 'MG', map: '🇲🇬', phoneCode: 261, text: 'Madagascar',
  },
  {
    value: 'MW', map: '🇲🇼', phoneCode: 265, text: 'Malawi',
  },
  {
    value: 'MY', map: '🇲🇾', phoneCode: 60, text: 'Malaysia',
  },
  {
    value: 'MV', map: '🇲🇻', phoneCode: 960, text: 'Maldives',
  },
  {
    value: 'ML', map: '🇲🇱', phoneCode: 223, text: 'Mali',
  },
  {
    value: 'MT', map: '🇲🇹', phoneCode: 356, text: 'Malta',
  },
  {
    value: 'MH', map: '🇲🇭', phoneCode: 692, text: 'Marshall Islands',
  },
  {
    value: 'MQ', map: '🇲🇶', phoneCode: 596, text: 'Martinique',
  },
  {
    value: 'MR', map: '🇲🇷', phoneCode: 222, text: 'Mauritania',
  },
  {
    value: 'MU', map: '🇲🇺', phoneCode: 230, text: 'Mauritius',
  },
  {
    value: 'YT', map: '🇾🇹', phoneCode: 269, text: 'Mayotte',
  },
  {
    value: 'MX', map: '🇲🇽', phoneCode: 52, text: 'Mexico',
  },
  {
    value: 'FM', map: '🇫🇲', phoneCode: 691, text: 'Micronesia',
  },
  {
    value: 'MD', map: '🇲🇩', phoneCode: 373, text: 'Moldova',
  },
  {
    value: 'MC', map: '🇲🇨', phoneCode: 377, text: 'Monaco',
  },
  {
    value: 'MN', map: '🇲🇳', phoneCode: 976, text: 'Mongolia',
  },
  {
    value: 'MS', map: '🇲🇸', phoneCode: 1664, text: 'Montserrat',
  },
  {
    value: 'MA', map: '🇲🇦', phoneCode: 212, text: 'Morocco',
  },
  {
    value: 'MZ', map: '🇲🇿', phoneCode: 258, text: 'Mozambique',
  },
  {
    value: 'NA', map: '🇳🇦', phoneCode: 264, text: 'Namibia',
  },
  {
    value: 'NR', map: '🇳🇷', phoneCode: 674, text: 'Nauru',
  },
  {
    value: 'NP', map: '🇳🇵', phoneCode: 977, text: 'Nepal',
  },
  {
    value: 'NC', map: '🇳🇨', phoneCode: 687, text: 'New Caledonia',
  },
  {
    value: 'NZ', map: '🇳🇿', phoneCode: 64, text: 'New Zealand',
  },
  {
    value: 'NI', map: '🇳🇮', phoneCode: 505, text: 'Nicaragua',
  },
  {
    value: 'NE', map: '🇳🇪', phoneCode: 227, text: 'Niger',
  },
  {
    value: 'NG', map: '🇳🇬', phoneCode: 234, text: 'Nigeria',
  },
  {
    value: 'NU', map: '🇳🇺', phoneCode: 683, text: 'Niue',
  },
  {
    value: 'NF', map: '🇳🇫', phoneCode: 672, text: 'Norfolk Island',
  },
  {
    value: 'MP', map: '🇲🇵', phoneCode: 1670, text: 'Northern Mariana Islands',
  },
  {
    value: 'NO', map: '🇳🇴', phoneCode: 47, text: 'Norway',
  },
  {
    value: 'OM', map: '🇴🇲', phoneCode: 968, text: 'Oman',
  },
  {
    value: 'PK', map: '🇵🇰', phoneCode: 92, text: 'Pakistan',
  },
  {
    value: 'PW', map: '🇵🇼', phoneCode: 680, text: 'Palau',
  },
  {
    value: 'PA', map: '🇵🇦', phoneCode: 507, text: 'Panama',
  },
  {
    value: 'PY', map: '🇵🇾', phoneCode: 595, text: 'Paraguay',
  },
  {
    value: 'PE', map: '🇵🇪', phoneCode: 51, text: 'Peru',
  },
  {
    value: 'PH', map: '🇵🇭', phoneCode: 63, text: 'Philippines',
  },
  {
    value: 'PL', map: '🇵🇱', phoneCode: 48, text: 'Poland',
  },
  {
    value: 'PT', map: '🇵🇹', phoneCode: 351, text: 'Portugal',
  },
  {
    value: 'PR', map: '🇵🇷', phoneCode: 1787, text: 'Puerto Rico',
  },
  {
    value: 'QA', map: '🇶🇦', phoneCode: 974, text: 'Qatar',
  },
  {
    value: 'RO', map: '🇷🇴', phoneCode: 40, text: 'Romania',
  },
  {
    value: 'RU', map: '🇷🇺', phoneCode: 70, text: 'Russia',
  },
  {
    value: 'RW', map: '🇷🇼', phoneCode: 250, text: 'Rwanda',
  },
  {
    value: 'WS', map: '🇼🇸', phoneCode: 684, text: 'Samoa',
  },
  {
    value: 'SM', map: '🇸🇲', phoneCode: 378, text: 'San Marino',
  },
  {
    value: 'SA', map: '🇸🇦', phoneCode: 966, text: 'Saudi Arabia',
  },
  {
    value: 'SN', map: '🇸🇳', phoneCode: 221, text: 'Senegal',
  },
  {
    value: 'RS', map: '🇷🇸', phoneCode: 381, text: 'Serbia',
  },
  {
    value: 'SC', map: '🇸🇨', phoneCode: 248, text: 'Seychelles',
  },
  {
    value: 'SL', map: '🇸🇱', phoneCode: 232, text: 'Sierra Leone',
  },
  {
    value: 'SG', map: '🇸🇬', phoneCode: 65, text: 'Singapore',
  },
  {
    value: 'SK', map: '🇸🇰', phoneCode: 421, text: 'Slovakia',
  },
  {
    value: 'SI', map: '🇸🇮', phoneCode: 386, text: 'Slovenia',
  },
  {
    value: 'SB', map: '🇸🇧', phoneCode: 677, text: 'Solomon Islands',
  },
  {
    value: 'SO', map: '🇸🇴', phoneCode: 252, text: 'Somalia',
  },
  {
    value: 'ZA', map: '🇿🇦', phoneCode: 27, text: 'South Africa',
  },
  {
    value: 'SS', map: '🇸🇸', phoneCode: 211, text: 'South Sudan',
  },
  {
    value: 'ES', map: '🇪🇸', phoneCode: 34, text: 'Spain',
  },
  {
    value: 'LK', map: '🇱🇰', phoneCode: 94, text: 'Sri Lanka',
  },
  {
    value: 'SD', map: '🇸🇩', phoneCode: 249, text: 'Sudan',
  },
  {
    value: 'SR', map: '🇸🇷', phoneCode: 597, text: 'Suritext',
  },
  {
    value: 'SZ', map: '🇸🇿', phoneCode: 268, text: 'Swaziland',
  },
  {
    value: 'SE', map: '🇸🇪', phoneCode: 46, text: 'Sweden',
  },
  {
    value: 'CH', map: '🇨🇭', phoneCode: 41, text: 'Switzerland',
  },
  {
    value: 'SY', map: '🇸🇾', phoneCode: 963, text: 'Syria',
  },
  {
    value: 'TW', map: '🇹🇼', phoneCode: 886, text: 'Taiwan',
  },
  {
    value: 'TJ', map: '🇹🇯', phoneCode: 992, text: 'Tajikistan',
  },
  {
    value: 'TZ', map: '🇹🇿', phoneCode: 255, text: 'Tanzania',
  },
  {
    value: 'TH', map: '🇹🇭', phoneCode: 66, text: 'Thailand',
  },
  {
    value: 'TG', map: '🇹🇬', phoneCode: 228, text: 'Togo',
  },
  {
    value: 'TK', map: '🇹🇰', phoneCode: 690, text: 'Tokelau',
  },
  {
    value: 'TO', map: '🇹🇴', phoneCode: 676, text: 'Tonga',
  },
  {
    value: 'TN', map: '🇹🇳', phoneCode: 216, text: 'Tunisia',
  },
  {
    value: 'TR', map: '🇹🇷', phoneCode: 90, text: 'Turkey',
  },
  {
    value: 'TM', map: '🇹🇲', phoneCode: 7370, text: 'Turkmenistan',
  },
  {
    value: 'TV', map: '🇹🇻', phoneCode: 688, text: 'Tuvalu',
  },
  {
    value: 'UG', map: '🇺🇬', phoneCode: 256, text: 'Uganda',
  },
  {
    value: 'UA', map: '🇺🇦', phoneCode: 380, text: 'Ukraine',
  },
  {
    value: 'AE', map: '🇦🇪', phoneCode: 971, text: 'United Arab Emirates',
  },
  {
    value: 'GB', map: '🇬🇧', phoneCode: 44, text: 'United Kingdom',
  },
  {
    value: 'US', map: '🇺🇸', phoneCode: 1, text: 'United States',
  },
  {
    value: 'UY', map: '🇺🇾', phoneCode: 598, text: 'Uruguay',
  },
  {
    value: 'UZ', map: '🇺🇿', phoneCode: 998, text: 'Uzbekistan',
  },
  {
    value: 'VU', map: '🇻🇺', phoneCode: 678, text: 'Vanuatu',
  },
  {
    value: 'VE', map: '🇻🇪', phoneCode: 58, text: 'Venezuela',
  },
  {
    value: 'VN', map: '🇻🇳', phoneCode: 84, text: 'Vietnam',
  },
  {
    value: 'EH', map: '🇪🇭', phoneCode: 212, text: 'Western Sahara',
  },
  {
    value: 'YE', map: '🇾🇪', phoneCode: 967, text: 'Yemen',
  },
  {
    value: 'ZM', map: '🇿🇲', phoneCode: 260, text: 'Zambia',
  },
  {
    value: 'ZW', map: '🇿🇼', phoneCode: 26, text: 'Zimbabwe',
  }];

const languages =
  [
    {"code":"ab","name":"Abkhaz","nativeName":"аҧсуа"},
    {"code":"aa","name":"Afar","nativeName":"Afaraf"},
    {"code":"af","name":"Afrikaans","nativeName":"Afrikaans"},
    {"code":"ak","name":"Akan","nativeName":"Akan"},
    {"code":"sq","name":"Albanian","nativeName":"Shqip"},
    {"code":"am","name":"Amharic","nativeName":"አማርኛ"},
    {"code":"ar","name":"Arabic","nativeName":"العربية"},
    {"code":"an","name":"Aragonese","nativeName":"Aragonés"},
    {"code":"hy","name":"Armenian","nativeName":"Հայերեն"},
    {"code":"as","name":"Assamese","nativeName":"অসমীয়া"},
    {"code":"av","name":"Avaric","nativeName":"авар мацӀ, магӀарул мацӀ"},
    {"code":"ae","name":"Avestan","nativeName":"avesta"},
    {"code":"ay","name":"Aymara","nativeName":"aymar aru"},
    {"code":"az","name":"Azerbaijani","nativeName":"azərbaycan dili"},
    {"code":"bm","name":"Bambara","nativeName":"bamanankan"},
    {"code":"ba","name":"Bashkir","nativeName":"башҡорт теле"},
    {"code":"eu","name":"Basque","nativeName":"euskara, euskera"},
    {"code":"be","name":"Belarusian","nativeName":"Беларуская"},
    {"code":"bn","name":"Bengali","nativeName":"বাংলা"},
    {"code":"bh","name":"Bihari","nativeName":"भोजपुरी"},
    {"code":"bi","name":"Bislama","nativeName":"Bislama"},
    {"code":"bs","name":"Bosnian","nativeName":"bosanski jezik"},
    {"code":"br","name":"Breton","nativeName":"brezhoneg"},
    {"code":"bg","name":"Bulgarian","nativeName":"български език"},
    {"code":"my","name":"Burmese","nativeName":"ဗမာစာ"},
    {"code":"ca","name":"Catalan; Valencian","nativeName":"Català"},
    {"code":"ch","name":"Chamorro","nativeName":"Chamoru"},
    {"code":"ce","name":"Chechen","nativeName":"нохчийн мотт"},
    {"code":"ny","name":"Chichewa; Chewa; Nyanja","nativeName":"chiCheŵa, chinyanja"},
    {"code":"zh","name":"Chinese","nativeName":"中文 (Zhōngwén), 汉语, 漢語"},
    {"code":"cv","name":"Chuvash","nativeName":"чӑваш чӗлхи"},
    {"code":"kw","name":"Cornish","nativeName":"Kernewek"},
    {"code":"co","name":"Corsican","nativeName":"corsu, lingua corsa"},
    {"code":"cr","name":"Cree","nativeName":"ᓀᐦᐃᔭᐍᐏᐣ"},
    {"code":"hr","name":"Croatian","nativeName":"hrvatski"},
    {"code":"cs","name":"Czech","nativeName":"česky, čeština"},
    {"code":"da","name":"Danish","nativeName":"dansk"},
    {"code":"dv","name":"Divehi; Dhivehi; Maldivian;","nativeName":"ދިވެހި"},
    {"code":"nl","name":"Dutch","nativeName":"Nederlands, Vlaams"},
    {"code":"en","name":"English","nativeName":"English"},
    {"code":"eo","name":"Esperanto","nativeName":"Esperanto"},
    {"code":"et","name":"Estonian","nativeName":"eesti, eesti keel"},
    {"code":"ee","name":"Ewe","nativeName":"Eʋegbe"},
    {"code":"fo","name":"Faroese","nativeName":"føroyskt"},
    {"code":"fj","name":"Fijian","nativeName":"vosa Vakaviti"},
    {"code":"fi","name":"Finnish","nativeName":"suomi, suomen kieli"},
    {"code":"fr","name":"French","nativeName":"français, langue française"},
    {"code":"ff","name":"Fula; Fulah; Pulaar; Pular","nativeName":"Fulfulde, Pulaar, Pular"},
    {"code":"gl","name":"Galician","nativeName":"Galego"},
    {"code":"ka","name":"Georgian","nativeName":"ქართული"},
    {"code":"de","name":"German","nativeName":"Deutsch"},
    {"code":"el","name":"Greek, Modern","nativeName":"Ελληνικά"},
    {"code":"gn","name":"Guaraní","nativeName":"Avañeẽ"},
    {"code":"gu","name":"Gujarati","nativeName":"ગુજરાતી"},
    {"code":"ht","name":"Haitian; Haitian Creole","nativeName":"Kreyòl ayisyen"},
    {"code":"ha","name":"Hausa","nativeName":"Hausa, هَوُسَ"},
    {"code":"he","name":"Hebrew (modern)","nativeName":"עברית"},
    {"code":"hz","name":"Herero","nativeName":"Otjiherero"},
    {"code":"hi","name":"Hindi","nativeName":"हिन्दी, हिंदी"},
    {"code":"ho","name":"Hiri Motu","nativeName":"Hiri Motu"},
    {"code":"hu","name":"Hungarian","nativeName":"Magyar"},
    {"code":"ia","name":"Interlingua","nativeName":"Interlingua"},
    {"code":"id","name":"Indonesian","nativeName":"Bahasa Indonesia"},
    {"code":"ie","name":"Interlingue","nativeName":"Originally called Occidental; then Interlingue after WWII"},
    {"code":"ga","name":"Irish","nativeName":"Gaeilge"},
    {"code":"ig","name":"Igbo","nativeName":"Asụsụ Igbo"},
    {"code":"ik","name":"Inupiaq","nativeName":"Iñupiaq, Iñupiatun"},
    {"code":"io","name":"Ido","nativeName":"Ido"},
    {"code":"is","name":"Icelandic","nativeName":"Íslenska"},
    {"code":"it","name":"Italian","nativeName":"Italiano"},
    {"code":"iu","name":"Inuktitut","nativeName":"ᐃᓄᒃᑎᑐᑦ"},
    {"code":"ja","name":"Japanese","nativeName":"日本語 (にほんご／にっぽんご)"},
    {"code":"jv","name":"Javanese","nativeName":"basa Jawa"},
    {"code":"kl","name":"Kalaallisut, Greenlandic","nativeName":"kalaallisut, kalaallit oqaasii"},
    {"code":"kn","name":"Kannada","nativeName":"ಕನ್ನಡ"},
    {"code":"kr","name":"Kanuri","nativeName":"Kanuri"},
    {"code":"ks","name":"Kashmiri","nativeName":"कश्मीरी, كشميري‎"},
    {"code":"kk","name":"Kazakh","nativeName":"Қазақ тілі"},
    {"code":"km","name":"Khmer","nativeName":"ភាសាខ្មែរ"},
    {"code":"ki","name":"Kikuyu, Gikuyu","nativeName":"Gĩkũyũ"},
    {"code":"rw","name":"Kinyarwanda","nativeName":"Ikinyarwanda"},
    {"code":"ky","name":"Kirghiz, Kyrgyz","nativeName":"кыргыз тили"},
    {"code":"kv","name":"Komi","nativeName":"коми кыв"},
    {"code":"kg","name":"Kongo","nativeName":"KiKongo"},
    {"code":"ko","name":"Korean","nativeName":"한국어 (韓國語), 조선말 (朝鮮語)"},
    {"code":"ku","name":"Kurdish","nativeName":"Kurdî, كوردی‎"},
    {"code":"kj","name":"Kwanyama, Kuanyama","nativeName":"Kuanyama"},
    {"code":"la","name":"Latin","nativeName":"latine, lingua latina"},
    {"code":"lb","name":"Luxembourgish, Letzeburgesch","nativeName":"Lëtzebuergesch"},
    {"code":"lg","name":"Luganda","nativeName":"Luganda"},
    {"code":"li","name":"Limburgish, Limburgan, Limburger","nativeName":"Limburgs"},
    {"code":"ln","name":"Lingala","nativeName":"Lingála"},
    {"code":"lo","name":"Lao","nativeName":"ພາສາລາວ"},
    {"code":"lt","name":"Lithuanian","nativeName":"lietuvių kalba"},
    {"code":"lu","name":"Luba-Katanga","nativeName":""},
    {"code":"lv","name":"Latvian","nativeName":"latviešu valoda"},
    {"code":"gv","name":"Manx","nativeName":"Gaelg, Gailck"},
    {"code":"mk","name":"Macedonian","nativeName":"македонски јазик"},
    {"code":"mg","name":"Malagasy","nativeName":"Malagasy fiteny"},
    {"code":"ms","name":"Malay","nativeName":"bahasa Melayu, بهاس ملايو‎"},
    {"code":"ml","name":"Malayalam","nativeName":"മലയാളം"},
    {"code":"mt","name":"Maltese","nativeName":"Malti"},
    {"code":"mi","name":"Māori","nativeName":"te reo Māori"},
    {"code":"mr","name":"Marathi (Marāṭhī)","nativeName":"मराठी"},
    {"code":"mh","name":"Marshallese","nativeName":"Kajin M̧ajeļ"},
    {"code":"mn","name":"Mongolian","nativeName":"монгол"},
    {"code":"na","name":"Nauru","nativeName":"Ekakairũ Naoero"},
    {"code":"nv","name":"Navajo, Navaho","nativeName":"Diné bizaad, Dinékʼehǰí"},
    {"code":"nb","name":"Norwegian Bokmål","nativeName":"Norsk bokmål"},
    {"code":"nd","name":"North Ndebele","nativeName":"isiNdebele"},
    {"code":"ne","name":"Nepali","nativeName":"नेपाली"},
    {"code":"ng","name":"Ndonga","nativeName":"Owambo"},
    {"code":"nn","name":"Norwegian Nynorsk","nativeName":"Norsk nynorsk"},
    {"code":"no","name":"Norwegian","nativeName":"Norsk"},
    {"code":"ii","name":"Nuosu","nativeName":"ꆈꌠ꒿ Nuosuhxop"},
    {"code":"nr","name":"South Ndebele","nativeName":"isiNdebele"},
    {"code":"oc","name":"Occitan","nativeName":"Occitan"},
    {"code":"oj","name":"Ojibwe, Ojibwa","nativeName":"ᐊᓂᔑᓈᐯᒧᐎᓐ"},
    {"code":"cu","name":"Old Church Slavonic, Church Slavic, Church Slavonic, Old Bulgarian, Old Slavonic","nativeName":"ѩзыкъ словѣньскъ"},
    {"code":"om","name":"Oromo","nativeName":"Afaan Oromoo"},
    {"code":"or","name":"Oriya","nativeName":"ଓଡ଼ିଆ"},
    {"code":"os","name":"Ossetian, Ossetic","nativeName":"ирон æвзаг"},
    {"code":"pa","name":"Panjabi, Punjabi","nativeName":"ਪੰਜਾਬੀ, پنجابی‎"},
    {"code":"pi","name":"Pāli","nativeName":"पाऴि"},
    {"code":"fa","name":"Persian","nativeName":"فارسی"},
    {"code":"pl","name":"Polish","nativeName":"polski"},
    {"code":"ps","name":"Pashto, Pushto","nativeName":"پښتو"},
    {"code":"pt","name":"Portuguese","nativeName":"Português"},
    {"code":"qu","name":"Quechua","nativeName":"Runa Simi, Kichwa"},
    {"code":"rm","name":"Romansh","nativeName":"rumantsch grischun"},
    {"code":"rn","name":"Kirundi","nativeName":"kiRundi"},
    {"code":"ro","name":"Romanian, Moldavian, Moldovan","nativeName":"română"},
    {"code":"ru","name":"Russian","nativeName":"русский язык"},
    {"code":"sa","name":"Sanskrit (Saṁskṛta)","nativeName":"संस्कृतम्"},
    {"code":"sc","name":"Sardinian","nativeName":"sardu"},
    {"code":"sd","name":"Sindhi","nativeName":"सिन्धी, سنڌي، سندھی‎"},
    {"code":"se","name":"Northern Sami","nativeName":"Davvisámegiella"},
    {"code":"sm","name":"Samoan","nativeName":"gagana faa Samoa"},
    {"code":"sg","name":"Sango","nativeName":"yângâ tî sängö"},
    {"code":"sr","name":"Serbian","nativeName":"српски језик"},
    {"code":"gd","name":"Scottish Gaelic; Gaelic","nativeName":"Gàidhlig"},
    {"code":"sn","name":"Shona","nativeName":"chiShona"},
    {"code":"si","name":"Sinhala, Sinhalese","nativeName":"සිංහල"},
    {"code":"sk","name":"Slovak","nativeName":"slovenčina"},
    {"code":"sl","name":"Slovene","nativeName":"slovenščina"},
    {"code":"so","name":"Somali","nativeName":"Soomaaliga, af Soomaali"},
    {"code":"st","name":"Southern Sotho","nativeName":"Sesotho"},
    {"code":"es","name":"Spanish; Castilian","nativeName":"español, castellano"},
    {"code":"su","name":"Sundanese","nativeName":"Basa Sunda"},
    {"code":"sw","name":"Swahili","nativeName":"Kiswahili"},
    {"code":"ss","name":"Swati","nativeName":"SiSwati"},
    {"code":"sv","name":"Swedish","nativeName":"svenska"},
    {"code":"ta","name":"Tamil","nativeName":"தமிழ்"},
    {"code":"te","name":"Telugu","nativeName":"తెలుగు"},
    {"code":"tg","name":"Tajik","nativeName":"тоҷикӣ, toğikī, تاجیکی‎"},
    {"code":"th","name":"Thai","nativeName":"ไทย"},
    {"code":"ti","name":"Tigrinya","nativeName":"ትግርኛ"},
    {"code":"bo","name":"Tibetan Standard, Tibetan, Central","nativeName":"བོད་ཡིག"},
    {"code":"tk","name":"Turkmen","nativeName":"Türkmen, Түркмен"},
    {"code":"tl","name":"Tagalog","nativeName":"Wikang Tagalog, ᜏᜒᜃᜅ᜔ ᜆᜄᜎᜓᜄ᜔"},
    {"code":"tn","name":"Tswana","nativeName":"Setswana"},
    {"code":"to","name":"Tonga (Tonga Islands)","nativeName":"faka Tonga"},
    {"code":"tr","name":"Turkish","nativeName":"Türkçe"},
    {"code":"ts","name":"Tsonga","nativeName":"Xitsonga"},
    {"code":"tt","name":"Tatar","nativeName":"татарча, tatarça, تاتارچا‎"},
    {"code":"tw","name":"Twi","nativeName":"Twi"},
    {"code":"ty","name":"Tahitian","nativeName":"Reo Tahiti"},
    {"code":"ug","name":"Uighur, Uyghur","nativeName":"Uyƣurqə, ئۇيغۇرچە‎"},
    {"code":"uk","name":"Ukrainian","nativeName":"українська"},
    {"code":"ur","name":"Urdu","nativeName":"اردو"},
    {"code":"uz","name":"Uzbek","nativeName":"zbek, Ўзбек, أۇزبېك‎"},
    {"code":"ve","name":"Venda","nativeName":"Tshivenḓa"},
    {"code":"vi","name":"Vietnamese","nativeName":"Tiếng Việt"},
    {"code":"vo","name":"Volapük","nativeName":"Volapük"},
    {"code":"wa","name":"Walloon","nativeName":"Walon"},
    {"code":"cy","name":"Welsh","nativeName":"Cymraeg"},
    {"code":"wo","name":"Wolof","nativeName":"Wollof"},
    {"code":"fy","name":"Western Frisian","nativeName":"Frysk"},
    {"code":"xh","name":"Xhosa","nativeName":"isiXhosa"},
    {"code":"yi","name":"Yiddish","nativeName":"ייִדיש"},
    {"code":"yo","name":"Yoruba","nativeName":"Yorùbá"},
    {"code":"za","name":"Zhuang, Chuang","nativeName":"Saɯ cueŋƅ, Saw cuengh"}
  ]
  
const day = [
  {text: '01', value: '01'}, {text: '02', value: '02'}, {text: '03', value: '03'}, {text: '04', value: '04'}, {text: '05', value: '05'}, {text: '06', value: '06'}, {text: '07', value: '07'}, {text: '08', value: '08'}, {text: '09', value: '09'}, {text: '10', value: '10'}, {text: '11', value: '11'}, {text: '12', value: '12'}, {text: '13', value: '13'}, {text: '14', value: '14'}, {text: '15', value: '15'}, {text: '16', value: '16'}, {text: '17', value: '17'}, {text: '18', value: '18'}, {text: '19', value: '19'}, {text: '20', value: '20'}, {text: '21', value: '21'}, {text: '22', value: '22'}, {text: '23', value: '23'}, {text: '24', value: '24'}, {text: '25', value: '25'}, {text: '26', value: '26'}, {text: '27', value: '27'}, {text: '28', value: '28'}, {text: '29', value: '29'}, {text: '30', value: '30'}, {text: '31', value: '31'}
];
const month = [
  {text: 'January', value: '01'}, {text: 'February', value: '02'}, {text: 'March', value: '03'}, {text: 'April', value: '04'}, {text: 'May', value: '05'}, {text: 'June', value: '06'}, {text: 'July', value: '07'}, {text: 'August', value: '08'}, {text: 'September', value: '09'}, {text: 'October', value: '10'}, {text: 'November', value: '11'}, {text: 'December', value: '12'}
];
const year = [
  {text: '2023', value: '2023'}, {text: '2022', value: '2022'}, {text: '2021', value: '2021'}, {text: '2020', value: '2020'}, {text: '2019', value: '2019'}, {text: '2018', value: '2018'}, {text: '2017', value: '2017'}, {text: '2016', value: '2016'}, {text: '2015', value: '2015'}, {text: '2014', value: '2014'}, {text: '2013', value: '2013'}, {text: '2012', value: '2012'}, {text: '2011', value: '2011'}, {text: '2010', value: '2010'}, {text: '2009', value: '2009'}, {text: '2008', value: '2008'}, {text: '2007', value: '2007'}, {text: '2006', value: '2006'}, {text: '2005', value: '2005'}, {text: '2004', value: '2004'}, {text: '2003', value: '2003'}, {text: '2002', value: '2002'}, {text: '2001', value: '2001'}, {text: '2000', value: '2000'}, {text: '1999', value: '1999'}, {text: '1998', value: '1998'}, {text: '1997', value: '1997'}, {text: '1996', value: '1996'}, {text: '1995', value: '1995'}, {text: '1994', value: '1994'}, {text: '1993', value: '1993'}, {text: '1992', value: '1992'}, {text: '1991', value: '1991'}, {text: '1990', value: '1990'}, {text: '1989', value: '1989'}, {text: '1988', value: '1988'}, {text: '1987', value: '1987'}, {text: '1986', value: '1986'}, {text: '1985', value: '1985'}, {text: '1984', value: '1984'}, {text: '1983', value: '1983'}, {text: '1982', value: '1982'}, {text: '1981', value: '1981'}, {text: '1980', value: '1980'}, {text: '1979', value: '1979'}, {text: '1978', value: '1978'}, {text: '1977', value: '1977'}, {text: '1976', value: '1976'}, {text: '1975', value: '1975'}, {text: '1974', value: '1974'}, {text: '1973', value: '1973'}, {text: '1972', value: '1972'}, {text: '1971', value: '1971'}, {text: '1970', value: '1970'}, {text: '1969', value: '1969'}, {text: '1968', value: '1968'}, {text: '1967', value: '1967'}, {text: '1966', value: '1966'}, {text: '1965', value: '1965'}, {text: '1964', value: '1964'}, {text: '1963', value: '1963'}, {text: '1962', value: '1962'}, {text: '1961', value: '1961'}, {text: '1960', value: '1960'}, {text: '1959', value: '1959'}, {text: '1958', value: '1958'}, {text: '1957', value: '1957'}, {text: '1956', value: '1956'}, {text: '1955', value: '1955'}, {text: '1954', value: '1954'}, {text: '1953', value: '1953'}, {text: '1952', value: '1952'}, {text: '1951', value: '1951'}, {text: '1950', value: '1950'}, {text: '1949', value: '1949'}, {text: '1948', value: '1948'}, {text: '1947', value: '1947'}, {text: '1946', value: '1946'}, {text: '1945', value: '1945'}, {text: '1944', value: '1944'}, {text: '1943', value: '1943'}, {text: '1942', value: '1942'}, {text: '1941', value: '1941'}, {text: '1940', value: '1940'}, {text: '1939', value: '1939'}, {text: '1938', value: '1938'}, {text: '1937', value: '1937'}, {text: '1936', value: '1936'}, {text: '1935', value: '1935'}, {text: '1934', value: '1934'}, {text: '1933', value: '1933'}, {text: '1932', value: '1932'}, {text: '1931', value: '1931'}, {text: '1930', value: '1930'}, {text: '1929', value: '1929'}, {text: '1928', value: '1928'}, {text: '1927', value: '1927'}, {text: '1926', value: '1926'}, {text: '1925', value: '1925'}, {text: '1924', value: '1924'}, {text: '1923', value: '1923'}, {text: '1922', value: '1922'}, {text: '1921', value: '1921'}, {text: '1920', value: '1920'}, {text: '1919', value: '1919'}, {text: '1918', value: '1918'}, {text: '1917', value: '1917'}, {text: '1916', value: '1916'}, {text: '1915', value: '1915'}, {text: '1914', value: '1914'}, {text: '1913', value: '1913'}, {text: '1912', value: '1912'}, {text: '1911', value: '1911'}, {text: '1910', value: '1910'}, {text: '1909', value: '1909'}, {text: '1908', value: '1908'}, {text: '1907', value: '1907'}, {text: '1906', value: '1906'}, {text: '1905', value: '1905'}, {text: '1904', value: '1904'}, {text: '1903', value: '1903'}, {text: '1902', value: '1902'}, {text: '1901', value: '1901'}, {text: '1900', value: '1900'}
];
const birthdateData = {day: day, month: month, year: year};

const genderData = [
  {text: 'Male', value: 'male'}, {text: 'Female', value: 'female'}, {text: 'Other', value: 'other'}
];

const languageLevels = [
  { text: 'Fluent', value: 'fluent'}, { text: 'Intermediate', value: 'intermediate'}, {text: 'Beginner', value: 'beginner'}
];

export { countryData, birthdateData, genderData, languages, languageLevels};
/**
 * The drawings, as the shapes that make them.
 *
 * The pictures that ship are PNG — see `build.mjs` for why — and a PNG is a
 * thing nobody can correct. A colour is wrong, a subject sits too low, and the
 * only remedy on a flattened file is to draw it again from nothing. So the
 * geometry lives here, in the tool that renders it, and the render is
 * reproducible: change a number, run the build, and every size comes out
 * right.
 *
 * This is not content and does not belong beside it. `content/echo/images/`
 * holds what the app loads; this holds what produced it.
 *
 * Every entry is the body of one drawing: the plate, the contour and the
 * palette are applied by the renderer, so what is written here is only the
 * subject. `ILLUSTRATION.md` is the language they are drawn in and the rules
 * they have to keep.
 */
export const DRAWINGS = {
  'alarm-clock': {
    label: 'An alarm clock',
    body: `
      <circle cx="138" cy="102" r="26" fill="#ffc409"/>
      <circle cx="262" cy="102" r="26" fill="#ffc409"/>
      <path d="M152 226 L136 250" fill="none"/>
      <path d="M248 226 L264 250" fill="none"/>
      <circle cx="200" cy="166" r="80" fill="#ffffff"/>
      <path d="M200 166 L200 120" fill="none"/>
      <path d="M200 166 L234 166" fill="none"/>`,
  },
  ambulance: {
    label: 'An ambulance',
    body: `
      <path d="M88 132 L216 132 L216 210 L88 210 Z" fill="#ffffff"/>
      <path d="M216 152 L276 152 L312 190 L312 210 L216 210 Z" fill="#ff571a"/>
      <path d="M132 156 L172 156 M152 136 L152 176" fill="none" stroke="#e5484d"/>
      <circle cx="132" cy="220" r="26" fill="#ffffff"/>
      <circle cx="268" cy="220" r="26" fill="#ffffff"/>`,
  },
  automobile: {
    label: 'A car',
    body: `
      <path d="M132 146 L152 108 L248 108 L268 146 Z" fill="#3b6cf6"/>
      <rect x="88" y="146" width="224" height="64" rx="20" fill="#ff571a"/>
      <circle cx="140" cy="212" r="26" fill="#ffffff"/>
      <circle cx="262" cy="212" r="26" fill="#ffffff"/>`,
  },
  baby: {
    label: 'A baby',
    body: `
      <circle cx="200" cy="150" r="88" fill="#ffc409"/>
      <circle cx="170" cy="146" r="10" fill="#17191c"/>
      <circle cx="230" cy="146" r="10" fill="#17191c"/>
      <path d="M178 186 Q200 204 222 186" fill="none"/>
      <path d="M186 62 Q200 40 216 58" fill="none"/>`,
  },
  bed: {
    label: 'A bed',
    body: `
      <rect x="80" y="104" width="24" height="118" rx="8" fill="#ffc409"/>
      <rect x="96" y="168" width="216" height="54" rx="12" fill="#ffffff"/>
      <rect x="112" y="140" width="76" height="36" rx="10" fill="#3b6cf6"/>
      <path d="M104 222 L104 248" fill="none"/>
      <path d="M300 222 L300 248" fill="none"/>`,
  },
  'birthday-cake': {
    label: 'A cake with three lit candles',
    body: `
      <rect x="146" y="112" width="16" height="46" rx="4" fill="#3b6cf6"/>
      <rect x="192" y="112" width="16" height="46" rx="4" fill="#3b6cf6"/>
      <rect x="238" y="112" width="16" height="46" rx="4" fill="#3b6cf6"/>
      <path d="M154 80 C162 92 165 96 165 102 A11 11 0 1 1 143 102 C143 96 146 92 154 80 Z" fill="#ff571a"/>
      <path d="M200 80 C208 92 211 96 211 102 A11 11 0 1 1 189 102 C189 96 192 92 200 80 Z" fill="#ff571a"/>
      <path d="M246 80 C254 92 257 96 257 102 A11 11 0 1 1 235 102 C235 96 238 92 246 80 Z" fill="#ff571a"/>
      <rect x="116" y="186" width="168" height="64" rx="16" fill="#ffffff"/>
      <rect x="116" y="150" width="168" height="42" rx="16" fill="#ffc409"/>`,
  },
  books: {
    label: 'A stack of books',
    body: `
      <rect x="110" y="196" width="180" height="36" rx="6" fill="#3b6cf6"/>
      <rect x="122" y="158" width="160" height="36" rx="6" fill="#ffc409"/>
      <rect x="104" y="120" width="176" height="36" rx="6" fill="#ff571a"/>`,
  },
  boy: {
    label: 'A boy',
    body: `
      <rect x="150" y="196" width="24" height="52" rx="12" fill="#3b6cf6"/>
      <rect x="226" y="196" width="24" height="52" rx="12" fill="#3b6cf6"/>
      <rect x="120" y="134" width="24" height="72" rx="12" fill="#ffc409"/>
      <rect x="256" y="134" width="24" height="72" rx="12" fill="#ffc409"/>
      <rect x="146" y="126" width="108" height="86" rx="30" fill="#009f70"/>
      <circle cx="200" cy="80" r="36" fill="#ffc409"/>
      <path d="M164 70 A36 36 0 0 1 236 70 Z" fill="#17191c"/>`,
  },
  brain: {
    label: 'A brain',
    body: `
      <path d="M112 152 A44 44 0 0 1 150 90 A46 46 0 0 1 200 82 A46 46 0 0 1 250 90 A44 44 0 0 1 288 152 A46 46 0 0 1 248 216 L152 216 A46 46 0 0 1 112 152 Z" fill="#ff571a"/>
      <path d="M200 88 L200 216" fill="none"/>
      <path d="M160 122 Q186 138 160 158" fill="none"/>
      <path d="M240 122 Q214 138 240 158" fill="none"/>`,
  },
  briefcase: {
    label: 'A briefcase',
    body: `
      <path d="M168 120 L168 100 A10 10 0 0 1 178 90 L222 90 A10 10 0 0 1 232 100 L232 120" fill="none"/>
      <rect x="88" y="120" width="224" height="128" rx="16" fill="#ff571a"/>
      <rect x="184" y="164" width="32" height="40" rx="6" fill="#ffc409"/>`,
  },
  'broken-heart': {
    label: 'A broken heart',
    body: `
      <path d="M200 240 C108 176 96 140 96 118 A48 48 0 0 1 200 96 A48 48 0 0 1 304 118 C304 140 292 176 200 240 Z" fill="#e5484d"/>
      <path d="M198 100 L224 148 L178 176 L206 222" fill="none"/>`,
  },
  'busts-in-silhouette': {
    label: 'Two people',
    body: `
      <path d="M112 244 A66 66 0 0 1 244 244 Z" fill="#3b6cf6"/>
      <circle cx="178" cy="120" r="46" fill="#3b6cf6"/>
      <path d="M186 244 A62 62 0 0 1 310 244 Z" fill="#009f70"/>
      <circle cx="248" cy="130" r="42" fill="#009f70"/>`,
  },
  calendar: {
    label: 'A calendar',
    body: `
      <path d="M140 74 L140 106" fill="none"/>
      <path d="M260 74 L260 106" fill="none"/>
      <rect x="96" y="96" width="208" height="160" rx="14" fill="#ffffff"/>
      <path d="M96 110 A14 14 0 0 1 110 96 L290 96 A14 14 0 0 1 304 110 L304 140 L96 140 Z" fill="#3b6cf6"/>
      <circle cx="140" cy="176" r="9" fill="#17191c" stroke="none"/>
      <circle cx="200" cy="176" r="9" fill="#17191c" stroke="none"/>
      <circle cx="260" cy="176" r="9" fill="#17191c" stroke="none"/>
      <circle cx="140" cy="216" r="9" fill="#17191c" stroke="none"/>
      <circle cx="200" cy="216" r="9" fill="#ff571a" stroke="none"/>
      <circle cx="260" cy="216" r="9" fill="#17191c" stroke="none"/>`,
  },
  chair: {
    label: 'A chair',
    body: `
      <rect x="150" y="70" width="100" height="110" rx="10" fill="#ffc409"/>
      <rect x="132" y="170" width="136" height="28" rx="8" fill="#ffffff"/>
      <path d="M146 198 L140 242" fill="none"/>
      <path d="M254 198 L260 242" fill="none"/>`,
  },
  'chart-increasing': {
    label: 'A rising chart',
    body: `
      <path d="M88 62 L88 242 L316 242" fill="none"/>
      <path d="M124 208 L182 156 L228 182 L296 106" fill="none" stroke="#009f70"/>
      <path d="M296 106 L258 102 L272 138 Z" fill="#009f70"/>`,
  },
  'chequered-flag': {
    label: 'A chequered flag',
    body: `
      <path d="M108 62 L108 250" fill="none"/>
      <rect x="116" y="70" width="188" height="120" rx="6" fill="#ffffff"/>
      <rect x="116" y="70" width="47" height="40" fill="#17191c" stroke="none"/>
      <rect x="210" y="70" width="47" height="40" fill="#17191c" stroke="none"/>
      <rect x="163" y="110" width="47" height="40" fill="#17191c" stroke="none"/>
      <rect x="257" y="110" width="47" height="40" fill="#17191c" stroke="none"/>
      <rect x="116" y="150" width="47" height="40" fill="#17191c" stroke="none"/>
      <rect x="210" y="150" width="47" height="40" fill="#17191c" stroke="none"/>
      <rect x="116" y="70" width="188" height="120" rx="6" fill="none"/>`,
  },
  'cloud-with-rain': {
    label: 'A cloud with rain',
    body: `
      <path d="M136 172 A36 36 0 0 1 148 104 A48 48 0 0 1 238 100 A34 34 0 0 1 268 172 Z" fill="#ffffff"/>
      <path d="M154 196 L144 234" fill="none" stroke="#3b6cf6"/>
      <path d="M202 196 L192 234" fill="none" stroke="#3b6cf6"/>
      <path d="M250 196 L240 234" fill="none" stroke="#3b6cf6"/>`,
  },
  'cold-face': {
    label: 'A face feeling cold',
    body: `
      <circle cx="200" cy="150" r="92" fill="#3b6cf6"/>
      <path d="M154 134 L186 142" fill="none"/>
      <path d="M214 142 L246 134" fill="none"/>
      <path d="M168 196 Q184 180 200 196 Q216 212 232 196" fill="none"/>
      <path d="M132 68 L132 106 M116 78 L148 96 M148 78 L116 96" fill="none" stroke="#ffffff"/>`,
  },
  compass: {
    label: 'A compass',
    body: `
      <circle cx="200" cy="150" r="86" fill="#ffffff"/>
      <path d="M200 80 L226 150 L174 150 Z" fill="#ff571a"/>
      <path d="M200 220 L174 150 L226 150 Z" fill="#f4f5f7"/>`,
  },
  'crying-face': {
    label: 'A face with a single tear',
    body: `
      <circle cx="200" cy="150" r="92" fill="#ffc409"/>
      <path d="M154 110 L184 100" fill="none"/>
      <path d="M216 100 L246 110" fill="none"/>
      <circle cx="170" cy="132" r="10" fill="#17191c"/>
      <circle cx="230" cy="132" r="10" fill="#17191c"/>
      <path d="M168 200 Q200 172 232 200" fill="none"/>
      <path d="M264 148 C274 166 278 174 278 182 A14 14 0 1 1 250 182 C250 174 254 166 264 148 Z" fill="#3b6cf6"/>`,
  },
  'disappointed-face': {
    label: 'A disappointed face',
    body: `
      <circle cx="200" cy="150" r="92" fill="#ffc409"/>
      <path d="M154 114 L188 106" fill="none"/>
      <path d="M212 106 L246 114" fill="none"/>
      <path d="M154 134 Q172 150 190 134" fill="none"/>
      <path d="M210 134 Q228 150 246 134" fill="none"/>
      <path d="M170 200 Q200 178 230 200" fill="none"/>`,
  },
  door: {
    label: 'An open doorway',
    body: `
      <rect x="128" y="56" width="144" height="192" rx="12" fill="#ffffff"/>
      <rect x="146" y="74" width="108" height="174" rx="8" fill="#ff571a"/>
      <circle cx="228" cy="168" r="9" fill="#ffc409"/>`,
  },
  eyes: {
    label: 'A pair of eyes',
    body: `
      <path d="M62 150 Q116 96 170 150 Q116 204 62 150 Z" fill="#ffffff"/>
      <circle cx="116" cy="150" r="22" fill="#3b6cf6"/>
      <path d="M230 150 Q284 96 338 150 Q284 204 230 150 Z" fill="#ffffff"/>
      <circle cx="284" cy="150" r="22" fill="#3b6cf6"/>`,
  },
  'face-with-head-bandage': {
    label: 'A face with a bandage',
    body: `
      <circle cx="200" cy="150" r="92" fill="#ffc409"/>
      <circle cx="170" cy="152" r="10" fill="#17191c"/>
      <circle cx="230" cy="152" r="10" fill="#17191c"/>
      <path d="M176 196 Q200 184 224 196" fill="none"/>
      <path d="M118 128 L282 96 L290 132 L126 164 Z" fill="#ffffff"/>`,
  },
  'fearful-face': {
    label: 'A fearful face',
    body: `
      <circle cx="200" cy="150" r="92" fill="#ffc409"/>
      <path d="M148 104 Q168 92 188 102" fill="none"/>
      <path d="M212 102 Q232 92 252 104" fill="none"/>
      <ellipse cx="170" cy="140" rx="20" ry="24" fill="#ffffff"/>
      <ellipse cx="230" cy="140" rx="20" ry="24" fill="#ffffff"/>
      <circle cx="170" cy="146" r="9" fill="#17191c" stroke="none"/>
      <circle cx="230" cy="146" r="9" fill="#17191c" stroke="none"/>
      <ellipse cx="200" cy="196" rx="20" ry="24" fill="#ffffff"/>`,
  },
  fire: {
    label: 'A flame',
    body: `
      <path d="M200 54 C236 106 266 118 266 166 A66 66 0 0 1 134 166 C134 132 158 122 168 96 C186 118 178 140 196 146 C210 138 210 100 200 54 Z" fill="#ff571a"/>
      <path d="M200 150 C216 176 224 182 224 198 A24 24 0 0 1 176 198 C176 180 190 172 200 150 Z" fill="#ffc409"/>`,
  },
  'folded-hands': {
    label: 'Two palms pressed together',
    body: `
      <rect x="128" y="70" width="62" height="170" rx="31" fill="#ffc409" transform="rotate(12 159 240)"/>
      <rect x="210" y="70" width="62" height="170" rx="31" fill="#ffc409" transform="rotate(-12 241 240)"/>`,
  },
  'fork-and-knife-with-plate': {
    label: 'A plate with a fork and knife',
    body: `
      <path d="M78 76 L78 118" fill="none"/>
      <path d="M100 76 L100 118" fill="none"/>
      <path d="M122 76 L122 118" fill="none"/>
      <path d="M100 118 L100 240" fill="none"/>
      <path d="M300 78 L316 100 L308 148 L292 148 Z" fill="#ffffff"/>
      <path d="M300 148 L300 240" fill="none"/>
      <circle cx="200" cy="158" r="76" fill="#ffffff"/>
      <circle cx="200" cy="158" r="48" fill="none"/>`,
  },
  'four-leaf-clover': {
    label: 'A four leaf clover',
    body: `
      <circle cx="168" cy="116" r="40" fill="#009f70"/>
      <circle cx="232" cy="116" r="40" fill="#009f70"/>
      <circle cx="168" cy="180" r="40" fill="#009f70"/>
      <circle cx="232" cy="180" r="40" fill="#009f70"/>
      <path d="M200 194 Q210 232 236 246" fill="none"/>`,
  },
  girl: {
    label: 'A girl',
    body: `
      <rect x="164" y="204" width="24" height="44" rx="12" fill="#3b6cf6"/>
      <rect x="212" y="204" width="24" height="44" rx="12" fill="#3b6cf6"/>
      <rect x="120" y="134" width="24" height="72" rx="12" fill="#ffc409"/>
      <rect x="256" y="134" width="24" height="72" rx="12" fill="#ffc409"/>
      <path d="M200 120 L262 212 L138 212 Z" fill="#ff571a"/>
      <circle cx="200" cy="80" r="36" fill="#ffc409"/>
      <path d="M160 82 A40 40 0 0 1 240 82 L240 50 L160 50 Z" fill="#17191c"/>`,
  },
  'glass-of-milk': {
    label: 'A glass of milk',
    body: `
      <path d="M144 72 L256 72 L240 244 L160 244 Z" fill="#ffffff"/>
      <path d="M151 148 L249 148" fill="none"/>`,
  },
  handshake: {
    label: 'Two hands clasped',
    body: `
      <rect x="48" y="158" width="132" height="52" rx="26" fill="#3b6cf6" transform="rotate(-22 114 184)"/>
      <rect x="220" y="158" width="132" height="52" rx="26" fill="#009f70" transform="rotate(22 286 184)"/>
      <rect x="152" y="114" width="96" height="106" rx="34" fill="#ffc409"/>`,
  },
  'heart-with-arrow': {
    label: 'A heart with an arrow',
    body: `
      <path d="M200 240 C108 176 96 140 96 118 A48 48 0 0 1 200 96 A48 48 0 0 1 304 118 C304 140 292 176 200 240 Z" fill="#e5484d"/>
      <path d="M74 236 L326 76" fill="none"/>
      <path d="M326 76 L292 78 L306 106 Z" fill="#17191c"/>
      <path d="M74 236 L82 208 L104 222 Z" fill="#17191c"/>`,
  },
  'hourglass-not-done': {
    label: 'An hourglass',
    body: `
      <path d="M140 84 L260 84 L210 150 L260 216 L140 216 L190 150 Z" fill="#ffffff"/>
      <path d="M160 100 L240 100 L200 152 Z" fill="#ffc409" stroke="none"/>
      <path d="M170 212 L230 212 L200 184 Z" fill="#ffc409" stroke="none"/>
      <rect x="124" y="60" width="152" height="22" rx="8" fill="#ffffff"/>
      <rect x="124" y="218" width="152" height="22" rx="8" fill="#ffffff"/>`,
  },
  house: {
    label: 'A house',
    body: `
      <rect x="112" y="152" width="176" height="96" rx="8" fill="#ffffff"/>
      <path d="M96 158 L200 78 L304 158 Z" fill="#ff571a"/>
      <rect x="176" y="196" width="48" height="52" rx="4" fill="#ffc409"/>
      <rect x="130" y="176" width="34" height="34" rx="4" fill="#3b6cf6"/>`,
  },
  'light-bulb': {
    label: 'A light bulb',
    body: `
      <path d="M112 106 L92 96" fill="none" stroke="#ff571a"/>
      <path d="M288 106 L308 96" fill="none" stroke="#ff571a"/>
      <path d="M200 70 L200 52" fill="none" stroke="#ff571a"/>
      <circle cx="200" cy="146" r="64" fill="#ffc409"/>
      <path d="M182 152 L200 178 L218 152" fill="none"/>
      <rect x="172" y="202" width="56" height="34" rx="6" fill="#ffffff"/>
      <path d="M176 220 L224 220" fill="none"/>`,
  },
  'loudly-crying-face': {
    label: 'A loudly crying face',
    body: `
      <circle cx="200" cy="150" r="92" fill="#ffc409"/>
      <path d="M150 124 Q170 108 190 124" fill="none"/>
      <path d="M210 124 Q230 108 250 124" fill="none"/>
      <path d="M152 148 L188 148" fill="none"/>
      <path d="M212 148 L248 148" fill="none"/>
      <ellipse cx="200" cy="194" rx="30" ry="24" fill="#ffffff"/>
      <path d="M166 162 L156 226" fill="none" stroke="#3b6cf6"/>
      <path d="M234 162 L244 226" fill="none" stroke="#3b6cf6"/>`,
  },
  luggage: {
    label: 'A suitcase',
    body: `
      <path d="M168 108 L168 78 L232 78 L232 108" fill="none"/>
      <rect x="112" y="108" width="176" height="140" rx="18" fill="#3b6cf6"/>
      <rect x="112" y="158" width="176" height="28" fill="#ffc409"/>`,
  },
  'lying-face': {
    label: 'A face with a long nose',
    body: `
      <circle cx="200" cy="150" r="92" fill="#ffc409"/>
      <circle cx="164" cy="128" r="10" fill="#17191c"/>
      <circle cx="226" cy="128" r="10" fill="#17191c"/>
      <path d="M176 212 L224 210" fill="none"/>
      <path d="M198 152 L336 172 L198 192 Z" fill="#ffc409"/>`,
  },
  'ok-hand': {
    label: 'A hand making the OK sign',
    body: `
      <rect x="186" y="150" width="112" height="92" rx="30" fill="#ffc409"/>
      <rect x="196" y="88" width="26" height="130" rx="13" fill="#ffc409"/>
      <rect x="228" y="74" width="26" height="144" rx="13" fill="#ffc409"/>
      <rect x="260" y="92" width="26" height="126" rx="13" fill="#ffc409"/>
      <circle cx="148" cy="188" r="46" fill="#ffc409"/>
      <circle cx="148" cy="188" r="20" fill="#f4f5f7"/>`,
  },
  'open-book': {
    label: 'An open book',
    body: `
      <path d="M200 106 C168 86 128 86 96 94 L96 216 C128 208 168 208 200 228 Z" fill="#ffffff"/>
      <path d="M200 106 C232 86 272 86 304 94 L304 216 C272 208 232 208 200 228 Z" fill="#ffffff"/>
      <path d="M200 106 L200 228" fill="none"/>`,
  },
  'party-popper': {
    label: 'A party popper',
    body: `
      <path d="M104 244 L172 128 L236 196 Z" fill="#ffc409"/>
      <path d="M250 128 L274 114" fill="none" stroke="#3b6cf6"/>
      <path d="M226 92 L240 68" fill="none" stroke="#009f70"/>
      <path d="M286 176 L312 166" fill="none" stroke="#ff571a"/>
      <path d="M176 72 L178 50" fill="none" stroke="#ff571a"/>
      <path d="M288 84 L308 68" fill="none" stroke="#3b6cf6"/>`,
  },
  'pensive-face': {
    label: 'A pensive face',
    body: `
      <circle cx="200" cy="150" r="92" fill="#ffc409"/>
      <path d="M154 112 L186 104" fill="none"/>
      <path d="M214 104 L246 112" fill="none"/>
      <circle cx="170" cy="138" r="10" fill="#17191c"/>
      <circle cx="230" cy="138" r="10" fill="#17191c"/>
      <path d="M172 198 Q200 178 228 198" fill="none"/>`,
  },
  'person-gesturing-no': {
    label: 'A person with arms crossed in a no',
    body: `
      <rect x="170" y="192" width="24" height="56" rx="12" fill="#3b6cf6"/>
      <rect x="206" y="192" width="24" height="56" rx="12" fill="#3b6cf6"/>
      <rect x="168" y="122" width="64" height="86" rx="28" fill="#3b6cf6"/>
      <circle cx="200" cy="80" r="32" fill="#ffc409"/>
      <rect x="134" y="128" width="24" height="96" rx="12" fill="#e5484d" transform="rotate(-48 146 176)"/>
      <rect x="242" y="128" width="24" height="96" rx="12" fill="#e5484d" transform="rotate(48 254 176)"/>`,
  },
  'person-raising-hand': {
    label: 'A person raising a hand',
    body: `
      <rect x="140" y="130" width="24" height="76" rx="12" fill="#ffc409"/>
      <rect x="240" y="72" width="24" height="94" rx="12" fill="#ffc409" transform="rotate(16 252 119)"/>
      <rect x="170" y="192" width="24" height="56" rx="12" fill="#3b6cf6"/>
      <rect x="206" y="192" width="24" height="56" rx="12" fill="#3b6cf6"/>
      <rect x="168" y="122" width="64" height="86" rx="28" fill="#3b6cf6"/>
      <circle cx="200" cy="80" r="32" fill="#ffc409"/>`,
  },
  'person-running': {
    label: 'A person running',
    body: `
      <rect x="132" y="124" width="24" height="72" rx="12" fill="#ffc409" transform="rotate(52 144 160)"/>
      <rect x="240" y="124" width="24" height="72" rx="12" fill="#ffc409" transform="rotate(-52 252 160)"/>
      <rect x="166" y="186" width="24" height="62" rx="12" fill="#3b6cf6" transform="rotate(44 178 217)"/>
      <rect x="210" y="186" width="24" height="62" rx="12" fill="#3b6cf6" transform="rotate(-38 222 217)"/>
      <rect x="168" y="118" width="64" height="84" rx="28" fill="#3b6cf6" transform="rotate(-12 200 160)"/>
      <circle cx="188" cy="76" r="32" fill="#ffc409"/>`,
  },
  'person-shrugging': {
    label: 'A person shrugging',
    body: `
      <rect x="118" y="130" width="24" height="70" rx="12" fill="#ffc409" transform="rotate(66 130 165)"/>
      <rect x="258" y="130" width="24" height="70" rx="12" fill="#ffc409" transform="rotate(-66 270 165)"/>
      <rect x="170" y="198" width="24" height="50" rx="12" fill="#3b6cf6"/>
      <rect x="206" y="198" width="24" height="50" rx="12" fill="#3b6cf6"/>
      <rect x="168" y="128" width="64" height="82" rx="28" fill="#3b6cf6"/>
      <circle cx="200" cy="86" r="32" fill="#ffc409"/>
      <path d="M150 92 L138 78" fill="none" stroke="#3b6cf6"/>
      <path d="M250 92 L262 78" fill="none" stroke="#3b6cf6"/>`,
  },
  'person-standing': {
    label: 'A person standing',
    body: `
      <rect x="140" y="130" width="24" height="76" rx="12" fill="#ffc409"/>
      <rect x="236" y="130" width="24" height="76" rx="12" fill="#ffc409"/>
      <rect x="170" y="192" width="24" height="56" rx="12" fill="#3b6cf6"/>
      <rect x="206" y="192" width="24" height="56" rx="12" fill="#3b6cf6"/>
      <rect x="168" y="122" width="64" height="86" rx="28" fill="#3b6cf6"/>
      <circle cx="200" cy="80" r="32" fill="#ffc409"/>`,
  },
  'person-swimming': {
    label: 'A person swimming',
    body: `
      <path d="M74 224 Q112 204 150 224 T226 224 T302 224" fill="none" stroke="#3b6cf6"/>
      <path d="M74 252 Q112 232 150 252 T226 252 T302 252" fill="none" stroke="#3b6cf6"/>
      <rect x="118" y="146" width="24" height="76" rx="12" fill="#ffc409" transform="rotate(62 130 184)"/>
      <rect x="148" y="150" width="132" height="54" rx="26" fill="#3b6cf6"/>
      <circle cx="136" cy="120" r="30" fill="#ffc409"/>
      <rect x="272" y="160" width="24" height="70" rx="12" fill="#3b6cf6" transform="rotate(-58 284 195)"/>`,
  },
  'person-walking': {
    label: 'A person walking',
    body: `
      <rect x="140" y="128" width="24" height="76" rx="12" fill="#ffc409" transform="rotate(24 152 166)"/>
      <rect x="236" y="128" width="24" height="76" rx="12" fill="#ffc409" transform="rotate(-24 248 166)"/>
      <rect x="170" y="190" width="24" height="60" rx="12" fill="#3b6cf6" transform="rotate(20 182 220)"/>
      <rect x="206" y="190" width="24" height="60" rx="12" fill="#3b6cf6" transform="rotate(-20 218 220)"/>
      <rect x="168" y="120" width="64" height="86" rx="28" fill="#3b6cf6"/>
      <circle cx="200" cy="78" r="32" fill="#ffc409"/>`,
  },
  prohibited: {
    label: 'A no entry sign',
    body: `
      <circle cx="200" cy="150" r="92" fill="#ffffff"/>
      <circle cx="200" cy="150" r="92" fill="none" stroke="#e5484d" stroke-width="26"/>
      <path d="M135 85 L265 215" fill="none" stroke="#e5484d" stroke-width="26"/>`,
  },
  'raised-hand': {
    label: 'An open raised hand',
    body: `
      <rect x="76" y="148" width="30" height="86" rx="15" fill="#ffc409" transform="rotate(-28 91 191)"/>
      <path d="M110 238 L110 124 A13 13 0 0 1 136 124 L136 152 L158 152 L158 100 A13 13 0 0 1 184 100 L184 152 L206 152 L206 86 A13 13 0 0 1 232 86 L232 152 L254 152 L254 102 A13 13 0 0 1 280 102 L280 238 Z" fill="#ffc409"/>`,
  },
  receipt: {
    label: 'A receipt',
    body: `
      <path d="M116 62 L284 62 L284 238 L258 220 L232 238 L206 220 L180 238 L154 220 L128 238 L116 230 Z" fill="#ffffff"/>
      <path d="M150 110 L250 110" fill="none"/>
      <path d="M150 146 L250 146" fill="none"/>
      <path d="M150 182 L208 182" fill="none"/>`,
  },
  'red-heart': {
    label: 'A heart',
    body: `
      <path d="M200 240 C108 176 96 140 96 118 A48 48 0 0 1 200 96 A48 48 0 0 1 304 118 C304 140 292 176 200 240 Z" fill="#e5484d"/>`,
  },
  'relieved-face': {
    label: 'A relieved face',
    body: `
      <circle cx="200" cy="150" r="92" fill="#ffc409"/>
      <path d="M152 134 Q170 148 188 134" fill="none"/>
      <path d="M212 134 Q230 148 248 134" fill="none"/>
      <path d="M176 186 Q200 200 224 186" fill="none"/>`,
  },
  restroom: {
    label: 'A restroom sign',
    body: `
      <rect x="142" y="196" width="22" height="52" rx="11" fill="#3b6cf6"/>
      <rect x="176" y="196" width="22" height="52" rx="11" fill="#3b6cf6"/>
      <rect x="140" y="128" width="60" height="80" rx="26" fill="#3b6cf6"/>
      <circle cx="170" cy="86" r="28" fill="#3b6cf6"/>
      <rect x="222" y="204" width="22" height="44" rx="11" fill="#ff571a"/>
      <rect x="254" y="204" width="22" height="44" rx="11" fill="#ff571a"/>
      <path d="M248 122 L296 212 L200 212 Z" fill="#ff571a"/>
      <circle cx="248" cy="86" r="28" fill="#ff571a"/>`,
  },
  ring: {
    label: 'A ring',
    body: `
      <path d="M200 58 L232 92 L200 126 L168 92 Z" fill="#3b6cf6"/>
      <circle cx="200" cy="184" r="58" fill="#ffc409"/>
      <circle cx="200" cy="184" r="32" fill="#f4f5f7"/>`,
  },
  'round-pushpin': {
    label: 'A pushpin',
    body: `
      <path d="M200 196 L200 248" fill="none"/>
      <circle cx="200" cy="146" r="52" fill="#ff571a"/>`,
  },
  school: {
    label: 'A school building',
    body: `
      <rect x="96" y="132" width="208" height="116" rx="10" fill="#ffffff"/>
      <path d="M80 138 L200 74 L320 138 Z" fill="#3b6cf6"/>
      <path d="M200 74 L200 44" fill="none"/>
      <path d="M200 46 L244 58 L200 70 Z" fill="#ff571a"/>
      <rect x="176" y="192" width="48" height="56" rx="4" fill="#ffc409"/>
      <rect x="124" y="172" width="34" height="34" rx="4" fill="#3b6cf6"/>
      <rect x="242" y="172" width="34" height="34" rx="4" fill="#3b6cf6"/>`,
  },
  'shushing-face': {
    label: 'A face asking for quiet',
    body: `
      <circle cx="200" cy="150" r="92" fill="#ffc409"/>
      <circle cx="170" cy="128" r="10" fill="#17191c"/>
      <circle cx="230" cy="128" r="10" fill="#17191c"/>
      <path d="M176 192 L224 192" fill="none"/>
      <rect x="188" y="160" width="24" height="86" rx="12" fill="#ffc409"/>`,
  },
  'sleeping-face': {
    label: 'A sleeping face',
    body: `
      <circle cx="200" cy="150" r="92" fill="#ffc409"/>
      <path d="M154 140 L188 140" fill="none"/>
      <path d="M212 140 L246 140" fill="none"/>
      <ellipse cx="200" cy="192" rx="18" ry="13" fill="#ffffff"/>
      <circle cx="276" cy="116" r="8" fill="#3b6cf6"/>
      <circle cx="298" cy="94" r="10" fill="#3b6cf6"/>
      <circle cx="322" cy="68" r="13" fill="#3b6cf6"/>`,
  },
  'smiling-face-with-smiling-eyes': {
    label: 'A smiling face with smiling eyes',
    body: `
      <circle cx="200" cy="150" r="92" fill="#ffc409"/>
      <path d="M152 140 Q170 118 188 140" fill="none"/>
      <path d="M212 140 Q230 118 248 140" fill="none"/>
      <path d="M164 176 Q200 210 236 176" fill="none"/>`,
  },
  'speaking-head': {
    label: 'A head speaking',
    body: `
      <circle cx="164" cy="150" r="74" fill="#ffc409"/>
      <circle cx="146" cy="128" r="10" fill="#17191c"/>
      <ellipse cx="170" cy="188" rx="26" ry="18" fill="#ffffff"/>
      <path d="M258 116 A46 46 0 0 1 258 190" fill="none" stroke="#3b6cf6"/>
      <path d="M292 94 A78 78 0 0 1 292 212" fill="none" stroke="#3b6cf6"/>`,
  },
  'speech-balloon': {
    label: 'A speech balloon',
    body: `
      <path d="M112 76 L288 76 A28 28 0 0 1 316 104 L316 188 A28 28 0 0 1 288 216 L206 216 L150 256 L162 216 L112 216 A28 28 0 0 1 84 188 L84 104 A28 28 0 0 1 112 76 Z" fill="#ffffff"/>
      <circle cx="152" cy="146" r="11" fill="#17191c" stroke="none"/>
      <circle cx="200" cy="146" r="11" fill="#17191c" stroke="none"/>
      <circle cx="248" cy="146" r="11" fill="#17191c" stroke="none"/>`,
  },
  stethoscope: {
    label: 'A stethoscope',
    body: `
      <path d="M136 84 L136 132 A64 64 0 0 0 264 132 L264 116" fill="none"/>
      <circle cx="136" cy="78" r="12" fill="#ffc409"/>
      <path d="M264 116 L264 166" fill="none"/>
      <circle cx="264" cy="198" r="32" fill="#3b6cf6"/>`,
  },
  'stop-sign': {
    label: 'A stop sign',
    body: `
      <path d="M281 184 L234 231 L166 231 L119 184 L119 116 L166 69 L234 69 L281 116 Z" fill="#e5484d"/>`,
  },
  'straight-ruler': {
    label: 'A ruler',
    body: `
      <rect x="72" y="126" width="256" height="48" rx="8" fill="#ffc409"/>
      <path d="M108 126 L108 150" fill="none"/>
      <path d="M144 126 L144 150" fill="none"/>
      <path d="M180 126 L180 150" fill="none"/>
      <path d="M216 126 L216 150" fill="none"/>
      <path d="M252 126 L252 150" fill="none"/>
      <path d="M288 126 L288 150" fill="none"/>`,
  },
  sunrise: {
    label: 'The sun rising over a hill',
    body: `
      <path d="M262 127 L285 119" fill="none" stroke="#ff571a"/>
      <path d="M247 103 L264 86" fill="none" stroke="#ff571a"/>
      <path d="M200 84 L200 60" fill="none" stroke="#ff571a"/>
      <path d="M153 103 L136 86" fill="none" stroke="#ff571a"/>
      <path d="M138 127 L115 119" fill="none" stroke="#ff571a"/>
      <circle cx="200" cy="150" r="54" fill="#ffc409"/>
      <path d="M66 246 Q200 176 334 246 Z" fill="#009f70"/>`,
  },
  tennis: {
    label: 'A tennis ball',
    body: `
      <circle cx="200" cy="158" r="66" fill="#ffc409"/>
      <path d="M148 120 A66 66 0 0 0 148 196" fill="none"/>
      <path d="M252 120 A66 66 0 0 1 252 196" fill="none"/>`,
  },
  'thinking-face': {
    label: 'A thinking face',
    body: `
      <circle cx="200" cy="150" r="92" fill="#ffc409"/>
      <path d="M150 110 L186 114" fill="none"/>
      <path d="M214 100 L250 112" fill="none"/>
      <circle cx="170" cy="140" r="10" fill="#17191c"/>
      <circle cx="230" cy="140" r="10" fill="#17191c"/>
      <path d="M172 194 L226 186" fill="none"/>`,
  },
  'thought-balloon': {
    label: 'A thought balloon',
    body: `
      <path d="M136 162 A36 36 0 0 1 148 94 A48 48 0 0 1 238 90 A34 34 0 0 1 268 162 Z" fill="#ffffff"/>
      <circle cx="158" cy="200" r="16" fill="#ffffff"/>
      <circle cx="126" cy="234" r="11" fill="#ffffff"/>`,
  },
  'thumbs-up': {
    label: 'A thumbs up',
    body: `
      <rect x="120" y="140" width="152" height="104" rx="32" fill="#ffc409"/>
      <rect x="126" y="62" width="46" height="96" rx="23" fill="#ffc409"/>
      <path d="M212 166 L212 190" fill="none"/>
      <path d="M246 166 L246 190" fill="none"/>`,
  },
  trophy: {
    label: 'A trophy',
    body: `
      <path d="M148 90 A28 28 0 0 0 112 118 A28 28 0 0 0 152 144" fill="none"/>
      <path d="M252 90 A28 28 0 0 1 288 118 A28 28 0 0 1 248 144" fill="none"/>
      <path d="M148 78 L252 78 L244 156 A44 44 0 0 1 156 156 Z" fill="#ffc409"/>
      <path d="M200 200 L200 218" fill="none"/>
      <rect x="156" y="218" width="88" height="24" rx="6" fill="#ffffff"/>`,
  },
  'waving-hand': {
    label: 'A waving hand',
    body: `
      <rect x="62" y="148" width="30" height="86" rx="15" fill="#ffc409" transform="rotate(-28 77 191)"/>
      <path d="M96 238 L96 124 A13 13 0 0 1 122 124 L122 152 L144 152 L144 100 A13 13 0 0 1 170 100 L170 152 L192 152 L192 86 A13 13 0 0 1 218 86 L218 152 L240 152 L240 102 A13 13 0 0 1 266 102 L266 238 Z" fill="#ffc409"/>
      <path d="M292 116 A48 48 0 0 1 292 196" fill="none" stroke="#3b6cf6"/>
      <path d="M322 92 A80 80 0 0 1 322 220" fill="none" stroke="#3b6cf6"/>`,
  },
  'world-map': {
    label: 'A globe',
    body: `
      <circle cx="200" cy="150" r="92" fill="#3b6cf6"/>
      <path d="M200 58 L200 242" fill="none"/>
      <path d="M108 150 L292 150" fill="none"/>
      <path d="M200 58 A54 92 0 0 1 200 242 A54 92 0 0 1 200 58 Z" fill="none"/>`,
  },
}

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
  'flushed-face': {
    label: 'A flushed face',
    body: `
      <circle cx="200" cy="150" r="92" fill="#ffc409"/>
      <circle cx="140" cy="182" r="22" fill="#ff571a"/>
      <circle cx="260" cy="182" r="22" fill="#ff571a"/>
      <circle cx="170" cy="136" r="24" fill="#ffffff"/>
      <circle cx="230" cy="136" r="24" fill="#ffffff"/>
      <circle cx="170" cy="136" r="9" fill="#17191c" stroke="none"/>
      <circle cx="230" cy="136" r="9" fill="#17191c" stroke="none"/>
      <ellipse cx="200" cy="200" rx="16" ry="11" fill="#ffffff"/>`,
  },
  'zipper-mouth-face': {
    label: 'A face with a zipped mouth',
    body: `
      <circle cx="200" cy="150" r="92" fill="#ffc409"/>
      <circle cx="170" cy="130" r="10" fill="#17191c"/>
      <circle cx="230" cy="130" r="10" fill="#17191c"/>
      <path d="M140 194 L246 194" fill="none"/>
      <path d="M160 182 L160 206 M184 182 L184 206 M208 182 L208 206 M232 182 L232 206" fill="none"/>
      <rect x="248" y="182" width="22" height="24" rx="6" fill="#3b6cf6"/>`,
  },
  'astonished-face': {
    label: 'An astonished face',
    body: `
      <circle cx="200" cy="150" r="92" fill="#ffc409"/>
      <circle cx="166" cy="128" r="22" fill="#ffffff"/>
      <circle cx="234" cy="128" r="22" fill="#ffffff"/>
      <circle cx="166" cy="128" r="9" fill="#17191c" stroke="none"/>
      <circle cx="234" cy="128" r="9" fill="#17191c" stroke="none"/>
      <ellipse cx="200" cy="198" rx="28" ry="26" fill="#ffffff"/>`,
  },
  'pleading-face': {
    label: 'A pleading face',
    body: `
      <circle cx="200" cy="150" r="92" fill="#ffc409"/>
      <path d="M148 100 Q172 90 192 102" fill="none"/>
      <path d="M208 102 Q228 90 252 100" fill="none"/>
      <circle cx="168" cy="146" r="26" fill="#ffffff"/>
      <circle cx="232" cy="146" r="26" fill="#ffffff"/>
      <circle cx="168" cy="150" r="12" fill="#17191c" stroke="none"/>
      <circle cx="232" cy="150" r="12" fill="#17191c" stroke="none"/>
      <path d="M178 204 Q200 192 222 204" fill="none"/>`,
  },
  'drooling-face': {
    label: 'A drooling face',
    body: `
      <circle cx="200" cy="150" r="92" fill="#ffc409"/>
      <circle cx="170" cy="132" r="10" fill="#17191c"/>
      <circle cx="230" cy="132" r="10" fill="#17191c"/>
      <path d="M160 186 Q200 214 240 186" fill="none"/>
      <path d="M240 190 C248 208 252 216 252 224 A12 12 0 1 1 228 224 C228 216 232 208 240 190 Z" fill="#3b6cf6"/>`,
  },
  'nauseated-face': {
    label: 'A nauseated face',
    body: `
      <circle cx="200" cy="150" r="92" fill="#009f70"/>
      <path d="M152 134 Q170 120 188 134" fill="none"/>
      <path d="M212 134 Q230 120 248 134" fill="none"/>
      <path d="M164 196 Q182 180 200 196 Q218 212 236 196" fill="none"/>`,
  },
  'face-with-raised-eyebrow': {
    label: 'A face with one eyebrow raised',
    body: `
      <circle cx="200" cy="150" r="92" fill="#ffc409"/>
      <path d="M150 122 L188 122" fill="none"/>
      <path d="M212 96 L250 108" fill="none"/>
      <circle cx="170" cy="148" r="10" fill="#17191c"/>
      <circle cx="230" cy="142" r="10" fill="#17191c"/>
      <path d="M176 198 L222 194" fill="none"/>`,
  },
  'expressionless-face': {
    label: 'An expressionless face',
    body: `
      <circle cx="200" cy="150" r="92" fill="#ffc409"/>
      <path d="M150 136 L190 136" fill="none"/>
      <path d="M210 136 L250 136" fill="none"/>
      <path d="M162 196 L238 196" fill="none"/>`,
  },
  'confused-face': {
    label: 'A confused face',
    body: `
      <circle cx="200" cy="150" r="92" fill="#ffc409"/>
      <circle cx="170" cy="132" r="10" fill="#17191c"/>
      <circle cx="230" cy="132" r="10" fill="#17191c"/>
      <path d="M162 200 Q182 182 202 200 Q222 218 242 200" fill="none"/>`,
  },
  'worried-face': {
    label: 'A worried face',
    body: `
      <circle cx="200" cy="150" r="92" fill="#ffc409"/>
      <path d="M152 114 L186 104" fill="none"/>
      <path d="M214 104 L248 114" fill="none"/>
      <circle cx="170" cy="140" r="10" fill="#17191c"/>
      <circle cx="230" cy="140" r="10" fill="#17191c"/>
      <path d="M166 206 Q200 178 234 206" fill="none"/>`,
  },
  'face-with-thermometer': {
    label: 'A face with a thermometer',
    body: `
      <circle cx="200" cy="150" r="92" fill="#ffc409"/>
      <path d="M152 136 Q170 150 188 136" fill="none"/>
      <path d="M212 136 Q230 150 248 136" fill="none"/>
      <path d="M176 196 L222 196" fill="none"/>
      <rect x="140" y="188" width="150" height="22" rx="11" fill="#ffffff" transform="rotate(-16 215 199)"/>
      <circle cx="292" cy="167" r="16" fill="#e5484d"/>`,
  },
  'face-with-crossed-out-eyes': {
    label: 'A face with crossed-out eyes',
    body: `
      <circle cx="200" cy="150" r="92" fill="#ffc409"/>
      <path d="M152 118 L190 152 M190 118 L152 152" fill="none"/>
      <path d="M210 118 L248 152 M248 118 L210 152" fill="none"/>
      <ellipse cx="200" cy="200" rx="30" ry="22" fill="#ffffff"/>`,
  },
  'sneezing-face': {
    label: 'A sneezing face',
    body: `
      <circle cx="200" cy="150" r="92" fill="#ffc409"/>
      <path d="M150 128 Q170 114 190 128" fill="none"/>
      <path d="M210 128 Q230 114 250 128" fill="none"/>
      <rect x="150" y="176" width="104" height="72" rx="14" fill="#ffffff"/>`,
  },
  'crescent-moon': {
    label: 'A crescent moon',
    body: `
      <path d="M248 58 A96 96 0 1 0 248 242 A76 76 0 1 1 248 58 Z" fill="#ffc409"/>`,
  },
  sun: {
    label: 'The sun',
    body: `
      <path d="M200 46 L200 22" fill="none" stroke="#ff571a"/>
      <path d="M200 254 L200 278" fill="none" stroke="#ff571a"/>
      <path d="M96 150 L72 150" fill="none" stroke="#ff571a"/>
      <path d="M304 150 L328 150" fill="none" stroke="#ff571a"/>
      <path d="M126 76 L109 59" fill="none" stroke="#ff571a"/>
      <path d="M274 224 L291 241" fill="none" stroke="#ff571a"/>
      <path d="M274 76 L291 59" fill="none" stroke="#ff571a"/>
      <path d="M126 224 L109 241" fill="none" stroke="#ff571a"/>
      <circle cx="200" cy="150" r="72" fill="#ffc409"/>`,
  },
  key: {
    label: 'A key',
    body: `
      <circle cx="126" cy="150" r="52" fill="#ffc409"/>
      <circle cx="126" cy="150" r="20" fill="#f4f5f7"/>
      <path d="M178 150 L310 150" fill="none"/>
      <path d="M262 150 L262 194" fill="none"/>
      <path d="M300 150 L300 186" fill="none"/>`,
  },
  train: {
    label: 'A train',
    body: `
      <rect x="96" y="76" width="208" height="150" rx="28" fill="#3b6cf6"/>
      <rect x="126" y="104" width="148" height="56" rx="10" fill="#ffffff"/>
      <circle cx="146" cy="192" r="14" fill="#ffc409"/>
      <circle cx="254" cy="192" r="14" fill="#ffc409"/>
      <path d="M120 226 L104 252" fill="none"/>
      <path d="M280 226 L296 252" fill="none"/>`,
  },
  airplane: {
    label: 'An aeroplane',
    body: `
      <path d="M196 48 A22 22 0 0 1 218 70 L218 132 L322 186 L322 212 L218 184 L218 224 L246 246 L246 262 L200 250 L154 262 L154 246 L182 224 L182 184 L78 212 L78 186 L182 132 L182 70 A22 22 0 0 1 196 48 Z" fill="#3b6cf6"/>`,
  },
  bus: {
    label: 'A bus',
    body: `
      <rect x="82" y="72" width="236" height="150" rx="24" fill="#ffc409"/>
      <rect x="106" y="100" width="88" height="56" rx="8" fill="#3b6cf6"/>
      <rect x="206" y="100" width="88" height="56" rx="8" fill="#3b6cf6"/>
      <circle cx="132" cy="228" r="24" fill="#ffffff"/>
      <circle cx="268" cy="228" r="24" fill="#ffffff"/>`,
  },
  'umbrella-with-rain-drops': {
    label: 'An umbrella in the rain',
    body: `
      <path d="M62 158 A138 138 0 0 1 338 158 Z" fill="#e5484d"/>
      <path d="M200 158 L200 226 A32 32 0 0 0 264 226" fill="none"/>
      <path d="M92 196 L84 228" fill="none" stroke="#3b6cf6"/>
      <path d="M140 210 L132 242" fill="none" stroke="#3b6cf6"/>
      <path d="M306 196 L314 228" fill="none" stroke="#3b6cf6"/>`,
  },
  guitar: {
    label: 'A guitar',
    body: `
      <path d="M256 58 L296 98" fill="none"/>
      <path d="M170 184 L286 68" fill="none" stroke-width="22"/>
      <path d="M170 184 L286 68" fill="none" stroke-width="10"/>
      <circle cx="146" cy="192" r="66" fill="#ff571a"/>
      <circle cx="176" cy="162" r="18" fill="#f4f5f7"/>`,
  },
  'wine-glass': {
    label: 'A glass of wine',
    body: `
      <path d="M132 62 L268 62 L254 132 A56 56 0 0 1 146 132 Z" fill="#e5484d"/>
      <path d="M200 188 L200 240" fill="none"/>
      <path d="M156 244 L244 244" fill="none"/>`,
  },
  'beer-mug': {
    label: 'A mug of beer',
    body: `
      <path d="M256 118 A44 44 0 0 1 256 206" fill="none"/>
      <rect x="112" y="104" width="144" height="140" rx="16" fill="#ffc409"/>
      <path d="M112 132 A28 28 0 0 1 152 108 A32 32 0 0 1 216 104 A28 28 0 0 1 256 132 L256 146 L112 146 Z" fill="#ffffff"/>`,
  },
  'mobile-phone': {
    label: 'A mobile phone',
    body: `
      <rect x="136" y="50" width="128" height="200" rx="22" fill="#17191c"/>
      <rect x="152" y="76" width="96" height="136" rx="8" fill="#ffffff"/>
      <circle cx="200" cy="230" r="9" fill="#ffffff" stroke="none"/>`,
  },
  'musical-note': {
    label: 'A musical note',
    body: `
      <path d="M170 196 L170 76 L286 52 L286 172" fill="none"/>
      <ellipse cx="140" cy="200" rx="34" ry="26" fill="#3b6cf6" transform="rotate(-18 140 200)"/>
      <ellipse cx="256" cy="176" rx="34" ry="26" fill="#3b6cf6" transform="rotate(-18 256 176)"/>`,
  },
  tooth: {
    label: 'A tooth',
    body: `
      <path d="M200 58 A86 86 0 0 1 292 128 C292 176 268 182 260 234 A22 22 0 0 1 218 230 L212 186 A13 13 0 0 0 188 186 L182 230 A22 22 0 0 1 140 234 C132 182 108 176 108 128 A86 86 0 0 1 200 58 Z" fill="#ffffff"/>`,
  },
  'graduation-cap': {
    label: 'A graduation cap',
    body: `
      <path d="M200 76 L340 130 L200 184 L60 130 Z" fill="#17191c"/>
      <path d="M136 154 L136 210 A72 30 0 0 0 264 210 L264 154" fill="none"/>
      <path d="M330 134 L330 214" fill="none"/>
      <circle cx="330" cy="228" r="14" fill="#ffc409"/>`,
  },
  pill: {
    label: 'A pill',
    body: `
      <rect x="78" y="112" width="244" height="76" rx="38" fill="#ffffff" transform="rotate(-28 200 150)"/>
      <path d="M144 216 A38 38 0 0 1 117 151 L200 68 A38 38 0 0 1 254 122 Z" fill="#e5484d"/>`,
  },
  coin: {
    label: 'A coin',
    body: `
      <circle cx="200" cy="150" r="88" fill="#ffc409"/>
      <circle cx="200" cy="150" r="56" fill="none"/>`,
  },
  warning: {
    label: 'A warning sign',
    body: `
      <path d="M200 56 L330 246 L70 246 Z" fill="#ffc409"/>
      <path d="M200 130 L200 186" fill="none"/>
      <circle cx="200" cy="216" r="8" fill="#17191c" stroke="none"/>`,
  },
  'angry-face': {
    label: 'An angry face',
    body: `
      <circle cx="200" cy="150" r="92" fill="#ffc409"/>
      <path d="M152 106 L190 126" fill="none"/>
      <path d="M210 126 L248 106" fill="none"/>
      <circle cx="172" cy="148" r="10" fill="#17191c"/>
      <circle cx="228" cy="148" r="10" fill="#17191c"/>
      <path d="M168 204 Q200 180 232 204" fill="none"/>`,
  },
  'enraged-face': {
    label: 'An enraged face',
    body: `
      <circle cx="200" cy="150" r="92" fill="#e5484d"/>
      <path d="M152 106 L190 126" fill="none"/>
      <path d="M210 126 L248 106" fill="none"/>
      <circle cx="172" cy="148" r="10" fill="#17191c"/>
      <circle cx="228" cy="148" r="10" fill="#17191c"/>
      <path d="M164 214 Q200 176 236 214 Z" fill="#17191c"/>`,
  },
  'beaming-face-with-smiling-eyes': {
    label: 'A beaming face',
    body: `
      <circle cx="200" cy="150" r="92" fill="#ffc409"/>
      <path d="M150 136 Q170 112 190 136" fill="none"/>
      <path d="M210 136 Q230 112 250 136" fill="none"/>
      <path d="M142 178 A62 62 0 0 0 258 178 Z" fill="#ffffff"/>
      <path d="M150 190 L250 190" fill="none"/>`,
  },
  'grinning-face': {
    label: 'A grinning face',
    body: `
      <circle cx="200" cy="150" r="92" fill="#ffc409"/>
      <circle cx="170" cy="128" r="10" fill="#17191c"/>
      <circle cx="230" cy="128" r="10" fill="#17191c"/>
      <path d="M142 172 A62 62 0 0 0 258 172 Z" fill="#ffffff"/>
      <path d="M150 184 L250 184" fill="none"/>`,
  },
  'grinning-face-with-big-eyes': {
    label: 'A grinning face with big eyes',
    body: `
      <circle cx="200" cy="150" r="92" fill="#ffc409"/>
      <circle cx="168" cy="128" r="20" fill="#ffffff"/>
      <circle cx="232" cy="128" r="20" fill="#ffffff"/>
      <circle cx="168" cy="128" r="9" fill="#17191c" stroke="none"/>
      <circle cx="232" cy="128" r="9" fill="#17191c" stroke="none"/>
      <path d="M144 178 A60 60 0 0 0 256 178 Z" fill="#ffffff"/>`,
  },
  'grinning-face-with-smiling-eyes': {
    label: 'A grinning face with smiling eyes',
    body: `
      <circle cx="200" cy="150" r="92" fill="#ffc409"/>
      <path d="M150 134 Q170 114 190 134" fill="none"/>
      <path d="M210 134 Q230 114 250 134" fill="none"/>
      <path d="M144 176 A60 60 0 0 0 256 176 Z" fill="#ffffff"/>`,
  },
  'slightly-smiling-face': {
    label: 'A slightly smiling face',
    body: `
      <circle cx="200" cy="150" r="92" fill="#ffc409"/>
      <circle cx="170" cy="130" r="10" fill="#17191c"/>
      <circle cx="230" cy="130" r="10" fill="#17191c"/>
      <path d="M170 190 Q200 212 230 190" fill="none"/>`,
  },
  'face-savoring-food': {
    label: 'A face savouring food',
    body: `
      <circle cx="200" cy="150" r="92" fill="#ffc409"/>
      <path d="M150 134 Q170 112 190 134" fill="none"/>
      <path d="M210 134 Q230 112 250 134" fill="none"/>
      <path d="M156 176 Q200 206 244 176" fill="none"/>
      <path d="M204 196 A26 26 0 0 0 250 216 L236 184 Z" fill="#e5484d"/>`,
  },
  'face-screaming-in-fear': {
    label: 'A face screaming in fear',
    body: `
      <circle cx="200" cy="150" r="92" fill="#ffc409"/>
      <circle cx="166" cy="124" r="22" fill="#ffffff"/>
      <circle cx="234" cy="124" r="22" fill="#ffffff"/>
      <circle cx="166" cy="124" r="9" fill="#17191c" stroke="none"/>
      <circle cx="234" cy="124" r="9" fill="#17191c" stroke="none"/>
      <ellipse cx="200" cy="198" rx="26" ry="34" fill="#17191c"/>
      <rect x="88" y="120" width="34" height="90" rx="17" fill="#ffc409"/>
      <rect x="278" y="120" width="34" height="90" rx="17" fill="#ffc409"/>`,
  },
  'face-vomiting': {
    label: 'A face vomiting',
    body: `
      <circle cx="200" cy="150" r="92" fill="#ffc409"/>
      <path d="M150 128 Q170 142 190 128" fill="none"/>
      <path d="M210 128 Q230 142 250 128" fill="none"/>
      <path d="M158 182 A46 46 0 0 0 242 182 Z" fill="#17191c"/>
      <path d="M170 212 C176 248 214 262 262 258 L266 218 C226 220 200 212 194 196 Z" fill="#009f70"/>`,
  },
  'face-with-medical-mask': {
    label: 'A face wearing a mask',
    body: `
      <circle cx="200" cy="150" r="92" fill="#ffc409"/>
      <circle cx="170" cy="122" r="10" fill="#17191c"/>
      <circle cx="230" cy="122" r="10" fill="#17191c"/>
      <path d="M112 150 L150 166" fill="none"/>
      <path d="M288 150 L250 166" fill="none"/>
      <rect x="144" y="156" width="112" height="82" rx="20" fill="#ffffff"/>`,
  },
  'face-with-rolling-eyes': {
    label: 'A face rolling its eyes',
    body: `
      <circle cx="200" cy="150" r="92" fill="#ffc409"/>
      <circle cx="168" cy="132" r="22" fill="#ffffff"/>
      <circle cx="232" cy="132" r="22" fill="#ffffff"/>
      <circle cx="168" cy="118" r="9" fill="#17191c" stroke="none"/>
      <circle cx="232" cy="118" r="9" fill="#17191c" stroke="none"/>
      <path d="M166 196 L234 196" fill="none"/>`,
  },
  'face-with-tears-of-joy': {
    label: 'A face laughing with tears',
    body: `
      <circle cx="200" cy="150" r="92" fill="#ffc409"/>
      <path d="M148 136 Q168 112 188 136" fill="none"/>
      <path d="M212 136 Q232 112 252 136" fill="none"/>
      <path d="M144 176 A60 60 0 0 0 256 176 Z" fill="#ffffff"/>
      <path d="M124 146 C112 168 106 178 106 188 A18 18 0 1 0 142 188 C142 178 136 168 124 146 Z" fill="#3b6cf6"/>
      <path d="M276 146 C264 168 258 178 258 188 A18 18 0 1 0 294 188 C294 178 288 168 276 146 Z" fill="#3b6cf6"/>`,
  },
  'hot-face': {
    label: 'A face feeling hot',
    body: `
      <circle cx="200" cy="150" r="92" fill="#e5484d"/>
      <path d="M152 134 L190 134" fill="none"/>
      <path d="M210 134 L248 134" fill="none"/>
      <path d="M170 186 Q200 202 230 186" fill="none"/>
      <path d="M186 198 A22 22 0 0 0 226 216 L214 188 Z" fill="#ffc409"/>`,
  },
  'money-mouth-face': {
    label: 'A face with money in its mouth',
    body: `
      <circle cx="200" cy="150" r="92" fill="#ffc409"/>
      <path d="M170 106 L170 154 M158 118 Q182 124 158 142" fill="none" stroke="#009f70"/>
      <path d="M230 106 L230 154 M218 118 Q242 124 218 142" fill="none" stroke="#009f70"/>
      <rect x="130" y="186" width="140" height="66" rx="8" fill="#009f70" transform="rotate(-8 200 219)"/>
      <circle cx="200" cy="216" r="18" fill="#ffffff" transform="rotate(-8 200 219)"/>`,
  },
  'sleepy-face': {
    label: 'A sleepy face',
    body: `
      <circle cx="200" cy="150" r="92" fill="#ffc409"/>
      <path d="M152 134 Q170 148 188 134" fill="none"/>
      <path d="M212 134 Q230 148 248 134" fill="none"/>
      <path d="M176 200 L224 200" fill="none"/>
      <circle cx="268" cy="182" r="30" fill="#3b6cf6"/>`,
  },
  'unamused-face': {
    label: 'An unamused face',
    body: `
      <circle cx="200" cy="150" r="92" fill="#ffc409"/>
      <path d="M150 116 L190 126" fill="none"/>
      <path d="M210 126 L250 116" fill="none"/>
      <circle cx="180" cy="146" r="10" fill="#17191c"/>
      <circle cx="238" cy="146" r="10" fill="#17191c"/>
      <path d="M168 198 L232 190" fill="none"/>`,
  },
  'weary-face': {
    label: 'A weary face',
    body: `
      <circle cx="200" cy="150" r="92" fill="#ffc409"/>
      <path d="M150 148 Q170 122 190 148" fill="none"/>
      <path d="M210 148 Q230 122 250 148" fill="none"/>
      <path d="M160 216 A44 44 0 0 1 240 216 Z" fill="#17191c"/>`,
  },
  'winking-face-with-tongue': {
    label: 'A winking face with its tongue out',
    body: `
      <circle cx="200" cy="150" r="92" fill="#ffc409"/>
      <path d="M150 136 Q170 112 190 136" fill="none"/>
      <circle cx="230" cy="128" r="10" fill="#17191c"/>
      <path d="M156 176 Q200 206 244 176" fill="none"/>
      <path d="M180 196 A26 26 0 0 0 226 216 L214 184 Z" fill="#e5484d"/>`,
  },
  'smiling-face-with-open-hands': {
    label: 'A smiling face with open hands',
    body: `
      <rect x="66" y="152" width="46" height="86" rx="23" fill="#ffc409" transform="rotate(-24 89 195)"/>
      <rect x="288" y="152" width="46" height="86" rx="23" fill="#ffc409" transform="rotate(24 311 195)"/>
      <circle cx="200" cy="146" r="86" fill="#ffc409"/>
      <path d="M154 132 Q172 110 190 132" fill="none"/>
      <path d="M210 132 Q228 110 246 132" fill="none"/>
      <path d="M166 176 Q200 206 234 176" fill="none"/>`,
  },
  'see-no-evil-monkey': {
    label: 'A monkey covering its eyes',
    body: `
      <circle cx="108" cy="150" r="36" fill="#ff571a"/>
      <circle cx="292" cy="150" r="36" fill="#ff571a"/>
      <circle cx="200" cy="152" r="84" fill="#ff571a"/>
      <path d="M144 186 A58 44 0 0 0 256 186 Z" fill="#ffc409"/>
      <circle cx="184" cy="196" r="7" fill="#17191c" stroke="none"/>
      <circle cx="216" cy="196" r="7" fill="#17191c" stroke="none"/>
      <rect x="104" y="104" width="94" height="48" rx="24" fill="#ffc409"/>
      <rect x="202" y="104" width="94" height="48" rx="24" fill="#ffc409"/>`,
  },
  'mouse-face': {
    label: 'A mouse',
    body: `
      <circle cx="124" cy="92" r="42" fill="#ffffff"/>
      <circle cx="276" cy="92" r="42" fill="#ffffff"/>
      <circle cx="200" cy="164" r="78" fill="#f4f5f7" stroke="#17191c"/>
      <circle cx="176" cy="150" r="9" fill="#17191c"/>
      <circle cx="224" cy="150" r="9" fill="#17191c"/>
      <ellipse cx="200" cy="188" rx="14" ry="10" fill="#ff571a"/>
      <path d="M150 196 L112 190 M150 210 L114 218" fill="none"/>
      <path d="M250 196 L288 190 M250 210 L286 218" fill="none"/>`,
  },
  'person-bowing': {
    label: 'A person bowing',
    body: `
      <rect x="212" y="188" width="24" height="60" rx="12" fill="#3b6cf6"/>
      <rect x="248" y="188" width="24" height="60" rx="12" fill="#3b6cf6"/>
      <rect x="146" y="180" width="22" height="66" rx="11" fill="#ffc409"/>
      <rect x="120" y="126" width="152" height="66" rx="31" fill="#3b6cf6"/>
      <circle cx="108" cy="160" r="34" fill="#ffc409"/>`,
  },
  person: {
    label: 'A person',
    body: `
      <rect x="140" y="130" width="24" height="76" rx="12" fill="#ffc409"/>
      <rect x="236" y="130" width="24" height="76" rx="12" fill="#ffc409"/>
      <rect x="170" y="192" width="24" height="56" rx="12" fill="#3b6cf6"/>
      <rect x="206" y="192" width="24" height="56" rx="12" fill="#3b6cf6"/>
      <rect x="168" y="122" width="64" height="86" rx="28" fill="#3b6cf6"/>
      <circle cx="200" cy="80" r="32" fill="#ffc409"/>`,
  },
  man: {
    label: 'A man',
    body: `
      <rect x="140" y="130" width="24" height="76" rx="12" fill="#ffc409"/>
      <rect x="236" y="130" width="24" height="76" rx="12" fill="#ffc409"/>
      <rect x="170" y="192" width="24" height="56" rx="12" fill="#3b6cf6"/>
      <rect x="206" y="192" width="24" height="56" rx="12" fill="#3b6cf6"/>
      <rect x="168" y="122" width="64" height="86" rx="28" fill="#3b6cf6"/>
      <circle cx="200" cy="80" r="32" fill="#ffc409"/>
      <path d="M166 82 A34 34 0 0 1 234 82 Z" fill="#17191c"/>`,
  },
  woman: {
    label: 'A woman',
    body: `
      <rect x="140" y="130" width="24" height="76" rx="12" fill="#ffc409"/>
      <rect x="236" y="130" width="24" height="76" rx="12" fill="#ffc409"/>
      <rect x="170" y="192" width="24" height="56" rx="12" fill="#ff571a"/>
      <rect x="206" y="192" width="24" height="56" rx="12" fill="#ff571a"/>
      <path d="M200 122 L250 214 L150 214 Z" fill="#ff571a"/>
      <circle cx="200" cy="80" r="32" fill="#ffc409"/>
      <path d="M166 82 A34 34 0 0 1 234 82 Z" fill="#17191c"/>`,
  },
  'person-beard': {
    label: 'A person with a beard',
    body: `
      <rect x="140" y="130" width="24" height="76" rx="12" fill="#ffc409"/>
      <rect x="236" y="130" width="24" height="76" rx="12" fill="#ffc409"/>
      <rect x="170" y="192" width="24" height="56" rx="12" fill="#009f70"/>
      <rect x="206" y="192" width="24" height="56" rx="12" fill="#009f70"/>
      <rect x="168" y="122" width="64" height="86" rx="28" fill="#009f70"/>
      <circle cx="200" cy="80" r="32" fill="#ffc409"/>
      <path d="M168 78 A32 32 0 0 0 232 78 C232 112 218 132 200 132 C182 132 168 112 168 78 Z" fill="#17191c"/>
      <circle cx="186" cy="74" r="6" fill="#17191c" stroke="none"/>
      <circle cx="214" cy="74" r="6" fill="#17191c" stroke="none"/>`,
  },
  'pregnant-woman': {
    label: 'A pregnant woman',
    body: `
      <rect x="140" y="130" width="24" height="76" rx="12" fill="#ffc409"/>
      <rect x="236" y="130" width="24" height="76" rx="12" fill="#ffc409"/>
      <rect x="170" y="192" width="24" height="56" rx="12" fill="#ff571a"/>
      <rect x="206" y="192" width="24" height="56" rx="12" fill="#ff571a"/>
      <rect x="168" y="122" width="64" height="86" rx="28" fill="#ff571a"/>
      <circle cx="200" cy="80" r="32" fill="#ffc409"/>
      <path d="M166 82 A34 34 0 0 1 234 82 Z" fill="#17191c"/>
      <circle cx="236" cy="160" r="40" fill="#ff571a"/>`,
  },
  'police-officer': {
    label: 'A police officer',
    body: `
      <rect x="140" y="138" width="24" height="76" rx="12" fill="#ffc409"/>
      <rect x="236" y="138" width="24" height="76" rx="12" fill="#ffc409"/>
      <rect x="170" y="200" width="24" height="56" rx="12" fill="#3b6cf6"/>
      <rect x="206" y="200" width="24" height="56" rx="12" fill="#3b6cf6"/>
      <rect x="168" y="130" width="64" height="86" rx="28" fill="#3b6cf6"/>
      <circle cx="200" cy="88" r="32" fill="#ffc409"/>
      <path d="M156 78 L244 78 L244 62 A44 22 0 0 0 156 62 Z" fill="#17191c"/>
      <path d="M150 78 L250 78" fill="none"/>`,
  },
  superhero: {
    label: 'A superhero',
    body: `
      <path d="M168 122 L100 232 L232 232 Z" fill="#e5484d"/>
      <rect x="140" y="130" width="24" height="76" rx="12" fill="#ffc409"/>
      <rect x="236" y="130" width="24" height="76" rx="12" fill="#ffc409"/>
      <rect x="170" y="192" width="24" height="56" rx="12" fill="#3b6cf6"/>
      <rect x="206" y="192" width="24" height="56" rx="12" fill="#3b6cf6"/>
      <rect x="168" y="122" width="64" height="86" rx="28" fill="#3b6cf6"/>
      <circle cx="200" cy="80" r="32" fill="#ffc409"/>
      <path d="M182 146 L218 146 L200 182 Z" fill="#ffc409"/>`,
  },
  detective: {
    label: 'A detective',
    body: `
      <rect x="140" y="144" width="24" height="76" rx="12" fill="#ffc409"/>
      <rect x="236" y="144" width="24" height="76" rx="12" fill="#ffc409"/>
      <rect x="170" y="206" width="24" height="56" rx="12" fill="#17191c"/>
      <rect x="206" y="206" width="24" height="56" rx="12" fill="#17191c"/>
      <rect x="168" y="136" width="64" height="86" rx="28" fill="#17191c"/>
      <circle cx="200" cy="94" r="32" fill="#ffc409"/>
      <rect x="152" y="70" width="96" height="30" rx="8" fill="#009f70"/>
      <path d="M126 100 L274 100" fill="none"/>`,
  },
  'person-cartwheeling': {
    label: 'A person cartwheeling',
    body: `
      <g transform="rotate(64 200 150)">
      <rect x="143.6" y="127.1" width="22.6" height="71.4" rx="11.3" fill="#ffc409"/>
      <rect x="233.8" y="127.1" width="22.6" height="71.4" rx="11.3" fill="#ffc409"/>
      <rect x="171.8" y="185.4" width="22.6" height="52.6" rx="11.3" fill="#009f70"/>
      <rect x="205.6" y="185.4" width="22.6" height="52.6" rx="11.3" fill="#009f70"/>
      <rect x="169.9" y="119.6" width="60.2" height="80.8" rx="26.3" fill="#009f70"/>
      <circle cx="200" cy="80.1" r="30.1" fill="#ffc409"/>
      </g>`,
  },
  'person-in-lotus-position': {
    label: 'A person sitting cross-legged',
    body: `
      <path d="M104 226 A96 42 0 0 1 296 226 Z" fill="#3b6cf6"/>
      <rect x="128" y="150" width="24" height="76" rx="12" fill="#ffc409" transform="rotate(18 140 188)"/>
      <rect x="248" y="150" width="24" height="76" rx="12" fill="#ffc409" transform="rotate(-18 260 188)"/>
      <rect x="168" y="104" width="64" height="86" rx="28" fill="#3b6cf6"/>
      <circle cx="200" cy="72" r="32" fill="#ffc409"/>`,
  },
  'person-getting-haircut': {
    label: 'A person getting a haircut',
    body: `
      <rect x="151.8" y="195.4" width="22.6" height="52.6" rx="11.3" fill="#3b6cf6"/>
      <rect x="185.6" y="195.4" width="22.6" height="52.6" rx="11.3" fill="#3b6cf6"/>
      <rect x="149.9" y="129.6" width="60.2" height="80.8" rx="26.3" fill="#3b6cf6"/>
      <circle cx="180" cy="90.1" r="30.1" fill="#ffc409"/>
      <circle cx="290" cy="84" r="16" fill="#f4f5f7"/>
      <circle cx="290" cy="126" r="16" fill="#f4f5f7"/>
      <path d="M284 96 L226 128 M284 116 L226 90" fill="none"/>`,
  },
  'woman-dancing': {
    label: 'A woman dancing',
    body: `
      <rect x="252" y="66" width="24" height="80" rx="12" fill="#ffc409" transform="rotate(38 264 106)"/>
      <rect x="118" y="120" width="24" height="76" rx="12" fill="#ffc409" transform="rotate(-42 130 158)"/>
      <rect x="176" y="192" width="24" height="56" rx="12" fill="#e5484d" transform="rotate(22 188 220)"/>
      <path d="M200 114 L252 200 L148 200 Z" fill="#e5484d"/>
      <circle cx="200" cy="82" r="32" fill="#ffc409"/>
      <path d="M166 84 A34 34 0 0 1 234 84 Z" fill="#17191c"/>`,
  },
  'men-holding-hands': {
    label: 'Two men holding hands',
    body: `
      <rect x="74" y="125.6" width="19.2" height="60.8" rx="9.6" fill="#ffc409"/>
      <rect x="150.8" y="125.6" width="19.2" height="60.8" rx="9.6" fill="#ffc409"/>
      <rect x="98" y="175.2" width="19.2" height="44.8" rx="9.6" fill="#3b6cf6"/>
      <rect x="126.8" y="175.2" width="19.2" height="44.8" rx="9.6" fill="#3b6cf6"/>
      <rect x="96.4" y="119.2" width="51.2" height="68.8" rx="22.4" fill="#3b6cf6"/>
      <circle cx="122" cy="85.6" r="25.6" fill="#ffc409"/>
      <path d="M94.8 87.2 A27.2 27.2 0 0 1 149.2 87.2 Z" fill="#17191c"/>
      <rect x="230" y="125.6" width="19.2" height="60.8" rx="9.6" fill="#ffc409"/>
      <rect x="306.8" y="125.6" width="19.2" height="60.8" rx="9.6" fill="#ffc409"/>
      <rect x="254" y="175.2" width="19.2" height="44.8" rx="9.6" fill="#009f70"/>
      <rect x="282.8" y="175.2" width="19.2" height="44.8" rx="9.6" fill="#009f70"/>
      <rect x="252.4" y="119.2" width="51.2" height="68.8" rx="22.4" fill="#009f70"/>
      <circle cx="278" cy="85.6" r="25.6" fill="#ffc409"/>
      <path d="M250.8 87.2 A27.2 27.2 0 0 1 305.2 87.2 Z" fill="#17191c"/>
      <rect x="164" y="122" width="72" height="24" rx="12" fill="#ffc409"/>`,
  },
  'women-holding-hands': {
    label: 'Two women holding hands',
    body: `
      <rect x="74" y="125.6" width="19.2" height="60.8" rx="9.6" fill="#ffc409"/>
      <rect x="150.8" y="125.6" width="19.2" height="60.8" rx="9.6" fill="#ffc409"/>
      <rect x="98" y="175.2" width="19.2" height="44.8" rx="9.6" fill="#e5484d"/>
      <rect x="126.8" y="175.2" width="19.2" height="44.8" rx="9.6" fill="#e5484d"/>
      <path d="M122 119.2 L162 192.8 L82 192.8 Z" fill="#e5484d"/>
      <circle cx="122" cy="85.6" r="25.6" fill="#ffc409"/>
      <path d="M94.8 87.2 A27.2 27.2 0 0 1 149.2 87.2 Z" fill="#17191c"/>
      <rect x="230" y="125.6" width="19.2" height="60.8" rx="9.6" fill="#ffc409"/>
      <rect x="306.8" y="125.6" width="19.2" height="60.8" rx="9.6" fill="#ffc409"/>
      <rect x="254" y="175.2" width="19.2" height="44.8" rx="9.6" fill="#ff571a"/>
      <rect x="282.8" y="175.2" width="19.2" height="44.8" rx="9.6" fill="#ff571a"/>
      <path d="M278 119.2 L318 192.8 L238 192.8 Z" fill="#ff571a"/>
      <circle cx="278" cy="85.6" r="25.6" fill="#ffc409"/>
      <path d="M250.8 87.2 A27.2 27.2 0 0 1 305.2 87.2 Z" fill="#17191c"/>
      <rect x="164" y="122" width="72" height="24" rx="12" fill="#ffc409"/>`,
  },
  'woman-and-man-holding-hands': {
    label: 'A woman and a man holding hands',
    body: `
      <rect x="74" y="125.6" width="19.2" height="60.8" rx="9.6" fill="#ffc409"/>
      <rect x="150.8" y="125.6" width="19.2" height="60.8" rx="9.6" fill="#ffc409"/>
      <rect x="98" y="175.2" width="19.2" height="44.8" rx="9.6" fill="#e5484d"/>
      <rect x="126.8" y="175.2" width="19.2" height="44.8" rx="9.6" fill="#e5484d"/>
      <path d="M122 119.2 L162 192.8 L82 192.8 Z" fill="#e5484d"/>
      <circle cx="122" cy="85.6" r="25.6" fill="#ffc409"/>
      <path d="M94.8 87.2 A27.2 27.2 0 0 1 149.2 87.2 Z" fill="#17191c"/>
      <rect x="230" y="125.6" width="19.2" height="60.8" rx="9.6" fill="#ffc409"/>
      <rect x="306.8" y="125.6" width="19.2" height="60.8" rx="9.6" fill="#ffc409"/>
      <rect x="254" y="175.2" width="19.2" height="44.8" rx="9.6" fill="#3b6cf6"/>
      <rect x="282.8" y="175.2" width="19.2" height="44.8" rx="9.6" fill="#3b6cf6"/>
      <rect x="252.4" y="119.2" width="51.2" height="68.8" rx="22.4" fill="#3b6cf6"/>
      <circle cx="278" cy="85.6" r="25.6" fill="#ffc409"/>
      <path d="M250.8 87.2 A27.2 27.2 0 0 1 305.2 87.2 Z" fill="#17191c"/>
      <rect x="164" y="122" width="72" height="24" rx="12" fill="#ffc409"/>`,
  },
  'people-hugging': {
    label: 'Two people hugging',
    body: `
      <path d="M84 244 A62 62 0 0 1 208 244 Z" fill="#3b6cf6"/>
      <circle cx="146" cy="106" r="40" fill="#ffc409"/>
      <path d="M192 244 A62 62 0 0 1 316 244 Z" fill="#ff571a"/>
      <circle cx="254" cy="106" r="40" fill="#ffc409"/>
      <rect x="128" y="158" width="144" height="26" rx="13" fill="#ffc409"/>`,
  },
  family: {
    label: 'A family',
    body: `
      <path d="M56.2 244 A55.8 55.8 0 0 1 167.8 244 Z" fill="#3b6cf6"/>
      <circle cx="112" cy="112" r="36" fill="#ffc409"/>
      <path d="M232.2 244 A55.8 55.8 0 0 1 343.8 244 Z" fill="#e5484d"/>
      <circle cx="288" cy="112" r="36" fill="#ffc409"/>
      <path d="M156.6 244 A43.4 43.4 0 0 1 243.4 244 Z" fill="#009f70"/>
      <circle cx="200" cy="140" r="28" fill="#ffc409"/>`,
  },
  'family-man-boy': {
    label: 'A man and a boy',
    body: `
      <path d="M88 244 A62 62 0 0 1 212 244 Z" fill="#3b6cf6"/>
      <circle cx="150" cy="104" r="40" fill="#ffc409"/>
      <path d="M228.6 244 A43.4 43.4 0 0 1 315.4 244 Z" fill="#009f70"/>
      <circle cx="272" cy="148" r="28" fill="#ffc409"/>`,
  },
  'family-man-woman-boy': {
    label: 'A man, a woman and a boy',
    body: `
      <path d="M56.2 244 A55.8 55.8 0 0 1 167.8 244 Z" fill="#3b6cf6"/>
      <circle cx="112" cy="112" r="36" fill="#ffc409"/>
      <path d="M232.2 244 A55.8 55.8 0 0 1 343.8 244 Z" fill="#e5484d"/>
      <circle cx="288" cy="112" r="36" fill="#ffc409"/>
      <path d="M159.7 244 A40.3 40.3 0 0 1 240.3 244 Z" fill="#009f70"/>
      <circle cx="200" cy="146" r="26" fill="#ffc409"/>`,
  },
  'family-man-woman-girl': {
    label: 'A man, a woman and a girl',
    body: `
      <path d="M56.2 244 A55.8 55.8 0 0 1 167.8 244 Z" fill="#3b6cf6"/>
      <circle cx="112" cy="112" r="36" fill="#ffc409"/>
      <path d="M232.2 244 A55.8 55.8 0 0 1 343.8 244 Z" fill="#e5484d"/>
      <circle cx="288" cy="112" r="36" fill="#ffc409"/>
      <path d="M159.7 244 A40.3 40.3 0 0 1 240.3 244 Z" fill="#ff571a"/>
      <circle cx="200" cy="146" r="26" fill="#ffc409"/>`,
  },
  wedding: {
    label: 'A wedding',
    body: `
      <rect x="74" y="125.6" width="19.2" height="60.8" rx="9.6" fill="#ffc409"/>
      <rect x="150.8" y="125.6" width="19.2" height="60.8" rx="9.6" fill="#ffc409"/>
      <rect x="98" y="175.2" width="19.2" height="44.8" rx="9.6" fill="#17191c"/>
      <rect x="126.8" y="175.2" width="19.2" height="44.8" rx="9.6" fill="#17191c"/>
      <rect x="96.4" y="119.2" width="51.2" height="68.8" rx="22.4" fill="#17191c"/>
      <circle cx="122" cy="85.6" r="25.6" fill="#ffc409"/>
      <rect x="230" y="125.6" width="19.2" height="60.8" rx="9.6" fill="#ffc409"/>
      <rect x="306.8" y="125.6" width="19.2" height="60.8" rx="9.6" fill="#ffc409"/>
      <rect x="254" y="175.2" width="19.2" height="44.8" rx="9.6" fill="#ffffff"/>
      <rect x="282.8" y="175.2" width="19.2" height="44.8" rx="9.6" fill="#ffffff"/>
      <path d="M278 119.2 L318 192.8 L238 192.8 Z" fill="#ffffff"/>
      <circle cx="278" cy="85.6" r="25.6" fill="#ffc409"/>
      <rect x="164" y="122" width="72" height="24" rx="12" fill="#ffc409"/>
      <path d="M262 62 L294 62" fill="none"/>`,
  },
  'red-question-mark': {
    label: 'A question mark',
    body: `
      <text x="200" y="158" font-family="Helvetica,Arial,sans-serif" font-weight="bold" font-size="230" fill="#e5484d" text-anchor="middle" dominant-baseline="central" stroke="#17191c" stroke-width="8">?</text>`,
  },
  'sos-button': {
    label: 'An SOS button',
    body: `
      <rect x="72" y="86" width="256" height="128" rx="24" fill="#e5484d"/>
      <text x="200" y="152" font-family="Helvetica,Arial,sans-serif" font-weight="bold" font-size="76" fill="#ffffff" text-anchor="middle" dominant-baseline="central" stroke="none">SOS</text>`,
  },
  'new-button': {
    label: 'A new button',
    body: `
      <rect x="72" y="86" width="256" height="128" rx="24" fill="#3b6cf6"/>
      <text x="200" y="152" font-family="Helvetica,Arial,sans-serif" font-weight="bold" font-size="76" fill="#ffffff" text-anchor="middle" dominant-baseline="central" stroke="none">NEW</text>`,
  },
  'free-button': {
    label: 'A free button',
    body: `
      <rect x="72" y="86" width="256" height="128" rx="24" fill="#3b6cf6"/>
      <text x="200" y="152" font-family="Helvetica,Arial,sans-serif" font-weight="bold" font-size="64" fill="#ffffff" text-anchor="middle" dominant-baseline="central" stroke="none">FREE</text>`,
  },
  'ok-button': {
    label: 'An OK button',
    body: `
      <rect x="72" y="86" width="256" height="128" rx="24" fill="#009f70"/>
      <text x="200" y="152" font-family="Helvetica,Arial,sans-serif" font-weight="bold" font-size="76" fill="#ffffff" text-anchor="middle" dominant-baseline="central" stroke="none">OK</text>`,
  },
  'p-button': {
    label: 'A parking button',
    body: `
      <rect x="72" y="86" width="256" height="128" rx="24" fill="#3b6cf6"/>
      <text x="200" y="152" font-family="Helvetica,Arial,sans-serif" font-weight="bold" font-size="96" fill="#ffffff" text-anchor="middle" dominant-baseline="central" stroke="none">P</text>`,
  },
  'input-latin-letters': {
    label: 'Latin letters',
    body: `
      <rect x="72" y="86" width="256" height="128" rx="24" fill="#3b6cf6"/>
      <text x="200" y="152" font-family="Helvetica,Arial,sans-serif" font-weight="bold" font-size="76" fill="#ffffff" text-anchor="middle" dominant-baseline="central" stroke="none">abc</text>`,
  },
  'input-numbers': {
    label: 'Numbers',
    body: `
      <rect x="72" y="86" width="256" height="128" rx="24" fill="#ff571a"/>
      <text x="200" y="152" font-family="Helvetica,Arial,sans-serif" font-weight="bold" font-size="60" fill="#ffffff" text-anchor="middle" dominant-baseline="central" stroke="none">1234</text>`,
  },
  'hundred-points': {
    label: 'A hundred points',
    body: `
      <text x="200" y="134" font-family="Helvetica,Arial,sans-serif" font-weight="bold" font-size="112" fill="#e5484d" text-anchor="middle" dominant-baseline="central" stroke="none">100</text>
      <path d="M120 194 L280 194" fill="none" stroke="#e5484d"/>
      <path d="M120 222 L280 222" fill="none" stroke="#e5484d"/>`,
  },
  'heavy-dollar-sign': {
    label: 'A dollar sign',
    body: `
      <text x="200" y="150" font-family="Helvetica,Arial,sans-serif" font-weight="bold" font-size="210" fill="#009f70" text-anchor="middle" dominant-baseline="central" stroke="#17191c" stroke-width="8">$</text>`,
  },
  'check-mark-button': {
    label: 'A check mark button',
    body: `
      <rect x="76" y="62" width="248" height="176" rx="28" fill="#009f70"/>
      <path d="M134 152 L180 198 L268 104" fill="none" stroke="#ffffff" stroke-width="26"/>`,
  },
  'check-mark': {
    label: 'A check mark',
    body: `
      <path d="M92 156 L162 226 L308 78" fill="none" stroke="#009f70" stroke-width="34"/>`,
  },
  'cross-mark': {
    label: 'A cross mark',
    body: `
      <path d="M100 50 L300 250 M300 50 L100 250" fill="none" stroke="#e5484d" stroke-width="40"/>`,
  },
  plus: {
    label: 'A plus sign',
    body: `
      <path d="M200 60 L200 240 M110 150 L290 150" fill="none" stroke-width="34"/>`,
  },
  divide: {
    label: 'A division sign',
    body: `
      <circle cx="200" cy="88" r="17" fill="#17191c"/>
      <path d="M110 150 L290 150" fill="none" stroke-width="30"/>
      <circle cx="200" cy="212" r="17" fill="#17191c"/>`,
  },
  infinity: {
    label: 'An infinity sign',
    body: `
      <path d="M200 150 C172 106 144 106 128 122 A40 40 0 0 0 128 178 C144 194 172 194 200 150 C228 106 256 106 272 122 A40 40 0 0 1 272 178 C256 194 228 194 200 150 Z" fill="none" stroke-width="24"/>`,
  },
  'right-arrow': {
    label: 'An arrow pointing right',
    body: `
      <path d="M88 150 L264 150" fill="none" stroke="#3b6cf6"/>
      <path d="M312 150 L259.3 178.8 L259.3 121.2 Z" fill="#3b6cf6"/>`,
  },
  'left-arrow': {
    label: 'An arrow pointing left',
    body: `
      <path d="M312 150 L136 150" fill="none" stroke="#3b6cf6"/>
      <path d="M88 150 L140.7 121.2 L140.7 178.8 Z" fill="#3b6cf6"/>`,
  },
  'back-arrow': {
    label: 'An arrow pointing back',
    body: `
      <path d="M300 150 L144 150" fill="none" stroke="#ff571a"/>
      <path d="M96 150 L148.7 121.2 L148.7 178.8 Z" fill="#ff571a"/>`,
  },
  'left-right-arrow': {
    label: 'An arrow pointing both ways',
    body: `
      <path d="M200 150 L278.4 150" fill="none" stroke="#3b6cf6"/>
      <path d="M320 150 L274.4 174.9 L274.4 125.1 Z" fill="#3b6cf6"/>
      <path d="M200 150 L121.6 150" fill="none" stroke="#3b6cf6"/>
      <path d="M80 150 L125.6 125.1 L125.6 174.9 Z" fill="#3b6cf6"/>`,
  },
  'left-arrow-curving-right': {
    label: 'An arrow curving right',
    body: `
      <path d="M96 214 A96 96 0 0 1 272 156" fill="none" stroke="#3b6cf6"/>
      <path d="M272 156 L278.3 178.2" fill="none" stroke="#3b6cf6"/>
      <path d="M288 212 L257.1 180.7 L297.7 169.1 Z" fill="#3b6cf6"/>`,
  },
  'right-arrow-curving-left': {
    label: 'An arrow curving left',
    body: `
      <path d="M304 214 A96 96 0 0 0 128 156" fill="none" stroke="#3b6cf6"/>
      <path d="M128 156 L121.7 178.2" fill="none" stroke="#3b6cf6"/>
      <path d="M112 212 L102.3 169.1 L142.9 180.7 Z" fill="#3b6cf6"/>`,
  },
  'counterclockwise-arrows-button': {
    label: 'Two arrows going round',
    body: `
      <path d="M273.3 123.3 A78 78 0 0 0 126.7 176.7" fill="none" stroke="#009f70"/>
      <path d="M134.2 197.4 L109.8 182.9 L143.6 170.5 Z" fill="#009f70"/>
      <path d="M126.7 176.7 A78 78 0 0 0 273.3 176.7" fill="none" stroke="#009f70"/>
      <path d="M280.8 156 L290.2 182.9 L256.4 170.5 Z" fill="#009f70"/>`,
  },
  'repeat-button': {
    label: 'A repeat button',
    body: `
      <path d="M126 179 A78 78 0 0 1 267 122" fill="none" stroke="#009f70"/>
      <path d="M284 145 L252 116 L286 102 Z" fill="#009f70"/>
      <path d="M274 121 A78 78 0 0 1 133 178" fill="none" stroke="#009f70"/>
      <path d="M116 155 L148 184 L114 198 Z" fill="#009f70"/>`,
  },
  'fast-forward-button': {
    label: 'A fast forward button',
    body: `
      <path d="M92 76 L202 150 L92 224 Z" fill="#3b6cf6"/>
      <path d="M198 76 L308 150 L198 224 Z" fill="#3b6cf6"/>`,
  },
  'shuffle-tracks-button': {
    label: 'A shuffle button',
    body: `
      <path d="M84 106 L146 106 Q200 106 254 194 Q276 230 312 230" fill="none" stroke="#3b6cf6"/>
      <path d="M84 230 L146 230 Q200 230 254 106 Q276 70 312 70" fill="none" stroke="#3b6cf6"/>
      <path d="M312 230 L272 210 L272 250 Z" fill="#3b6cf6"/>
      <path d="M312 70 L272 50 L272 90 Z" fill="#3b6cf6"/>`,
  },
  'no-entry': {
    label: 'A no entry sign',
    body: `
      <circle cx="200" cy="150" r="92" fill="#e5484d"/>
      <rect x="132" y="130" width="136" height="40" rx="8" fill="#ffffff"/>`,
  },
  'no-smoking': {
    label: 'A no smoking sign',
    body: `
      <rect x="116" y="138" width="140" height="28" rx="8" fill="#ffffff"/>
      <rect x="262" y="138" width="22" height="28" rx="6" fill="#ff571a"/>
      <circle cx="200" cy="150" r="92" fill="none" stroke="#e5484d" stroke-width="24"/>
      <path d="M135 85 L265 215" fill="none" stroke="#e5484d" stroke-width="24"/>`,
  },
  'no-pedestrians': {
    label: 'A no pedestrians sign',
    body: `
      <rect x="186" y="176" width="20" height="46" rx="10" fill="#17191c"/>
      <rect x="212" y="176" width="20" height="46" rx="10" fill="#17191c"/>
      <rect x="182" y="118" width="54" height="72" rx="24" fill="#17191c"/>
      <circle cx="209" cy="92" r="26" fill="#17191c"/>
      <circle cx="200" cy="150" r="92" fill="none" stroke="#e5484d" stroke-width="24"/>
      <path d="M135 85 L265 215" fill="none" stroke="#e5484d" stroke-width="24"/>`,
  },
  'potable-water': {
    label: 'Drinking water',
    body: `
      <rect x="84" y="62" width="232" height="176" rx="26" fill="#3b6cf6"/>
      <path d="M200 96 C238 144 254 160 254 182 A54 54 0 0 1 146 182 C146 160 162 144 200 96 Z" fill="#ffffff"/>`,
  },
  'non-potable-water': {
    label: 'Not drinking water',
    body: `
      <path d="M200 76 C244 132 262 150 262 176 A62 62 0 0 1 138 176 C138 150 156 132 200 76 Z" fill="#3b6cf6"/>
      <circle cx="200" cy="150" r="92" fill="none" stroke="#e5484d" stroke-width="24"/>
      <path d="M135 85 L265 215" fill="none" stroke="#e5484d" stroke-width="24"/>`,
  },
  'recycling-symbol': {
    label: 'A recycling symbol',
    body: `
      <path d="M200 62 L252 152 L200 152 L148 152 Z" fill="#009f70"/>
      <path d="M118 236 L156 152 L192 214 L118 214 Z" fill="#009f70"/>
      <path d="M282 236 L244 152 L208 214 L282 214 Z" fill="#009f70"/>`,
  },
  'peace-symbol': {
    label: 'A peace symbol',
    body: `
      <circle cx="200" cy="150" r="90" fill="none" stroke-width="20"/>
      <path d="M200 60 L200 240 M200 150 L136 214 M200 150 L264 214" fill="none" stroke-width="20"/>`,
  },
  'latin-cross': {
    label: 'A cross',
    body: `
      <path d="M176 52 L224 52 L224 116 L296 116 L296 164 L224 164 L224 248 L176 248 L176 164 L104 164 L104 116 L176 116 Z" fill="#ffffff"/>`,
  },
  'wheelchair-symbol': {
    label: 'A wheelchair symbol',
    body: `
      <rect x="76" y="50" width="248" height="200" rx="26" fill="#3b6cf6"/>
      <circle cx="196" cy="182" r="52" fill="none" stroke="#ffffff" stroke-width="16"/>
      <circle cx="176" cy="92" r="20" fill="#ffffff" stroke="none"/>
      <path d="M176 122 L176 166 L246 166 L268 218" fill="none" stroke="#ffffff" stroke-width="18"/>`,
  },
  'anger-symbol': {
    label: 'An anger symbol',
    body: `
      <path d="M200 48 L200 150 M200 150 L96 96 M200 150 L304 96 M200 150 L124 244 M200 150 L276 244" fill="none" stroke="#e5484d" stroke-width="24"/>`,
  },
  collision: {
    label: 'A collision',
    body: `
      <path d="M200 38 L232 112 L308 78 L268 150 L344 176 L264 196 L300 262 L226 224 L200 290 L174 224 L100 262 L136 196 L56 176 L132 150 L92 78 L168 112 Z" fill="#ff571a" transform="translate(0 -14) scale(1 0.88) translate(0 22)"/>`,
  },
  'black-circle': {
    label: 'A black circle',
    body: `
      <circle cx="200" cy="150" r="92" fill="#17191c"/>`,
  },
  'palm-up-hand': {
    label: 'An open palm held up',
    body: `
      <g transform="translate(200 150) rotate(-90) scale(0.8) translate(-200 -150)">
        <rect x="76" y="148" width="30" height="86" rx="15" fill="#ffc409" transform="rotate(-28 91 191)"/>
        <path d="M110 238 L110 124 A13 13 0 0 1 136 124 L136 152 L158 152 L158 100 A13 13 0 0 1 184 100 L184 152 L206 152 L206 86 A13 13 0 0 1 232 86 L232 152 L254 152 L254 102 A13 13 0 0 1 280 102 L280 238 Z" fill="#ffc409"/>
      </g>`,
  },
  'palms-up-together': {
    label: 'Two palms held up together',
    body: `
      <path d="M72 146 C72 240 328 240 328 146 L328 122 C328 208 72 208 72 122 Z" fill="#ffc409"/>
      <path d="M200 196 L200 232" fill="none"/>
      <rect x="64" y="86" width="30" height="62" rx="15" fill="#ffc409" transform="rotate(-20 79 117)"/>
      <rect x="306" y="86" width="30" height="62" rx="15" fill="#ffc409" transform="rotate(20 321 117)"/>`,
  },
  'crossed-fingers': {
    label: 'Crossed fingers',
    body: `
      <rect x="120" y="140" width="160" height="104" rx="30" fill="#ffc409"/>
      <rect x="146" y="56" width="30" height="110" rx="15" fill="#ffc409" transform="rotate(-16 161 111)"/>
      <rect x="190" y="56" width="30" height="110" rx="15" fill="#ffc409" transform="rotate(20 205 111)"/>`,
  },
  'index-pointing-at-the-viewer': {
    label: 'A finger pointing at you',
    body: `
      <rect x="120" y="82" width="34" height="56" rx="17" fill="#ffc409"/>
      <rect x="96" y="112" width="132" height="112" rx="34" fill="#ffc409"/>
      <rect x="214" y="140" width="112" height="36" rx="18" fill="#ffc409"/>`,
  },
  'backhand-index-pointing-down': {
    label: 'A finger pointing down',
    body: `
      <rect x="126" y="60" width="148" height="104" rx="30" fill="#ffc409"/>
      <rect x="184" y="132" width="32" height="118" rx="16" fill="#ffc409"/>`,
  },
  'writing-hand': {
    label: 'A writing hand',
    body: `
      <path d="M80 248 L104 178 L268 60 L308 104 L146 222 Z" fill="#ffc409"/>
      <path d="M104 178 L146 222" fill="none"/>
      <path d="M268 60 L308 104" fill="none"/>
      <path d="M80 248 L110 230" fill="none"/>`,
  },
  'thumbs-down': {
    label: 'A thumbs down',
    body: `
      <rect x="120" y="56" width="152" height="104" rx="32" fill="#ffc409"/>
      <rect x="126" y="142" width="46" height="96" rx="23" fill="#ffc409"/>
      <path d="M212 110 L212 134" fill="none"/>
      <path d="M246 110 L246 134" fill="none"/>`,
  },
  'flexed-biceps': {
    label: 'A flexed arm',
    body: `
      <rect x="70" y="180" width="150" height="58" rx="29" fill="#ffc409"/>
      <rect x="192" y="86" width="58" height="152" rx="29" fill="#ffc409"/>
      <path d="M104 182 C120 122 196 118 220 156 L220 182 Z" fill="#ffc409"/>`,
  },
  ant: {
    label: 'An ant',
    body: `
      <path d="M118 132 L86 106 M118 150 L82 150 M118 168 L86 194" fill="none"/>
      <path d="M196 128 L186 86 M204 128 L226 86 M200 174 L200 214" fill="none"/>
      <path d="M268 132 L300 106 M268 168 L300 194" fill="none"/>
      <ellipse cx="290" cy="150" rx="46" ry="40" fill="#17191c"/>
      <ellipse cx="204" cy="150" rx="34" ry="30" fill="#17191c"/>
      <ellipse cx="128" cy="150" rx="34" ry="32" fill="#17191c"/>
      <path d="M104 126 L74 92 M104 174 L74 208" fill="none"/>`,
  },
  cat: {
    label: 'A cat',
    body: `
      <path d="M136 100 L128 44 L184 76 Z" fill="#ffc409"/>
      <path d="M264 100 L272 44 L216 76 Z" fill="#ffc409"/>
      <circle cx="200" cy="158" r="86" fill="#ffc409"/>
      <circle cx="172" cy="146" r="9" fill="#17191c"/>
      <circle cx="228" cy="146" r="9" fill="#17191c"/>
      <path d="M200 176 L188 188 M200 176 L212 188" fill="none"/>
      <path d="M144 176 L100 166 M144 192 L102 202" fill="none"/>
      <path d="M256 176 L300 166 M256 192 L298 202" fill="none"/>`,
  },
  cow: {
    label: 'A cow',
    body: `
      <path d="M112 98 A30 30 0 0 1 148 78 M288 98 A30 30 0 0 0 252 78" fill="none"/>
      <ellipse cx="200" cy="140" rx="84" ry="70" fill="#ffffff"/>
      <circle cx="170" cy="126" r="9" fill="#17191c"/>
      <circle cx="230" cy="126" r="9" fill="#17191c"/>
      <ellipse cx="200" cy="196" rx="52" ry="38" fill="#ff571a"/>
      <circle cx="182" cy="192" r="8" fill="#17191c" stroke="none"/>
      <circle cx="218" cy="192" r="8" fill="#17191c" stroke="none"/>
      <path d="M132 106 A22 22 0 0 1 160 96 A20 20 0 0 1 136 124 Z" fill="#17191c"/>`,
  },
  dog: {
    label: 'A dog',
    body: `
      <path d="M112 84 A34 34 0 0 0 112 156 L140 140 L140 100 Z" fill="#ff571a"/>
      <path d="M288 84 A34 34 0 0 1 288 156 L260 140 L260 100 Z" fill="#ff571a"/>
      <ellipse cx="200" cy="150" rx="78" ry="72" fill="#ffc409"/>
      <circle cx="174" cy="136" r="9" fill="#17191c"/>
      <circle cx="226" cy="136" r="9" fill="#17191c"/>
      <ellipse cx="200" cy="184" rx="20" ry="14" fill="#17191c"/>
      <path d="M200 198 L200 212" fill="none"/>`,
  },
  dove: {
    label: 'A dove',
    body: `
      <path d="M116 158 L58 130 L68 190 Z" fill="#ffffff"/>
      <ellipse cx="188" cy="162" rx="82" ry="54" fill="#ffffff"/>
      <circle cx="268" cy="114" r="36" fill="#ffffff"/>
      <path d="M298 106 L340 120 L298 134 Z" fill="#ffc409"/>
      <path d="M146 142 C184 112 236 126 250 160 C216 188 168 182 146 158 Z" fill="#f4f5f7"/>
      <circle cx="280" cy="104" r="7" fill="#17191c" stroke="none"/>`,
  },
  elephant: {
    label: 'An elephant',
    body: `
      <circle cx="112" cy="142" r="58" fill="#3b6cf6"/>
      <circle cx="288" cy="142" r="58" fill="#3b6cf6"/>
      <path d="M200 188 C200 242 244 262 276 242" fill="none" stroke-width="46"/>
      <ellipse cx="200" cy="140" rx="78" ry="74" fill="#3b6cf6"/>
      <path d="M200 188 C200 242 244 262 276 242" fill="none" stroke="#3b6cf6" stroke-width="34"/>
      <circle cx="172" cy="128" r="9" fill="#17191c"/>
      <circle cx="228" cy="128" r="9" fill="#17191c"/>`,
  },
  fish: {
    label: 'A fish',
    body: `
      <path d="M300 78 L300 222 L228 150 Z" fill="#ff571a"/>
      <ellipse cx="180" cy="150" rx="96" ry="62" fill="#3b6cf6"/>
      <circle cx="122" cy="136" r="10" fill="#17191c"/>
      <path d="M180 108 L206 130 L180 152" fill="none"/>`,
  },
  pig: {
    label: 'A pig',
    body: `
      <path d="M126 92 L116 46 L168 72 Z" fill="#ff571a"/>
      <path d="M274 92 L284 46 L232 72 Z" fill="#ff571a"/>
      <ellipse cx="200" cy="154" rx="86" ry="74" fill="#ff571a"/>
      <circle cx="172" cy="136" r="9" fill="#17191c"/>
      <circle cx="228" cy="136" r="9" fill="#17191c"/>
      <ellipse cx="200" cy="186" rx="38" ry="28" fill="#ffc409"/>
      <circle cx="188" cy="186" r="7" fill="#17191c" stroke="none"/>
      <circle cx="212" cy="186" r="7" fill="#17191c" stroke="none"/>`,
  },
  shrimp: {
    label: 'A shrimp',
    body: `
      <path d="M300 84 C210 84 116 128 106 194 C102 226 128 246 158 240 C130 214 152 172 202 156 C254 140 300 142 300 142 Z" fill="#ff571a"/>
      <path d="M262 92 L250 138 M226 104 L216 148 M190 124 L184 164 M158 154 L158 190" fill="none"/>
      <path d="M300 96 L340 74 M300 126 L342 120" fill="none"/>
      <circle cx="282" cy="108" r="8" fill="#17191c" stroke="none"/>`,
  },
  turtle: {
    label: 'A turtle',
    body: `
      <path d="M104 210 L92 236 M282 210 L294 236" fill="none"/>
      <circle cx="304" cy="168" r="30" fill="#ffc409"/>
      <path d="M90 204 A112 92 0 0 1 290 204 Z" fill="#009f70"/>
      <path d="M200 116 L200 204 M136 176 L264 176" fill="none"/>
      <circle cx="316" cy="160" r="7" fill="#17191c" stroke="none"/>`,
  },
  bouquet: {
    label: 'A bouquet',
    body: `
      <path d="M172 176 L152 248 L248 248 L228 176 Z" fill="#009f70"/>
      <circle cx="146" cy="128" r="40" fill="#e5484d"/>
      <circle cx="254" cy="128" r="40" fill="#ff571a"/>
      <circle cx="200" cy="94" r="42" fill="#ffc409"/>`,
  },
  'cherry-blossom': {
    label: 'A cherry blossom',
    body: `
      <circle cx="200" cy="82" r="42" fill="#ffffff"/>
      <circle cx="132" cy="132" r="42" fill="#ffffff"/>
      <circle cx="268" cy="132" r="42" fill="#ffffff"/>
      <circle cx="158" cy="212" r="42" fill="#ffffff"/>
      <circle cx="242" cy="212" r="42" fill="#ffffff"/>
      <circle cx="200" cy="150" r="26" fill="#ffc409"/>`,
  },
  rose: {
    label: 'A rose',
    body: `
      <path d="M200 168 L200 248" fill="none" stroke="#009f70"/>
      <path d="M200 206 L146 186 A40 40 0 0 1 200 206 Z" fill="#009f70"/>
      <circle cx="200" cy="128" r="62" fill="#e5484d"/>
      <path d="M200 92 A36 36 0 1 1 168 146 A24 24 0 1 0 200 116" fill="none"/>`,
  },
  sunflower: {
    label: 'A sunflower',
    body: `
      <circle cx="200" cy="90" r="30" fill="#ffc409"/>
      <circle cx="126" cy="130" r="30" fill="#ffc409"/>
      <circle cx="274" cy="130" r="30" fill="#ffc409"/>
      <circle cx="152" cy="206" r="30" fill="#ffc409"/>
      <circle cx="248" cy="206" r="30" fill="#ffc409"/>
      <circle cx="200" cy="150" r="46" fill="#17191c"/>`,
  },
  seedling: {
    label: 'A seedling',
    body: `
      <path d="M200 248 L200 150" fill="none" stroke="#009f70"/>
      <path d="M200 176 C148 176 112 144 112 104 C164 104 200 136 200 176 Z" fill="#009f70"/>
      <path d="M200 156 C252 156 288 124 288 84 C236 84 200 116 200 156 Z" fill="#009f70"/>`,
  },
  wood: {
    label: 'A log of wood',
    body: `
      <path d="M120 90 L280 90 A38 60 0 0 1 280 210 L120 210 A38 60 0 0 1 120 90 Z" fill="#ff571a"/>
      <ellipse cx="120" cy="150" rx="38" ry="60" fill="#ffc409"/>
      <ellipse cx="120" cy="150" rx="20" ry="32" fill="none"/>`,
  },
  rock: {
    label: 'A rock',
    body: `
      <path d="M92 214 L120 128 L184 92 L268 116 L304 194 L262 226 L136 230 Z" fill="#9aa1a7"/>
      <path d="M120 128 L196 158 L268 116 M196 158 L200 228" fill="none"/>`,
  },
  'cloud-with-snow': {
    label: 'A cloud with snow',
    body: `
      <path d="M136 166 A36 36 0 0 1 148 98 A48 48 0 0 1 238 94 A34 34 0 0 1 268 166 Z" fill="#ffffff"/>
      <path d="M152 192 L152 230 M136 200 L168 222 M168 200 L136 222" fill="none" stroke="#3b6cf6"/>
      <path d="M248 192 L248 230 M232 200 L264 222 M264 200 L232 222" fill="none" stroke="#3b6cf6"/>`,
  },
  snowflake: {
    label: 'A snowflake',
    body: `
      <path d="M200 54 L200 246 M116 102 L284 198 M284 102 L116 198" fill="none" stroke="#3b6cf6"/>
      <path d="M172 82 L200 110 L228 82 M172 218 L200 190 L228 218" fill="none" stroke="#3b6cf6"/>
      <path d="M116 138 L152 134 L138 100 M284 162 L248 166 L262 200" fill="none" stroke="#3b6cf6"/>
      <path d="M284 138 L248 134 L262 100 M116 162 L152 166 L138 200" fill="none" stroke="#3b6cf6"/>`,
  },
  droplet: {
    label: 'A drop of water',
    body: `
      <path d="M200 50 C254 122 278 148 278 184 A78 78 0 0 1 122 184 C122 148 146 122 200 50 Z" fill="#3b6cf6"/>`,
  },
  'drop-of-blood': {
    label: 'A drop of blood',
    body: `
      <path d="M200 50 C254 122 278 148 278 184 A78 78 0 0 1 122 184 C122 148 146 122 200 50 Z" fill="#e5484d"/>`,
  },
  rainbow: {
    label: 'A rainbow',
    body: `
      <path d="M62 232 A138 138 0 0 1 338 232" fill="none" stroke="#e5484d" stroke-width="26"/>
      <path d="M94 232 A106 106 0 0 1 306 232" fill="none" stroke="#ffc409" stroke-width="26"/>
      <path d="M126 232 A74 74 0 0 1 274 232" fill="none" stroke="#009f70" stroke-width="26"/>
      <path d="M158 232 A42 42 0 0 1 242 232" fill="none" stroke="#3b6cf6" stroke-width="26"/>`,
  },
  'rainbow-flag': {
    label: 'A rainbow flag',
    body: `
      <path d="M92 60 L92 250" fill="none"/>
      <rect x="100" y="70" width="212" height="34" fill="#e5484d"/>
      <rect x="100" y="104" width="212" height="34" fill="#ff571a"/>
      <rect x="100" y="138" width="212" height="34" fill="#ffc409"/>
      <rect x="100" y="172" width="212" height="34" fill="#009f70"/>
      <rect x="100" y="70" width="212" height="136" fill="none"/>`,
  },
  'sun-with-face': {
    label: 'A sun with a face',
    body: `
      <path d="M200 40 L200 18 M200 282 L200 260 M78 150 L56 150 M344 150 L322 150 M114 64 L98 48 M302 252 L318 268 M302 64 L318 48 M114 236 L98 252" fill="none" stroke="#ff571a"/>
      <circle cx="200" cy="150" r="86" fill="#ffc409"/>
      <circle cx="172" cy="134" r="9" fill="#17191c"/>
      <circle cx="228" cy="134" r="9" fill="#17191c"/>
      <path d="M170 182 Q200 208 230 182" fill="none"/>`,
  },
  'sun-behind-rain-cloud': {
    label: 'The sun behind a rain cloud',
    body: `
      <circle cx="128" cy="112" r="50" fill="#ffc409"/>
      <path d="M156 186 A36 36 0 0 1 168 116 A48 48 0 0 1 258 112 A34 34 0 0 1 288 186 Z" fill="#ffffff"/>
      <path d="M176 206 L166 240 M222 206 L212 240 M268 206 L258 240" fill="none" stroke="#3b6cf6"/>`,
  },
  'sunrise-over-mountains': {
    label: 'The sun rising over mountains',
    body: `
      <circle cx="200" cy="120" r="44" fill="#ffc409"/>
      <path d="M62 236 L146 128 L206 204 L252 156 L338 236 Z" fill="#009f70"/>`,
  },
  sunset: {
    label: 'A sunset',
    body: `
      <path d="M200 96 L200 60 M124 128 L98 102 M276 128 L302 102" fill="none" stroke="#ff571a"/>
      <path d="M134 194 A66 66 0 0 1 266 194 Z" fill="#ffc409"/>
      <path d="M72 194 L328 194" fill="none"/>
      <path d="M72 220 L328 220" fill="none" stroke="#3b6cf6"/>
      <path d="M72 246 L328 246" fill="none" stroke="#3b6cf6"/>`,
  },
  'night-with-stars': {
    label: 'A night sky over a city',
    body: `
      <rect x="72" y="50" width="256" height="200" rx="24" fill="#17191c"/>
      <path d="M288 74 A62 62 0 1 0 288 194 A48 48 0 1 1 288 74 Z" fill="#ffc409"/>
      <path d="M130 70 L136.2 89.8 L156 96 L136.2 102.2 L130 122 L123.8 102.2 L104 96 L123.8 89.8 Z" fill="#ffc409"/>
      <path d="M180 130 L184.3 143.7 L198 148 L184.3 152.3 L180 166 L175.7 152.3 L162 148 L175.7 143.7 Z" fill="#ffc409"/>
      <rect x="96" y="192" width="54" height="58" fill="#3b6cf6"/>
      <rect x="166" y="176" width="54" height="74" fill="#3b6cf6"/>
      <rect x="236" y="200" width="54" height="50" fill="#3b6cf6"/>`,
  },
  'green-heart': {
    label: 'A green heart',
    body: `
      <g transform="translate(200 150) scale(1) translate(-200 -168)"><path d="M200 240 C108 176 96 140 96 118 A48 48 0 0 1 200 96 A48 48 0 0 1 304 118 C304 140 292 176 200 240 Z" fill="#009f70"/></g>`,
  },
  'growing-heart': {
    label: 'A growing heart',
    body: `
      <g transform="translate(200 158) scale(1) translate(-200 -168)"><path d="M200 240 C108 176 96 140 96 118 A48 48 0 0 1 200 96 A48 48 0 0 1 304 118 C304 140 292 176 200 240 Z" fill="#e5484d"/></g>
      <g transform="translate(200 158) scale(0.66) translate(-200 -168)"><path d="M200 240 C108 176 96 140 96 118 A48 48 0 0 1 200 96 A48 48 0 0 1 304 118 C304 140 292 176 200 240 Z" fill="#ffffff"/></g>
      <g transform="translate(200 158) scale(0.36) translate(-200 -168)"><path d="M200 240 C108 176 96 140 96 118 A48 48 0 0 1 200 96 A48 48 0 0 1 304 118 C304 140 292 176 200 240 Z" fill="#e5484d"/></g>`,
  },
  'sparkling-heart': {
    label: 'A sparkling heart',
    body: `
      <g transform="translate(178 160) scale(0.84) translate(-200 -168)"><path d="M200 240 C108 176 96 140 96 118 A48 48 0 0 1 200 96 A48 48 0 0 1 304 118 C304 140 292 176 200 240 Z" fill="#e5484d"/></g>
      <path d="M308 54 L316.2 79.8 L342 88 L316.2 96.2 L308 122 L299.8 96.2 L274 88 L299.8 79.8 Z" fill="#ffc409"/>
      <path d="M330 146 L335.3 162.7 L352 168 L335.3 173.3 L330 190 L324.7 173.3 L308 168 L324.7 162.7 Z" fill="#ffc409"/>`,
  },
  'two-hearts': {
    label: 'Two hearts',
    body: `
      <g transform="translate(146 174) scale(0.62) translate(-200 -168)"><path d="M200 240 C108 176 96 140 96 118 A48 48 0 0 1 200 96 A48 48 0 0 1 304 118 C304 140 292 176 200 240 Z" fill="#e5484d"/></g>
      <g transform="translate(254 130) scale(0.62) translate(-200 -168)"><path d="M200 240 C108 176 96 140 96 118 A48 48 0 0 1 200 96 A48 48 0 0 1 304 118 C304 140 292 176 200 240 Z" fill="#ff571a"/></g>`,
  },
  'kiss-mark': {
    label: 'A kiss mark',
    body: `
      <path d="M200 122 C216 94 256 88 278 104 C298 118 302 128 306 134 C262 126 228 128 200 136 C172 128 138 126 94 134 C98 128 102 118 122 104 C144 88 184 94 200 122 Z" fill="#e5484d"/>
      <path d="M94 142 C138 136 172 142 200 150 C228 142 262 136 306 142 C296 190 248 230 200 244 C152 230 104 190 94 142 Z" fill="#e5484d"/>`,
  },
  eye: {
    label: 'An eye',
    body: `
      <path d="M62 150 Q200 44 338 150 Q200 256 62 150 Z" fill="#ffffff"/>
      <circle cx="200" cy="150" r="48" fill="#3b6cf6"/>
      <circle cx="200" cy="150" r="20" fill="#17191c" stroke="none"/>`,
  },
  ear: {
    label: 'An ear',
    body: `
      <path d="M144 250 L144 148 A76 76 0 1 1 258 210 A32 32 0 0 0 232 250 Z" fill="#ffc409"/>
      <path d="M176 152 A38 38 0 0 1 240 182" fill="none"/>`,
  },
  'ear-with-hearing-aid': {
    label: 'An ear with a hearing aid',
    body: `
      <path d="M126 250 L126 148 A76 76 0 1 1 240 210 A32 32 0 0 0 214 250 Z" fill="#ffc409"/>
      <path d="M158 152 A38 38 0 0 1 222 182" fill="none"/>
      <path d="M250 96 A66 66 0 0 1 250 216" fill="none" stroke="#3b6cf6"/>
      <circle cx="272" cy="156" r="22" fill="#3b6cf6"/>`,
  },
  nose: {
    label: 'A nose',
    body: `
      <path d="M200 54 C176 118 148 172 148 198 A34 34 0 0 0 200 224 A34 34 0 0 0 252 198 C252 172 224 118 200 54 Z" fill="#ffc409"/>
      <path d="M168 200 A16 16 0 0 0 190 206 M232 200 A16 16 0 0 1 210 206" fill="none"/>`,
  },
  mouth: {
    label: 'A mouth',
    body: `
      <path d="M76 150 C130 88 270 88 324 150 C270 226 130 226 76 150 Z" fill="#e5484d"/>
      <path d="M110 138 L290 138" fill="none" stroke="#ffffff" stroke-width="20"/>`,
  },
  leg: {
    label: 'A leg',
    body: `
      <path d="M146 50 L226 50 L222 150 C222 190 250 206 250 230 L166 230 C166 206 146 190 146 150 Z" fill="#ffc409"/>
      <path d="M166 230 L146 250 L262 250 L250 230" fill="#ffc409"/>`,
  },
  footprints: {
    label: 'Footprints',
    body: `
      <ellipse cx="136" cy="112" rx="34" ry="46" fill="#3b6cf6"/>
      <circle cx="120" cy="60" r="14" fill="#3b6cf6"/>
      <circle cx="152" cy="56" r="12" fill="#3b6cf6"/>
      <ellipse cx="256" cy="200" rx="34" ry="46" fill="#3b6cf6"/>
      <circle cx="272" cy="148" r="14" fill="#3b6cf6"/>
      <circle cx="240" cy="144" r="12" fill="#3b6cf6"/>`,
  },
  candy: {
    label: 'A sweet',
    body: `
      <path d="M82 104 L124 150 L82 196 Z" fill="#ffc409"/>
      <path d="M318 104 L276 150 L318 196 Z" fill="#ffc409"/>
      <rect x="118" y="106" width="164" height="88" rx="40" fill="#e5484d"/>`,
  },
  'chocolate-bar': {
    label: 'A bar of chocolate',
    body: `
      <path d="M92 108 L132 68 L308 68 L308 214 L268 254 L92 254 Z" fill="#ff571a"/>
      <path d="M92 108 L268 108 L308 68 M268 108 L268 254" fill="none"/>
      <path d="M150 108 L150 254 M210 108 L210 254 M92 162 L268 162 M92 208 L268 208" fill="none"/>`,
  },
  'cooked-rice': {
    label: 'A bowl of rice',
    body: `
      <path d="M124 152 A78 58 0 0 1 276 152 Z" fill="#ffffff"/>
      <path d="M92 152 L308 152 A108 92 0 0 1 92 152 Z" fill="#3b6cf6"/>`,
  },
  'cut-of-meat': {
    label: 'A cut of meat',
    body: `
      <path d="M104 176 A82 82 0 0 1 216 90 A74 74 0 0 1 288 186 A70 70 0 0 1 166 226 A78 78 0 0 1 104 176 Z" fill="#e5484d"/>
      <path d="M140 118 A54 54 0 0 1 214 108 A48 48 0 0 1 176 178 A50 50 0 0 1 140 118 Z" fill="#ffffff"/>
      <path d="M262 196 A34 34 0 0 1 300 230" fill="none"/>`,
  },
  'meat-on-bone': {
    label: 'Meat on the bone',
    body: `
      <path d="M156 198 L96 252" fill="none" stroke-width="32"/>
      <path d="M156 198 L96 252" fill="none" stroke="#ffffff" stroke-width="18"/>
      <circle cx="82" cy="240" r="21" fill="#ffffff"/>
      <circle cx="102" cy="262" r="21" fill="#ffffff"/>
      <path d="M146 196 A78 78 0 0 1 196 84 A76 76 0 0 1 300 150 A72 72 0 0 1 214 226 A74 74 0 0 1 146 196 Z" fill="#ff571a"/>`,
  },
  egg: {
    label: 'An egg',
    body: `
      <path d="M200 48 C258 48 292 128 292 172 A92 92 0 0 1 108 172 C108 128 142 48 200 48 Z" fill="#ffffff"/>`,
  },
  'fork-and-knife': {
    label: 'A fork and knife',
    body: `
      <path d="M118 58 L118 104 M148 58 L148 104 M178 58 L178 104" fill="none"/>
      <path d="M114 104 L182 104 L168 136 L128 136 Z" fill="#ffffff"/>
      <rect x="140" y="132" width="16" height="112" rx="8" fill="#ffffff"/>
      <path d="M250 56 L284 88 L276 150 L246 150 Z" fill="#ffffff"/>
      <rect x="253" y="146" width="16" height="98" rx="8" fill="#ffffff"/>`,
  },
  'green-salad': {
    label: 'A salad',
    body: `
      <circle cx="150" cy="132" r="42" fill="#009f70"/>
      <circle cx="248" cy="128" r="46" fill="#009f70"/>
      <circle cx="200" cy="164" r="40" fill="#e5484d"/>
      <path d="M96 156 L304 156 A104 88 0 0 1 96 156 Z" fill="#ffffff"/>`,
  },
  hamburger: {
    label: 'A hamburger',
    body: `
      <path d="M92 132 A108 78 0 0 1 308 132 Z" fill="#ffc409"/>
      <rect x="88" y="132" width="224" height="26" rx="10" fill="#009f70"/>
      <rect x="88" y="158" width="224" height="38" rx="12" fill="#ff571a"/>
      <path d="M88 196 L312 196 A108 52 0 0 1 88 196 Z" fill="#ffc409"/>`,
  },
  'hot-beverage': {
    label: 'A hot drink',
    body: `
      <path d="M140 62 C124 84 156 96 140 118 M200 56 C184 78 216 90 200 112 M260 62 C244 84 276 96 260 118" fill="none" stroke="#9aa1a7"/>
      <path d="M276 152 A40 40 0 0 1 276 220" fill="none"/>
      <path d="M96 140 L276 140 L268 216 A48 34 0 0 1 104 216 Z" fill="#ffffff"/>`,
  },
  'pot-of-food': {
    label: 'A pot of food',
    body: `
      <path d="M96 120 L304 120 L286 226 A92 30 0 0 1 114 226 Z" fill="#3b6cf6"/>
      <path d="M84 120 L316 120" fill="none" stroke-width="22"/>
      <path d="M200 100 L200 76" fill="none"/>
      <circle cx="200" cy="66" r="14" fill="#ffc409"/>`,
  },
  potato: {
    label: 'A potato',
    body: `
      <path d="M92 176 C92 118 148 84 214 88 C280 92 314 132 306 178 C298 224 236 240 178 232 C124 224 92 210 92 176 Z" fill="#ff571a"/>
      <circle cx="160" cy="150" r="10" fill="#17191c" stroke="none"/>
      <circle cx="232" cy="134" r="9" fill="#17191c" stroke="none"/>
      <circle cx="252" cy="192" r="8" fill="#17191c" stroke="none"/>`,
  },
  salt: {
    label: 'A salt shaker',
    body: `
      <path d="M144 116 L256 116 L272 244 L128 244 Z" fill="#ffffff"/>
      <path d="M156 66 L244 66 L256 116 L144 116 Z" fill="#9aa1a7"/>
      <circle cx="180" cy="90" r="7" fill="#17191c" stroke="none"/>
      <circle cx="220" cy="90" r="7" fill="#17191c" stroke="none"/>
      <circle cx="200" cy="74" r="7" fill="#17191c" stroke="none"/>`,
  },
  shortcake: {
    label: 'A slice of cake',
    body: `
      <path d="M104 120 L296 120 L268 244 L132 244 Z" fill="#ffc409"/>
      <path d="M112 156 L288 156" fill="none"/>
      <path d="M104 120 A96 40 0 0 1 296 120 Z" fill="#ffffff"/>
      <circle cx="200" cy="88" r="22" fill="#e5484d"/>`,
  },
  tangerine: {
    label: 'A tangerine',
    body: `
      <circle cx="200" cy="166" r="88" fill="#ff571a"/>
      <path d="M200 78 C168 54 132 58 118 74 C152 92 180 90 200 78 Z" fill="#009f70"/>`,
  },
  'teacup-without-handle': {
    label: 'A cup of tea',
    body: `
      <path d="M104 130 L296 130 L272 208 A80 28 0 0 1 128 208 Z" fill="#ffffff"/>
      <path d="M82 232 L318 232" fill="none" stroke-width="22"/>
      <path d="M124 146 L276 146" fill="none" stroke="#009f70"/>`,
  },
  'tropical-drink': {
    label: 'A tropical drink',
    body: `
      <path d="M96 96 L304 96 L212 200 L188 200 Z" fill="#ffc409"/>
      <path d="M200 200 L200 240" fill="none"/>
      <path d="M156 244 L244 244" fill="none"/>
      <path d="M240 108 L300 48" fill="none" stroke="#e5484d"/>
      <circle cx="122" cy="98" r="30" fill="#ff571a"/>`,
  },
  'tumbler-glass': {
    label: 'A tumbler',
    body: `
      <path d="M120 84 L280 84 L262 240 L138 240 Z" fill="#ffffff"/>
      <path d="M133 168 L267 168" fill="none" stroke="#ff571a"/>
      <path d="M140 220 L260 220" fill="none" stroke="#ff571a"/>`,
  },
  'cup-with-straw': {
    label: 'A cup with a straw',
    body: `
      <path d="M256 52 L188 148" fill="none" stroke="#e5484d"/>
      <path d="M112 100 L288 100 L264 244 A72 22 0 0 1 136 244 Z" fill="#ffc409"/>
      <path d="M100 86 L300 86" fill="none" stroke-width="22"/>`,
  },
  'clinking-beer-mugs': {
    label: 'Two beer mugs clinking',
    body: `
      <path d="M110 128 A38 38 0 0 0 110 204" fill="none"/>
      <path d="M290 128 A38 38 0 0 1 290 204" fill="none"/>
      <rect x="108" y="112" width="104" height="132" rx="14" fill="#ffc409" transform="rotate(-10 160 178)"/>
      <rect x="188" y="112" width="104" height="132" rx="14" fill="#ffc409" transform="rotate(10 240 178)"/>
      <path d="M96 128 L208 108 L212 76 L92 96 Z" fill="#ffffff"/>
      <path d="M304 128 L192 108 L188 76 L308 96 Z" fill="#ffffff"/>`,
  },
  'one-o-clock': {
    label: "One o'clock",
    body: `
      <circle cx="200" cy="150" r="92" fill="#ffffff"/>
      <circle cx="200" cy="150" r="72" fill="none" stroke="#9aa1a7"/>
      <path d="M200 150 L200 80" fill="none"/>
      <path d="M200 150 L224 108.4" fill="none"/>
      <circle cx="200" cy="150" r="9" fill="#17191c" stroke="none"/>`,
  },
  'three-o-clock': {
    label: "Three o'clock",
    body: `
      <circle cx="200" cy="150" r="92" fill="#ffffff"/>
      <circle cx="200" cy="150" r="72" fill="none" stroke="#9aa1a7"/>
      <path d="M200 150 L200 80" fill="none"/>
      <path d="M200 150 L248 150" fill="none"/>
      <circle cx="200" cy="150" r="9" fill="#17191c" stroke="none"/>`,
  },
  'nine-o-clock': {
    label: "Nine o'clock",
    body: `
      <circle cx="200" cy="150" r="92" fill="#ffffff"/>
      <circle cx="200" cy="150" r="72" fill="none" stroke="#9aa1a7"/>
      <path d="M200 150 L200 80" fill="none"/>
      <path d="M200 150 L152 150" fill="none"/>
      <circle cx="200" cy="150" r="9" fill="#17191c" stroke="none"/>`,
  },
  'ten-o-clock': {
    label: "Ten o'clock",
    body: `
      <circle cx="200" cy="150" r="92" fill="#ffffff"/>
      <circle cx="200" cy="150" r="72" fill="none" stroke="#9aa1a7"/>
      <path d="M200 150 L200 80" fill="none"/>
      <path d="M200 150 L158.4 126" fill="none"/>
      <circle cx="200" cy="150" r="9" fill="#17191c" stroke="none"/>`,
  },
  'timer-clock': {
    label: 'A timer',
    body: `
      <path d="M158 52 L242 52" fill="none" stroke-width="22"/>
      <path d="M200 52 L200 76" fill="none"/>
      <circle cx="200" cy="168" r="88" fill="#ffffff"/>
      <path d="M200 168 L200 104" fill="none" stroke="#e5484d"/>
      <path d="M200 168 L252 168" fill="none"/>`,
  },
  stopwatch: {
    label: 'A stopwatch',
    body: `
      <path d="M170 46 L230 46" fill="none" stroke-width="22"/>
      <path d="M200 46 L200 72" fill="none"/>
      <path d="M288 90 L314 64" fill="none" stroke-width="20"/>
      <circle cx="200" cy="170" r="86" fill="#ffffff"/>
      <path d="M200 170 L200 108" fill="none"/>
      <path d="M200 170 L246 200" fill="none" stroke="#e5484d"/>`,
  },
  'hourglass-done': {
    label: 'An hourglass that has run out',
    body: `
      <path d="M140 84 L260 84 L210 150 L260 216 L140 216 L190 150 Z" fill="#ffffff"/>
      <path d="M164 208 L236 208 L200 172 Z" fill="#ffc409" stroke="none"/>
      <rect x="124" y="60" width="152" height="22" rx="8" fill="#ffffff"/>
      <rect x="124" y="218" width="152" height="22" rx="8" fill="#ffffff"/>`,
  },
  zzz: {
    label: 'Sleep',
    body: `
      <path d="M92 218 L176 218 L92 128 L176 128" fill="none"/>
      <path d="M198 128 L262 128 L198 68 L262 68" fill="none"/>
      <path d="M282 78 L332 78 L282 34 L332 34" fill="none"/>`,
  },
  'spiral-calendar': {
    label: 'A spiral calendar',
    body: `
      <path d="M128 56 L128 92 M200 56 L200 92 M272 56 L272 92" fill="none"/>
      <rect x="88" y="86" width="224" height="164" rx="16" fill="#ffffff"/>
      <path d="M88 130 L312 130" fill="none"/>
      <circle cx="146" cy="176" r="9" fill="#17191c" stroke="none"/>
      <circle cx="200" cy="176" r="9" fill="#17191c" stroke="none"/>
      <circle cx="254" cy="176" r="9" fill="#17191c" stroke="none"/>
      <circle cx="146" cy="214" r="9" fill="#17191c" stroke="none"/>
      <circle cx="200" cy="214" r="9" fill="#ff571a" stroke="none"/>
      <circle cx="254" cy="214" r="9" fill="#17191c" stroke="none"/>`,
  },
  'tear-off-calendar': {
    label: 'A tear-off calendar',
    body: `
      <rect x="100" y="86" width="200" height="60" rx="14" fill="#e5484d"/>
      <path d="M100 146 L300 146 L300 232 A14 14 0 0 1 286 246 L114 246 A14 14 0 0 1 100 232 Z" fill="#ffffff"/>
      <path d="M146 62 L146 104 M254 62 L254 104" fill="none"/>
      <path d="M146 196 L254 196" fill="none" stroke="#e5484d" stroke-width="28"/>`,
  },
  '1st-place-medal': {
    label: 'A first place medal',
    body: `
      <path d="M128 50 L200 150 L146 50 Z" fill="#3b6cf6"/>
      <path d="M272 50 L200 150 L254 50 Z" fill="#e5484d"/>
      <circle cx="200" cy="186" r="70" fill="#ffc409"/>
      <path d="M186 160 L206 152 L206 220" fill="none"/>`,
  },
  'adhesive-bandage': {
    label: 'A sticking plaster',
    body: `
      <rect x="60" y="112" width="280" height="80" rx="40" fill="#ffc409" transform="rotate(-24 200 152)"/>
      <rect x="150" y="112" width="100" height="80" rx="16" fill="#ffffff" transform="rotate(-24 200 152)"/>
      <circle cx="184" cy="140" r="6" fill="#17191c" stroke="none"/>
      <circle cx="216" cy="164" r="6" fill="#17191c" stroke="none"/>
      <circle cx="214" cy="130" r="6" fill="#17191c" stroke="none"/>
      <circle cx="186" cy="174" r="6" fill="#17191c" stroke="none"/>`,
  },
  'airplane-arrival': {
    label: 'An aeroplane landing',
    body: `
      <path d="M74 240 L326 240" fill="none"/>
      <path d="M92 196 L146 178 L262 60 L300 74 L244 172 L316 148 L330 176 L120 236 Z" fill="#3b6cf6"/>`,
  },
  'artist-palette': {
    label: "An artist's palette",
    body: `
      <path d="M200 58 C284 58 336 110 336 160 C336 198 306 214 284 206 C264 198 250 210 254 226 C258 246 236 254 200 246 C122 230 66 186 66 146 C66 96 122 58 200 58 Z" fill="#ffffff"/>
      <circle cx="146" cy="120" r="21" fill="#e5484d"/>
      <circle cx="108" cy="170" r="21" fill="#3b6cf6"/>
      <circle cx="168" cy="196" r="21" fill="#ffc409"/>
      <circle cx="216" cy="110" r="21" fill="#009f70"/>
      <circle cx="274" cy="140" r="21" fill="#ff571a"/>`,
  },
  backpack: {
    label: 'A backpack',
    body: `
      <path d="M150 96 A52 52 0 0 1 250 96" fill="none"/>
      <rect x="102" y="86" width="196" height="164" rx="34" fill="#009f70"/>
      <rect x="146" y="152" width="108" height="66" rx="14" fill="#ffc409"/>
      <path d="M102 140 L298 140" fill="none"/>`,
  },
  'balance-scale': {
    label: 'A balance scale',
    body: `
      <path d="M200 56 L200 240 M136 240 L264 240" fill="none"/>
      <path d="M92 96 L308 96" fill="none"/>
      <path d="M60 106 A50 44 0 0 0 148 106 Z" fill="#ffc409"/>
      <path d="M252 106 A50 44 0 0 0 340 106 Z" fill="#ffc409"/>
      <path d="M104 96 L104 106 M296 96 L296 106" fill="none"/>`,
  },
  bathtub: {
    label: 'A bathtub',
    body: `
      <path d="M78 134 L322 134 L300 214 A106 30 0 0 1 100 214 Z" fill="#ffffff"/>
      <path d="M100 224 L92 250 M300 224 L308 250" fill="none"/>
      <path d="M276 134 L276 92 A26 26 0 0 1 320 92" fill="none"/>
      <circle cx="148" cy="106" r="20" fill="#3b6cf6"/>
      <circle cx="196" cy="86" r="16" fill="#3b6cf6"/>`,
  },
  'bell-with-slash': {
    label: 'A bell with a line through it',
    body: `
      <path d="M136 196 C136 140 144 96 200 96 C256 96 264 140 264 196 Z" fill="#ffc409"/>
      <path d="M116 196 L284 196" fill="none"/>
      <path d="M182 216 A20 20 0 0 0 218 216" fill="none"/>
      <path d="M200 96 L200 74" fill="none"/>
      <path d="M96 66 L304 240" fill="none" stroke="#e5484d" stroke-width="24"/>`,
  },
  broom: {
    label: 'A broom',
    body: `
      <path d="M256 52 L156 168" fill="none" stroke-width="22"/>
      <path d="M100 178 L196 178 L226 250 L70 250 Z" fill="#ffc409"/>
      <path d="M118 186 L104 250 M156 186 L150 250 M192 186 L198 250" fill="none"/>`,
  },
  camera: {
    label: 'A camera',
    body: `
      <path d="M158 86 L242 86 L258 116 L142 116 Z" fill="#17191c"/>
      <rect x="76" y="110" width="248" height="150" rx="26" fill="#17191c" transform="translate(0 -14)"/>
      <circle cx="200" cy="164" r="52" fill="#f4f5f7"/>
      <circle cx="200" cy="164" r="24" fill="#3b6cf6"/>
      <circle cx="288" cy="122" r="12" fill="#ffc409" stroke="none"/>`,
  },
  castle: {
    label: 'A castle',
    body: `
      <path d="M76 118 L76 84 L108 84 L108 106 L140 106 L140 84 L172 84 L172 118 Z" fill="#9aa1a7"/>
      <path d="M228 118 L228 84 L260 84 L260 106 L292 106 L292 84 L324 84 L324 118 Z" fill="#9aa1a7"/>
      <rect x="76" y="118" width="96" height="132" fill="#9aa1a7"/>
      <rect x="228" y="118" width="96" height="132" fill="#9aa1a7"/>
      <path d="M172 250 L172 150 L200 108 L228 150 L228 250 Z" fill="#9aa1a7"/>
      <path d="M182 250 L182 198 A18 18 0 0 1 218 198 L218 250 Z" fill="#17191c"/>`,
  },
  'christmas-tree': {
    label: 'A Christmas tree',
    body: `
      <path d="M200 46 L268 132 L232 132 L286 206 L114 206 L168 132 L132 132 Z" fill="#009f70"/>
      <rect x="176" y="206" width="48" height="44" rx="6" fill="#ff571a"/>
      <circle cx="166" cy="176" r="12" fill="#e5484d"/>
      <circle cx="236" cy="180" r="12" fill="#3b6cf6"/>
      <circle cx="200" cy="146" r="12" fill="#ffc409"/>`,
  },
  cigarette: {
    label: 'A cigarette',
    body: `
      <rect x="70" y="140" width="190" height="40" rx="6" fill="#ffffff"/>
      <rect x="256" y="140" width="74" height="40" rx="6" fill="#ff571a"/>
      <path d="M92 116 C76 96 108 82 92 62" fill="none" stroke="#9aa1a7"/>
      <path d="M148 116 C132 96 164 82 148 62" fill="none" stroke="#9aa1a7"/>`,
  },
  'cityscape-at-dusk': {
    label: 'A city at dusk',
    body: `
      <path d="M62 168 A138 100 0 0 1 338 168 Z" fill="#ff571a"/>
      <rect x="82" y="150" width="58" height="100" fill="#17191c"/>
      <rect x="156" y="106" width="58" height="144" fill="#17191c"/>
      <rect x="230" y="134" width="58" height="116" fill="#17191c"/>
      <circle cx="200" cy="96" r="30" fill="#ffc409"/>
      <path d="M62 250 L338 250" fill="none"/>`,
  },
  'clapper-board': {
    label: 'A clapper board',
    body: `
      <rect x="78" y="132" width="244" height="118" rx="14" fill="#17191c"/>
      <path d="M78 116 L318 76 L326 118 L86 158 Z" fill="#ffffff"/>
      <path d="M134 100 L152 142 M196 90 L214 132 M258 80 L276 122" fill="none"/>`,
  },
  clipboard: {
    label: 'A clipboard',
    body: `
      <rect x="94" y="72" width="212" height="180" rx="18" fill="#ff571a"/>
      <rect x="120" y="102" width="160" height="128" rx="10" fill="#ffffff"/>
      <rect x="164" y="54" width="72" height="42" rx="12" fill="#9aa1a7"/>
      <path d="M148 142 L252 142 M148 176 L252 176 M148 208 L212 208" fill="none"/>`,
  },
  'closed-book': {
    label: 'A closed book',
    body: `
      <path d="M112 60 L288 60 A16 16 0 0 1 304 76 L304 238 A16 16 0 0 1 288 254 L112 254 Z" fill="#e5484d"/>
      <path d="M112 60 L112 254" fill="none" stroke-width="24"/>
      <path d="M134 60 L134 254" fill="none"/>`,
  },
  coffin: {
    label: 'A coffin',
    body: `
      <path d="M156 46 L244 46 L282 118 L262 254 L138 254 L118 118 Z" fill="#ff571a"/>
      <path d="M200 96 L200 176 M164 128 L236 128" fill="none" stroke-width="18"/>`,
  },
  'confetti-ball': {
    label: 'A confetti ball',
    body: `
      <path d="M112 250 L126 148 A76 76 0 0 1 274 148 L288 250 Z" fill="#ffc409"/>
      <path d="M126 148 L274 148" fill="none"/>
      <path d="M154 96 L136 60 M246 96 L264 60 M200 76 L200 40" fill="none" stroke="#3b6cf6"/>
      <circle cx="122" cy="52" r="12" fill="#e5484d"/>
      <circle cx="286" cy="60" r="12" fill="#009f70"/>`,
  },
  'credit-card': {
    label: 'A credit card',
    body: `
      <rect x="62" y="80" width="276" height="150" rx="20" fill="#3b6cf6"/>
      <path d="M62 128 L338 128" fill="none" stroke-width="30"/>
      <rect x="96" y="172" width="78" height="30" rx="8" fill="#ffc409"/>`,
  },
  'crossed-swords': {
    label: 'Crossed swords',
    body: `
      <path d="M92 76 L136 76 L272 212 L248 236 Z" fill="#9aa1a7"/>
      <path d="M308 76 L264 76 L128 212 L152 236 Z" fill="#9aa1a7"/>
      <path d="M108 216 L156 264 M292 216 L244 264" fill="none" stroke-width="22"/>`,
  },
  'dollar-banknote': {
    label: 'A dollar note',
    body: `
      <rect x="62" y="92" width="276" height="126" rx="14" fill="#009f70"/>
      <circle cx="200" cy="155" r="40" fill="#ffffff"/>
      <text x="200" y="158" font-family="Helvetica,Arial,sans-serif" font-weight="bold" font-size="52" fill="#009f70" text-anchor="middle" dominant-baseline="central" stroke="none">$</text>`,
  },
  'euro-banknote': {
    label: 'A euro note',
    body: `
      <rect x="62" y="92" width="276" height="126" rx="14" fill="#3b6cf6"/>
      <circle cx="200" cy="155" r="40" fill="#ffffff"/>
      <text x="200" y="158" font-family="Helvetica,Arial,sans-serif" font-weight="bold" font-size="52" fill="#3b6cf6" text-anchor="middle" dominant-baseline="central" stroke="none">€</text>`,
  },
  elevator: {
    label: 'A lift',
    body: `
      <rect x="82" y="54" width="236" height="196" rx="18" fill="#9aa1a7"/>
      <path d="M200 54 L200 250" fill="none"/>
      <path d="M140 148 L162 118 L184 148 Z" fill="#17191c"/>
      <path d="M140 172 L162 202 L184 172 Z" fill="#17191c"/>
      <path d="M244 118 L266 148 L288 118" fill="none"/>`,
  },
  envelope: {
    label: 'An envelope',
    body: `
      <rect x="62" y="80" width="276" height="150" rx="16" fill="#ffffff"/>
      <path d="M62 96 L200 176 L338 96" fill="none"/>`,
  },
  'fire-engine': {
    label: 'A fire engine',
    body: `
      <path d="M62 132 L228 132 L228 208 L62 208 Z" fill="#e5484d"/>
      <path d="M228 150 L292 150 L330 192 L330 208 L228 208 Z" fill="#e5484d"/>
      <rect x="240" y="160" width="52" height="30" rx="6" fill="#ffffff"/>
      <circle cx="116" cy="218" r="28" fill="#ffffff"/>
      <circle cx="288" cy="218" r="28" fill="#ffffff"/>
      <rect x="126" y="102" width="44" height="26" rx="8" fill="#3b6cf6"/>`,
  },
  fireworks: {
    label: 'Fireworks',
    body: `
      <path d="M200 150 L200 48 M200 150 L282 78 M200 150 L302 150 M200 150 L282 222 M200 150 L200 252 M200 150 L118 222 M200 150 L98 150 M200 150 L118 78" fill="none" stroke="#ff571a"/>
      <circle cx="200" cy="44" r="12" fill="#ffc409"/>
      <circle cx="288" cy="72" r="12" fill="#3b6cf6"/>
      <circle cx="308" cy="150" r="12" fill="#e5484d"/>
      <circle cx="288" cy="228" r="12" fill="#009f70"/>
      <circle cx="200" cy="256" r="12" fill="#3b6cf6"/>
      <circle cx="112" cy="228" r="12" fill="#ffc409"/>
      <circle cx="92" cy="150" r="12" fill="#009f70"/>
      <circle cx="112" cy="72" r="12" fill="#e5484d"/>`,
  },
  'fuel-pump': {
    label: 'A fuel pump',
    body: `
      <path d="M92 250 L92 88 A24 24 0 0 1 116 64 L212 64 A24 24 0 0 1 236 88 L236 250 Z" fill="#e5484d"/>
      <rect x="120" y="96" width="88" height="62" rx="8" fill="#ffffff"/>
      <path d="M236 116 L286 116 L286 200 A18 18 0 0 0 322 200 L322 130" fill="none"/>
      <path d="M306 130 L338 130" fill="none"/>`,
  },
  'game-die': {
    label: 'A die',
    body: `
      <rect x="82" y="62" width="236" height="188" rx="30" fill="#ffffff"/>
      <circle cx="140" cy="118" r="15" fill="#17191c" stroke="none"/>
      <circle cx="260" cy="118" r="15" fill="#17191c" stroke="none"/>
      <circle cx="200" cy="156" r="15" fill="#e5484d" stroke="none"/>
      <circle cx="140" cy="194" r="15" fill="#17191c" stroke="none"/>
      <circle cx="260" cy="194" r="15" fill="#17191c" stroke="none"/>`,
  },
  gear: {
    label: 'A gear',
    body: `
      <path d="M176 42 L224 42 L232 82 L262 96 L298 74 L332 118 L306 148 L306 152 L332 182 L298 226 L262 204 L232 218 L224 258 L176 258 L168 218 L138 204 L102 226 L68 182 L94 152 L94 148 L68 118 L102 74 L138 96 L168 82 Z" fill="#9aa1a7"/>
      <circle cx="200" cy="150" r="46" fill="#f4f5f7"/>`,
  },
  glasses: {
    label: 'A pair of glasses',
    body: `
      <circle cx="116" cy="158" r="56" fill="#ffffff"/>
      <circle cx="284" cy="158" r="56" fill="#ffffff"/>
      <path d="M172 150 A34 22 0 0 1 228 150" fill="none"/>
      <path d="M60 138 L34 112 M340 138 L366 112" fill="none"/>`,
  },
  'globe-showing-europe-africa': {
    label: 'A globe',
    body: `
      <circle cx="200" cy="150" r="92" fill="#3b6cf6"/>
      <path d="M156 78 C186 96 172 126 196 130 C220 134 222 106 246 110 L252 88 Z" fill="#009f70"/>
      <path d="M170 156 C200 150 214 172 210 198 C206 226 186 232 174 216 C162 200 150 166 170 156 Z" fill="#009f70"/>
      <path d="M244 160 C262 156 272 174 264 192 L242 186 Z" fill="#009f70"/>`,
  },
  'hammer-and-wrench': {
    label: 'A hammer and a wrench',
    body: `
      <path d="M92 76 L152 76 L164 116 L120 128 Z" fill="#9aa1a7"/>
      <path d="M134 122 L262 244" fill="none" stroke-width="26"/>
      <path d="M134 122 L262 244" fill="none" stroke="#ff571a" stroke-width="14"/>
      <path d="M300 84 A40 40 0 1 0 258 126 L148 236 L178 264 L288 154 A40 40 0 0 0 300 84 Z" fill="#9aa1a7"/>`,
  },
  handbag: {
    label: 'A handbag',
    body: `
      <path d="M148 118 A52 52 0 0 1 252 118" fill="none"/>
      <path d="M92 118 L308 118 L288 244 A120 20 0 0 1 112 244 Z" fill="#ff571a"/>
      <rect x="176" y="150" width="48" height="36" rx="8" fill="#ffc409"/>`,
  },
  hotel: {
    label: 'A hotel',
    body: `
      <rect x="96" y="58" width="208" height="192" rx="12" fill="#3b6cf6"/>
      <rect x="128" y="94" width="42" height="42" rx="6" fill="#ffffff"/>
      <rect x="230" y="94" width="42" height="42" rx="6" fill="#ffffff"/>
      <rect x="128" y="158" width="42" height="42" rx="6" fill="#ffffff"/>
      <rect x="230" y="158" width="42" height="42" rx="6" fill="#ffffff"/>
      <rect x="176" y="196" width="48" height="54" rx="6" fill="#ffc409"/>`,
  },
  'house-with-garden': {
    label: 'A house with a garden',
    body: `
      <rect x="150" y="146" width="140" height="102" rx="8" fill="#ffffff"/>
      <path d="M136 152 L220 84 L304 152 Z" fill="#ff571a"/>
      <rect x="200" y="192" width="44" height="56" rx="4" fill="#ffc409"/>
      <path d="M96 248 L96 182" fill="none" stroke="#009f70"/>
      <circle cx="96" cy="158" r="36" fill="#009f70"/>`,
  },
  houses: {
    label: 'Houses',
    body: `
      <rect x="72" y="152" width="120" height="96" rx="8" fill="#ffffff"/>
      <path d="M58 158 L132 98 L206 158 Z" fill="#3b6cf6"/>
      <rect x="208" y="170" width="120" height="78" rx="8" fill="#ffffff"/>
      <path d="M194 176 L268 122 L342 176 Z" fill="#ff571a"/>`,
  },
  'identification-card': {
    label: 'An identity card',
    body: `
      <rect x="62" y="82" width="276" height="150" rx="18" fill="#ffffff"/>
      <circle cx="132" cy="140" r="30" fill="#3b6cf6"/>
      <path d="M92 202 A44 44 0 0 1 172 202 Z" fill="#3b6cf6"/>
      <path d="M204 126 L308 126 M204 162 L308 162 M204 196 L266 196" fill="none"/>`,
  },
  label: {
    label: 'A label',
    body: `
      <path d="M62 118 A20 20 0 0 1 82 98 L224 98 L338 150 L224 202 L82 202 A20 20 0 0 1 62 182 Z" fill="#ffc409"/>
      <circle cx="112" cy="150" r="15" fill="#f4f5f7"/>`,
  },
  lipstick: {
    label: 'A lipstick',
    body: `
      <rect x="148" y="146" width="104" height="104" rx="10" fill="#9aa1a7"/>
      <path d="M148 146 L148 88 L206 50 L252 76 L252 146 Z" fill="#e5484d"/>
      <path d="M148 110 L252 110" fill="none"/>`,
  },
  loudspeaker: {
    label: 'A loudspeaker',
    body: `
      <path d="M62 122 L124 122 L204 62 L204 238 L124 178 L62 178 Z" fill="#ffc409"/>
      <path d="M244 104 A60 60 0 0 1 244 196" fill="none" stroke="#3b6cf6"/>
      <path d="M284 76 A96 96 0 0 1 284 224" fill="none" stroke="#3b6cf6"/>`,
  },
  'magnifying-glass-tilted-left': {
    label: 'A magnifying glass',
    body: `
      <path d="M124 216 L74 266" fill="none" stroke-width="32"/>
      <circle cx="196" cy="144" r="88" fill="#ffffff"/>
      <circle cx="196" cy="144" r="62" fill="none"/>`,
  },
  memo: {
    label: 'A memo',
    body: `
      <rect x="82" y="62" width="196" height="188" rx="14" fill="#ffffff"/>
      <path d="M112 112 L248 112 M112 152 L248 152 M112 192 L196 192" fill="none"/>
      <path d="M244 214 L300 158 L332 190 L276 246 L236 254 Z" fill="#ffc409"/>`,
  },
  microphone: {
    label: 'A microphone',
    body: `
      <rect x="160" y="42" width="80" height="128" rx="40" fill="#17191c"/>
      <path d="M122 142 A78 78 0 0 0 278 142" fill="none"/>
      <path d="M200 220 L200 254 M158 254 L242 254" fill="none"/>`,
  },
  mirror: {
    label: 'A mirror',
    body: `
      <ellipse cx="200" cy="130" rx="86" ry="96" fill="#ffffff"/>
      <path d="M154 78 A62 70 0 0 1 206 62" fill="none" stroke="#3b6cf6"/>
      <path d="M200 226 L200 256 M158 256 L242 256" fill="none"/>`,
  },
  'money-bag': {
    label: 'A bag of money',
    body: `
      <path d="M158 72 L242 72 L214 118 L186 118 Z" fill="#ffffff"/>
      <path d="M186 118 L214 118 C282 118 322 176 310 214 C300 246 252 254 200 254 C148 254 100 246 90 214 C78 176 118 118 186 118 Z" fill="#ffc409"/>
      <text x="200" y="192" font-family="Helvetica,Arial,sans-serif" font-weight="bold" font-size="86" fill="#17191c" text-anchor="middle" dominant-baseline="central" stroke="none">$</text>`,
  },
  'money-with-wings': {
    label: 'Money with wings',
    body: `
      <path d="M84 84 C46 96 40 132 62 150 L120 122 Z" fill="#ffffff"/>
      <path d="M316 84 C354 96 360 132 338 150 L280 122 Z" fill="#ffffff"/>
      <rect x="88" y="112" width="224" height="120" rx="14" fill="#009f70"/>
      <circle cx="200" cy="172" r="34" fill="#ffffff"/>`,
  },
  'musical-notes': {
    label: 'Musical notes',
    body: `
      <path d="M146 200 L146 84 L292 56 L292 172" fill="none"/>
      <path d="M146 112 L292 84" fill="none"/>
      <ellipse cx="118" cy="204" rx="32" ry="24" fill="#3b6cf6" transform="rotate(-18 118 204)"/>
      <ellipse cx="264" cy="176" rx="32" ry="24" fill="#3b6cf6" transform="rotate(-18 264 176)"/>`,
  },
  'musical-score': {
    label: 'A musical score',
    body: `
      <rect x="62" y="82" width="276" height="140" rx="14" fill="#ffffff"/>
      <path d="M62 112 L338 112 M62 140 L338 140 M62 168 L338 168 M62 196 L338 196" fill="none"/>
      <path d="M186 186 L186 100 L246 88 L246 160" fill="none"/>
      <ellipse cx="170" cy="190" rx="22" ry="16" fill="#3b6cf6"/>
      <ellipse cx="230" cy="164" rx="22" ry="16" fill="#3b6cf6"/>`,
  },
  necktie: {
    label: 'A necktie',
    body: `
      <path d="M158 50 L242 50 L266 86 L226 118 L174 118 L134 86 Z" fill="#3b6cf6"/>
      <path d="M174 118 L226 118 L250 200 L200 260 L150 200 Z" fill="#e5484d"/>`,
  },
  package: {
    label: 'A parcel',
    body: `
      <rect x="72" y="96" width="256" height="154" rx="14" fill="#ff571a"/>
      <path d="M200 96 L200 250" fill="none"/>
      <path d="M72 150 L328 150" fill="none"/>
      <path d="M200 96 C160 46 110 62 138 96 M200 96 C240 46 290 62 262 96" fill="none" stroke="#ffc409"/>`,
  },
  'page-facing-up': {
    label: 'A page',
    body: `
      <path d="M98 56 L242 56 L302 122 L302 244 L98 244 Z" fill="#ffffff"/>
      <path d="M242 56 L242 122 L302 122" fill="none"/>
      <path d="M128 156 L272 156 M128 190 L272 190 M128 220 L218 220" fill="none"/>`,
  },
  paperclip: {
    label: 'A paperclip',
    body: `
      <path d="M268 108 L268 212 A68 68 0 0 1 132 212 L132 96 A44 44 0 0 1 220 96 L220 204 A22 22 0 0 1 176 204 L176 118" fill="none" stroke-width="24"/>`,
  },
  'passport-control': {
    label: 'Passport control',
    body: `
      <rect x="82" y="56" width="236" height="188" rx="18" fill="#3b6cf6"/>
      <circle cx="200" cy="124" r="38" fill="#ffc409"/>
      <path d="M128 216 A76 76 0 0 1 272 216 Z" fill="#ffc409"/>`,
  },
  'place-of-worship': {
    label: 'A place of worship',
    body: `
      <path d="M92 250 L92 150 L200 68 L308 150 L308 250 Z" fill="#ffffff"/>
      <path d="M168 250 L168 190 A32 32 0 0 1 232 190 L232 250 Z" fill="#3b6cf6"/>
      <circle cx="200" cy="44" r="18" fill="#ffc409"/>`,
  },
  'police-car': {
    label: 'A police car',
    body: `
      <path d="M132 146 L152 104 L248 104 L268 146 Z" fill="#3b6cf6"/>
      <rect x="82" y="146" width="236" height="66" rx="20" fill="#ffffff"/>
      <rect x="176" y="70" width="48" height="26" rx="8" fill="#e5484d"/>
      <circle cx="136" cy="216" r="26" fill="#17191c"/>
      <circle cx="264" cy="216" r="26" fill="#17191c"/>`,
  },
  'police-car-light': {
    label: 'A police light',
    body: `
      <path d="M200 74 L200 44 M126 110 L100 84 M274 110 L300 84" fill="none" stroke="#3b6cf6"/>
      <path d="M130 234 L130 176 A70 70 0 0 1 270 176 L270 234 Z" fill="#3b6cf6"/>
      <rect x="112" y="228" width="176" height="26" rx="10" fill="#9aa1a7"/>`,
  },
  purse: {
    label: 'A purse',
    body: `
      <path d="M88 132 L312 132 L292 244 A116 18 0 0 1 108 244 Z" fill="#e5484d"/>
      <path d="M88 132 A112 56 0 0 1 312 132 Z" fill="#ff571a"/>
      <rect x="180" y="150" width="40" height="34" rx="8" fill="#ffc409"/>`,
  },
  pushpin: {
    label: 'A pushpin',
    body: `
      <path d="M186 62 L262 138 L296 132 L262 178 L206 216 L184 194 L222 138 Z" fill="#e5484d"/>
      <path d="M184 194 L108 258" fill="none"/>`,
  },
  radio: {
    label: 'A radio',
    body: `
      <rect x="62" y="102" width="276" height="140" rx="20" fill="#ff571a"/>
      <circle cx="262" cy="172" r="44" fill="#ffffff"/>
      <rect x="96" y="132" width="112" height="46" rx="8" fill="#ffffff"/>
      <circle cx="120" cy="204" r="14" fill="#ffc409"/>
      <circle cx="168" cy="204" r="14" fill="#ffc409"/>
      <path d="M262 102 L316 56" fill="none"/>`,
  },
  'reminder-ribbon': {
    label: 'A ribbon',
    body: `
      <path d="M200 56 C154 96 122 142 138 186 L166 254 L200 194 L234 254 L262 186 C278 142 246 96 200 56 Z" fill="#ffc409"/>
      <path d="M200 56 C246 96 278 142 262 186" fill="none"/>`,
  },
  'ring-buoy': {
    label: 'A life ring',
    body: `
      <circle cx="200" cy="150" r="94" fill="#e5484d"/>
      <circle cx="200" cy="150" r="44" fill="#f4f5f7"/>
      <path d="M134 84 L168 118 M266 84 L232 118 M134 216 L168 182 M266 216 L232 182" fill="none" stroke="#ffffff" stroke-width="26"/>`,
  },
  scissors: {
    label: 'A pair of scissors',
    body: `
      <path d="M104 62 L272 216 M296 62 L128 216" fill="none" stroke-width="20"/>
      <circle cx="108" cy="230" r="32" fill="#ffc409"/>
      <circle cx="292" cy="230" r="32" fill="#ffc409"/>`,
  },
  scroll: {
    label: 'A scroll',
    body: `
      <path d="M112 92 L288 92 L288 208 L112 208 Z" fill="#ffffff"/>
      <path d="M112 92 A26 26 0 0 0 112 144 A26 26 0 0 1 112 196 A26 26 0 0 0 112 248" fill="none"/>
      <path d="M288 52 A26 26 0 0 1 288 104 A26 26 0 0 0 288 156 A26 26 0 0 1 288 208" fill="none"/>
      <path d="M148 128 L252 128 M148 170 L252 170" fill="none"/>`,
  },
  shield: {
    label: 'A shield',
    body: `
      <path d="M200 48 L318 86 C318 186 272 234 200 256 C128 234 82 186 82 86 Z" fill="#3b6cf6"/>
      <path d="M200 96 L200 208" fill="none" stroke="#ffffff"/>
      <path d="M140 140 L260 140" fill="none" stroke="#ffffff"/>`,
  },
  'shopping-cart': {
    label: 'A shopping trolley',
    body: `
      <path d="M56 68 L100 68 L136 190 L292 190" fill="none"/>
      <path d="M110 100 L318 100 L292 172 L134 172 Z" fill="#ffc409"/>
      <circle cx="158" cy="230" r="22" fill="#17191c"/>
      <circle cx="274" cy="230" r="22" fill="#17191c"/>`,
  },
  skull: {
    label: 'A skull',
    body: `
      <path d="M124 200 A92 92 0 1 1 276 200 L276 224 A18 18 0 0 1 258 242 L142 242 A18 18 0 0 1 124 224 Z" fill="#ffffff"/>
      <circle cx="162" cy="152" r="26" fill="#17191c"/>
      <circle cx="238" cy="152" r="26" fill="#17191c"/>
      <path d="M200 190 L186 212 L214 212 Z" fill="#17191c"/>
      <path d="M170 242 L170 216 M200 242 L200 216 M230 242 L230 216" fill="none"/>`,
  },
  'skull-and-crossbones': {
    label: 'A skull and crossbones',
    body: `
      <path d="M74 186 L326 264 M326 186 L74 264" fill="none" stroke="#ffffff" stroke-width="26"/>
      <path d="M74 186 L326 264 M326 186 L74 264" fill="none" stroke-width="10"/>
      <path d="M130 174 A80 80 0 1 1 270 174 L270 194 A16 16 0 0 1 254 210 L146 210 A16 16 0 0 1 130 194 Z" fill="#ffffff"/>
      <circle cx="168" cy="136" r="22" fill="#17191c"/>
      <circle cx="232" cy="136" r="22" fill="#17191c"/>`,
  },
  soap: {
    label: 'A bar of soap',
    body: `
      <path d="M92 158 L212 158 L212 236 A20 20 0 0 1 192 256 L112 256 A20 20 0 0 1 92 236 Z" fill="#3b6cf6"/>
      <circle cx="250" cy="120" r="34" fill="#ffffff"/>
      <circle cx="308" cy="88" r="24" fill="#ffffff"/>
      <circle cx="288" cy="164" r="20" fill="#ffffff"/>`,
  },
  'soccer-ball': {
    label: 'A football',
    body: `
      <circle cx="200" cy="150" r="92" fill="#ffffff"/>
      <path d="M200 90 L250 126 L230 186 L170 186 L150 126 Z" fill="#17191c"/>
      <path d="M200 58 L200 90 M108 128 L150 126 M292 128 L250 126 M148 226 L170 186 M252 226 L230 186" fill="none"/>`,
  },
  station: {
    label: 'A station',
    body: `
      <rect x="96" y="62" width="208" height="130" rx="22" fill="#3b6cf6"/>
      <rect x="126" y="92" width="148" height="52" rx="10" fill="#ffffff"/>
      <circle cx="146" cy="172" r="14" fill="#ffc409"/>
      <circle cx="254" cy="172" r="14" fill="#ffc409"/>
      <path d="M62 224 L338 224" fill="none" stroke-width="18"/>
      <path d="M62 252 L338 252" fill="none" stroke-width="18"/>
      <path d="M120 192 L100 224 M280 192 L300 224" fill="none"/>`,
  },
  't-shirt': {
    label: 'A T-shirt',
    body: `
      <path d="M152 62 L248 62 L326 104 L292 166 L262 150 L262 250 L138 250 L138 150 L108 166 L74 104 Z" fill="#3b6cf6"/>
      <path d="M152 62 A48 30 0 0 0 248 62" fill="none"/>`,
  },
  telephone: {
    label: 'A telephone',
    body: `
      <rect x="84" y="128" width="232" height="120" rx="22" fill="#e5484d"/>
      <rect x="108" y="70" width="184" height="52" rx="26" fill="#17191c"/>
      <circle cx="140" cy="176" r="12" fill="#ffffff" stroke="none"/>
      <circle cx="200" cy="176" r="12" fill="#ffffff" stroke="none"/>
      <circle cx="260" cy="176" r="12" fill="#ffffff" stroke="none"/>
      <circle cx="140" cy="216" r="12" fill="#ffffff" stroke="none"/>
      <circle cx="200" cy="216" r="12" fill="#ffffff" stroke="none"/>
      <circle cx="260" cy="216" r="12" fill="#ffffff" stroke="none"/>`,
  },
  'telephone-receiver': {
    label: 'A telephone handset',
    body: `
      <path d="M104 88 A36 36 0 0 1 168 112 L160 154 A28 28 0 0 1 132 178 A110 110 0 0 0 226 254 A28 28 0 0 1 250 226 L292 218 A36 36 0 0 1 316 282" fill="none" stroke-width="56"/>
      <path d="M104 88 A36 36 0 0 1 168 112 L160 154 A28 28 0 0 1 132 178 A110 110 0 0 0 226 254 A28 28 0 0 1 250 226 L292 218 A36 36 0 0 1 316 282" fill="none" stroke="#ffc409" stroke-width="38"/>`,
  },
  television: {
    label: 'A television',
    body: `
      <rect x="62" y="82" width="276" height="150" rx="18" fill="#17191c"/>
      <rect x="86" y="104" width="228" height="106" rx="10" fill="#3b6cf6"/>
      <path d="M132 82 L176 40 M268 82 L224 40" fill="none"/>
      <path d="M126 250 L162 232 M274 250 L238 232" fill="none"/>`,
  },
  'test-tube': {
    label: 'A test tube',
    body: `
      <path d="M148 52 L252 52 L240 214 A40 40 0 0 1 160 214 Z" fill="#ffffff"/>
      <path d="M154 146 L246 146 L240 214 A40 40 0 0 1 160 214 Z" fill="#009f70"/>
      <path d="M134 52 L266 52" fill="none" stroke-width="20"/>`,
  },
  thermometer: {
    label: 'A thermometer',
    body: `
      <path d="M200 54 A28 28 0 0 1 228 82 L228 176 A44 44 0 1 1 172 176 L172 82 A28 28 0 0 1 200 54 Z" fill="#ffffff"/>
      <circle cx="200" cy="208" r="34" fill="#e5484d"/>
      <path d="M200 174 L200 96" fill="none" stroke="#e5484d" stroke-width="20"/>
      <path d="M236 106 L268 106 M236 140 L268 140" fill="none"/>`,
  },
  toothbrush: {
    label: 'A toothbrush',
    body: `
      <path d="M152 246 L152 120 A34 34 0 0 1 220 120 L220 168" fill="none" stroke-width="32"/>
      <path d="M152 246 L152 120 A34 34 0 0 1 220 120 L220 168" fill="none" stroke="#3b6cf6" stroke-width="20"/>
      <path d="M232 84 L232 168 L308 168 L308 84 Z" fill="#ffffff"/>
      <path d="M252 84 L252 62 M272 84 L272 58 M292 84 L292 62" fill="none"/>`,
  },
  'triangular-ruler': {
    label: 'A set square',
    body: `
      <path d="M92 244 L92 66 L288 244 Z" fill="#ffc409"/>
      <path d="M92 130 L128 130 M92 166 L164 166 M92 202 L200 202" fill="none"/>`,
  },
  'white-cane': {
    label: 'A white cane',
    body: `
      <path d="M256 52 A32 32 0 0 0 200 74 L200 238" fill="none" stroke-width="30"/>
      <path d="M256 52 A32 32 0 0 0 200 74 L200 238" fill="none" stroke="#ffffff" stroke-width="18"/>
      <rect x="180" y="230" width="40" height="30" rx="8" fill="#e5484d"/>`,
  },
  window: {
    label: 'A window',
    body: `
      <rect x="82" y="56" width="236" height="188" rx="14" fill="#3b6cf6"/>
      <path d="M200 56 L200 244 M82 150 L318 150" fill="none" stroke-width="18"/>
      <path d="M62 244 L338 244" fill="none" stroke-width="18"/>`,
  },
  'wrapped-gift': {
    label: 'A wrapped gift',
    body: `
      <rect x="82" y="118" width="236" height="132" rx="14" fill="#e5484d"/>
      <rect x="72" y="88" width="256" height="46" rx="12" fill="#ff571a"/>
      <path d="M200 88 L200 250" fill="none" stroke="#ffc409" stroke-width="26"/>
      <path d="M200 88 C154 40 106 58 136 88 M200 88 C246 40 294 58 264 88" fill="none" stroke="#ffc409"/>`,
  },
  wrench: {
    label: 'A wrench',
    body: `
      <path d="M306 76 A52 52 0 1 0 252 130 L118 264 L80 226 L214 92 A52 52 0 0 0 306 76 Z" fill="#9aa1a7"/>`,
  },
}

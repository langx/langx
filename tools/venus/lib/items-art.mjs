// Venus's props, drawn in the polished rig's own language (style 1 · cilalı) so they sit next to
// her without looking pasted on:
//   - one warm outline, the rig's liner #3B2414 at the body's weight (2 × ol = 8.4 rig units);
//   - flat fills, each region with ONE highlight (a thin upper-left rim) and ONE shade (a lower-right
//     crescent), made exactly as the rig makes them: the shape, a shade copy offset (5, 6), and the
//     base colour again inside the shape shifted (-9, -14) — see headDraw() in venus-rig.js;
//   - inner detail lines thinner (4-6) and in the region's shade colour, never black;
//   - brand yellow / blue as the loud colours, everything else warm and a step lighter than her coat
//     so she stays the most saturated orange thing in the frame.
//
// Units are rig units (head height 200; render.mjs scales by 1.4). Every drawing is a pure function
// of its params, so a frame can animate it. Three kinds of origin:
//   seat   x 0 = her centre, y 0 = the ground; returns { back, front } so the front wall occludes her
//   floor  origin = the middle of the item's footprint on the ground
//   head   head-local coords of the rig (eye line y 0, crown y -99, eyes at x ±57); place with headAt()
//   neck   origin = the rig's neck anchor (the chin covers y < ~23)
export const CANNON_TILT = 22 // degrees the cannon leans toward her
export const LN = '#3B2414',
  OL = 8.4,
  INK = '#14161B'
export const PAL = {
  kraft: ['#E4B984', '#C08D55', '#F6D9AE'],
  kraftIn: ['#8F5F35', '#6E4626', '#A87445'],
  yellow: ['#FFC409', '#E09C00', '#FFE278'],
  yellowIn: ['#B97E00', '#94650A', '#D19300'],
  blue: ['#3B6CF6', '#2747BE', '#86A6FF'],
  navy: ['#24387F', '#18265C', '#3A55AE'],
  red: ['#E5483B', '#B52D24', '#FF8D7E'],
  berry: ['#C8335A', '#99203F', '#EE6E8E'],
  pink: ['#F6A6B8', '#DD8099', '#FFD4DE'],
  mint: ['#5CCBB9', '#3A9E8F', '#A6EBE0'],
  purple: ['#8C72E8', '#6650C4', '#BBA9FF'],
  white: ['#FFFFFF', '#D9E0EC', '#FFFFFF'],
  cream: ['#FFF1D6', '#EBCFA0', '#FFFFFF'],
  wood: ['#B9814C', '#8C5A2E', '#DCA673'],
  grey: ['#BAC2D0', '#8F99AD', '#E3E8F1'],
  gold: ['#FFC409', '#D48F00', '#FFF0A2'],
  dark: ['#2C2F3E', '#1A1C27', '#4D5270'],
  green: ['#52C68E', '#2F9966', '#98E9C2'],
  silver: ['#A9C0DD', '#7E96B8', '#E1ECFA'],
  lining: ['#F7DCCD', '#E2B9A4', '#FFF2EA'],
}
const n1 = (v) => Math.round(v * 10) / 10
let UID = 0
const uid = () => 'it' + (UID++).toString(36)
export const resetIds = () => {
  UID = 0
}

// ------------------------------------------------------------------ the polished treatment
// A region with outline, base, one highlight rim and one shade crescent. k scales the offsets for
// small shapes (a lens wants a thinner rim than a box wall).
export function pol(d, c, k = 1, ow = OL) {
  const id = uid()
  return (
    `<path d="${d}" fill="${c[0]}" stroke="${LN}" stroke-width="${ow}" stroke-linejoin="round" stroke-linecap="round" paint-order="stroke"/>` +
    `<clipPath id="${id}"><path d="${d}"/></clipPath><clipPath id="${id}s"><path d="${d}" transform="translate(${n1(-9 * k)} ${n1(-14 * k)})"/></clipPath>` +
    `<g clip-path="url(#${id})"><path d="${d}" fill="${c[2]}"/><path d="${d}" transform="translate(${n1(5 * k)} ${n1(6 * k)})" fill="${c[1]}"/>` +
    `<g clip-path="url(#${id}s)"><path d="${d}" transform="translate(${n1(5 * k)} ${n1(6 * k)})" fill="${c[0]}"/></g></g>`
  )
}
// flat region with outline only (insides, shadows of insides)
const flat = (d, fill, ow = OL) =>
  `<path d="${d}" fill="${fill}" stroke="${LN}" stroke-width="${ow}" stroke-linejoin="round" paint-order="stroke"/>`
// a detail line
const ln = (d, col = LN, w = 5, extra = '') =>
  `<path d="${d}" fill="none" stroke="${col}" stroke-width="${w}" stroke-linecap="round" stroke-linejoin="round"${extra}/>`
// a rope / strap / string: outline stroke then colour stroke
const rope = (d, col, w = 10, hi = null) =>
  ln(d, LN, w + OL) +
  ln(d, col, w) +
  (hi ? ln(d, hi, Math.max(2, w * 0.3), ` transform="translate(-1.5 -2)"`) : '')
// a contact shadow on the ground (ink, soft, like the rig's own)
export const shadow = (rx, ry = 14, cx = 0, cy = 2, op = 0.18) =>
  `<ellipse cx="${n1(cx)}" cy="${n1(cy)}" rx="${n1(rx)}" ry="${n1(ry)}" fill="${INK}" opacity="${op}"/>`
const clipTo = (d, inner) => {
  const id = uid()
  return `<clipPath id="${id}"><path d="${d}"/></clipPath><g clip-path="url(#${id})">${inner}</g>`
}
const circ = (cx, cy, r) =>
  `M${n1(cx - r)} ${n1(cy)}a${n1(r)} ${n1(r)} 0 1 0 ${n1(2 * r)} 0a${n1(r)} ${n1(r)} 0 1 0 ${n1(-2 * r)} 0Z`
const ell = (cx, cy, rx, ry) =>
  `M${n1(cx - rx)} ${n1(cy)}a${n1(rx)} ${n1(ry)} 0 1 0 ${n1(2 * rx)} 0a${n1(rx)} ${n1(ry)} 0 1 0 ${n1(-2 * rx)} 0Z`
// a four-point glint (highlights on gold, glass, foil)
const glint = (x, y, r, op = 1) =>
  `<path transform="translate(${n1(x)} ${n1(y)})" d="M0 ${-r}Q${r * 0.14} ${-r * 0.14} ${r} 0Q${r * 0.14} ${r * 0.14} 0 ${r}Q${-r * 0.14} ${r * 0.14} ${-r} 0Q${-r * 0.14} ${-r * 0.14} 0 ${-r}Z" fill="#FFFFFF" opacity="${op}"/>`
const text = (s, x, y, size, fill, extra = '') =>
  `<text x="${x}" y="${y}" font-family="Nunito, 'Noto Sans Arabic', 'Hiragino Sans', sans-serif" font-weight="900" font-size="${size}" text-anchor="middle" fill="${fill}"${extra}>${s}</text>`

// ------------------------------------------------------------------ glyphs for the language props
// One letter per locale, the one that says "this alphabet" to its readers. No words: a glyph needs
// no translation and cannot be mis-translated, and every prop stays text-free in the caption sense.
export const GLYPH = { tr: 'Ç', en: 'A', es: 'Ñ', fr: 'É', de: 'Ä', ru: 'Ж', ar: 'ع', 'pt-BR': 'Ã' }
// the "other" side of the exchange: a script that is not the viewer's, chosen per day
export const FOREIGN = ['あ', 'Ж', 'ع', 'Ñ', 'ß', 'Ç', '한', 'É']
export const foreignGlyph = (lang, day) => {
  const own = GLYPH[lang]
  const list = FOREIGN.filter((g) => g !== own)
  return list[day % list.length]
}

// ================================================================== SEATS (sits in / sits on)
// amt (0..~1.1, overshoots on the spring) is applied by the caller as a pop from the ground.
export const SEATS = {
  // an open shipping box: four flaps, dark inside, "this way up" arrows (no letters)
  'cardboard-box': () => {
    const K = PAL.kraft,
      KI = PAL.kraftIn
    let back = shadow(222, 20, 0, 16)
    back += pol('M-176 -126L-161 -162L-250 -214L-270 -170Z', K)
    back += pol('M176 -126L161 -162L250 -214L270 -170Z', K)
    back += pol('M-161 -162L161 -162L152 -248L-150 -240Z', K)
    back += ln('M-140 -226L136 -232', K[1], 4)
    back += flat('M-176 -126L-161 -162L161 -162L176 -126Z', KI[0])
    back += `<path d="M-168 -140L-158 -158L158 -158L168 -140Z" fill="${KI[1]}"/>`
    const face = 'M-176 -126L176 -126L174 8Q174 18 164 18L-164 18Q-174 18 -174 8Z'
    let front = pol(face, K)
    // the front flap folds out and down over the face
    front += pol('M-178 -126L178 -126L188 -82Q189 -78 184 -78L-184 -82Q-189 -82 -188 -86Z', [
      '#EBC594',
      '#C99860',
      '#F8E2BE',
    ])
    front += ln('M-170 -121H170', K[2], 4)
    // a torn strip of tape on the flap
    front += `<path d="M-26 -126L24 -126L28 -76L10 -84L-6 -76L-22 -84Z" fill="#F6E3A8" stroke="${LN}" stroke-width="4" stroke-linejoin="round" opacity="0.92"/>`
    // "this way up" (two arrows on a bar) and a corrugation fleck, in the kraft shade
    front += `<g transform="translate(112 -38)" fill="none" stroke="${K[1]}" stroke-width="7" stroke-linecap="round" stroke-linejoin="round"><path d="M-18 18V-14M-28 -4L-18 -16L-8 -4M18 18V-14M8 -4L18 -16L28 -4M-30 26H30"/></g>`
    front += ln('M-130 -52L-96 -48M-138 -30L-112 -28', K[1], 4)
    return { back, front, h: 250 }
  },

  // a paper shopping bag in brand yellow (or kraft): gusset, a folded top band, twisted paper
  // handles (the back one rises behind her, the front one has flopped forward), crumple creases and
  // a little blue speech bubble with three dots as its print
  'paper-bag': ({ variant = 'yellow' } = {}) => {
    const Y = variant === 'kraft' ? PAL.kraft : PAL.yellow,
      YI = variant === 'kraft' ? PAL.kraftIn : PAL.yellowIn
    const rp = variant === 'kraft' ? '#D9A86C' : '#F2B600'
    let back = shadow(205, 18, 18, 16)
    // the back handle, behind her
    back += rope('M-34 -204C-30 -300 96 -306 106 -204', rp, 11, Y[2])
    // the mouth: dark inside, the back panel's folded band
    back += flat('M-138 -174L138 -174L180 -202L-98 -202Z', YI[0])
    back += `<path d="M-120 -178L120 -178L150 -196L-96 -196Z" fill="${YI[1]}"/>`
    // gusset (the bag's right side), with its fold
    let front = pol('M150 18L138 -174L180 -202L192 -8Z', [Y[1], YI[2], Y[0]])
    front += ln('M159 -188L168 -96L171 -8', YI[1], 4)
    const top = 'M-138 -174Q-100 -166 -70 -176Q-34 -184 0 -172Q40 -164 80 -176Q114 -184 138 -174'
    const panel = `${top}L150 14Q150 18 144 18L-144 18Q-150 18 -150 14Z`
    front += pol(panel, Y)
    front += clipTo(
      panel,
      `<path d="M-160 -150L160 -150V-142H-160Z" fill="${Y[1]}" opacity="0.6"/>` +
        ln('M-100 -120L-86 -60L-104 -6M64 -128L80 -80L70 -30', Y[1], 5) +
        ln('M-118 -130L-108 -76M84 -150L92 -112', Y[2], 6),
    )
    // print: the speech bubble
    front += `<g transform="translate(-6 -64)">${pol('M-40 -26Q-40 -38 -28 -38H28Q40 -38 40 -26V6Q40 18 28 18H-6L-22 32L-20 18H-28Q-40 18 -40 6Z', PAL.blue, 0.6, 6)}${[-17, 0, 17].map((x) => `<circle cx="${x}" cy="-10" r="6.5" fill="#FFFFFF"/>`).join('')}</g>`
    // the front handle, flopped forward over the band
    front += rope('M-62 -172C-60 -118 56 -116 64 -172', rp, 11, Y[2])
    return { back, front, h: 300 }
  },

  // a round laundry basket with slots, a sock over the rim
  'laundry-basket': () => {
    const M = PAL.mint,
      MD = '#2E7D72'
    let back = shadow(225, 20, 0, 18)
    back += flat('M-204 -144Q0 -184 204 -144Q0 -108 -204 -144Z', '#3E9C8E')
    back += ln('M-204 -144Q0 -184 204 -144', LN, 26) + ln('M-204 -144Q0 -184 204 -144', M[2], 17)
    const wall = 'M-204 -144Q0 -108 204 -144L176 4Q0 28 -176 4Z'
    let front = pol(wall, M)
    let slots = ''
    for (let r = 0; r < 2; r++)
      for (let i = -3; i <= 3; i++) {
        const x = i * 50,
          y = -96 + r * 46 + Math.abs(i) * Math.abs(i) * -1.6 + (r ? 4 : 0),
          w = 30 - Math.abs(i) * 2.2
        slots += `<rect x="${n1(x - w / 2)}" y="${n1(y)}" width="${n1(w)}" height="30" rx="12" fill="${MD}"/>`
      }
    front += clipTo(wall, slots)
    // the side handle holes
    front += `<ellipse cx="-180" cy="-112" rx="9" ry="16" fill="${MD}"/><ellipse cx="180" cy="-112" rx="9" ry="16" fill="${MD}"/>`
    front +=
      ln('M-206 -144Q0 -106 206 -144', LN, 28) +
      ln('M-206 -144Q0 -106 206 -144', M[0], 19) +
      ln('M-196 -148Q0 -112 196 -148', M[2], 5)
    // a striped sock draped over the rim
    const sock =
      'M-118 -150Q-114 -164 -92 -160L-66 -150L-74 -66Q-76 -46 -96 -46L-120 -48Q-136 -52 -128 -68L-110 -84Z'
    front +=
      pol(sock, PAL.pink, 0.7) +
      clipTo(
        sock,
        `<path d="M-140 -126H-60V-114H-140ZM-140 -100H-60V-88H-140Z" fill="#FFFFFF"/><path d="M-140 -64H-60V-40H-140Z" fill="${PAL.pink[1]}"/>`,
      )
    return { back, front, h: 190 }
  },

  // a velvet throne cushion: she sits ON it (lift), paws sinking into the front edge
  cushion: () => {
    const C = PAL.berry,
      G = PAL.gold
    const body =
      'M-208 -60Q-220 -92 -184 -100Q0 -118 184 -100Q220 -92 208 -60Q220 -12 192 2Q0 20 -192 2Q-220 -12 -208 -60Z'
    const top = ln('M-178 -92Q0 -112 178 -92', C[2], 6)
    const deco =
      ln('M-204 -64Q0 -44 204 -64', LN, 15) +
      ln('M-204 -64Q0 -44 204 -64', G[0], 8) +
      [-110, 0, 110]
        .map((x) => {
          const y = x ? -24 : -20
          return (
            ln(
              `M${x - 16} ${y - 10}L${x - 4} ${y - 2}M${x + 16} ${y - 10}L${x + 4} ${y - 2}M${x} ${y + 14}L${x} ${y + 5}`,
              C[1],
              4,
            ) + pol(circ(x, y, 7), G, 0.3, 5)
          )
        })
        .join('')
    const tassel = (x, sd) =>
      `<g transform="translate(${x} -62) rotate(${sd * 8})">${pol('M-10 0Q-12 -12 0 -14Q12 -12 10 0Z', G, 0.3, 5)}${pol('M-9 0L9 0L15 40Q0 46 -15 40Z', G, 0.4, 5)}${ln('M-6 10L-8 36M0 10V38M6 10L8 36', G[1], 3)}</g>`
    const back =
      shadow(226, 18, 0, 4) + pol(body, C) + top + deco + tassel(-206, -1) + tassel(206, 1)
    // the front edge again, over her: the velvet she sinks into
    const fid = uid()
    const front =
      `<clipPath id="${fid}"><path d="M-230 -62Q0 -40 230 -62V60H-230Z"/></clipPath><g clip-path="url(#${fid})">${pol(body, C)}${deco}</g>` +
      tassel(-206, -1) +
      tassel(206, 1)
    return { back, front, h: 120, lift: 58 }
  },

  // an open suitcase: the lid stands up behind her with travel stickers on the lining; a sleeve
  // spills over the front; leather straps, brass catches
  suitcase: () => {
    const R = PAL.red,
      Lg = PAL.lining,
      T = PAL.wood,
      G = PAL.gold
    let back = shadow(230, 18, 0, 16)
    const lid = 'M-188 -118L188 -118L178 -362Q178 -372 168 -372L-168 -372Q-178 -372 -178 -362Z'
    back += pol(lid, R)
    back += pol('M-162 -130L162 -130L154 -346L-154 -346Z', Lg)
    back +=
      ln('M-160 -186Q-80 -170 0 -186Q80 -170 160 -186', Lg[1], 5) +
      ln('M-120 -182V-150M-40 -180V-148M40 -180V-148M120 -182V-150', Lg[1], 3)
    // stickers: a plane, a star, a glyph wheel
    back += `<g transform="translate(-112 -290) rotate(-12)">${pol(circ(0, 0, 30), PAL.blue, 0.5, 6)}<path d="M-16 4L16 -6L18 0L4 4L8 16L2 16L-4 6L-14 8Z" fill="#FFFFFF"/></g>`
    back += `<g transform="translate(116 -300) rotate(10)">${pol('M0 -34L10 -11L34 -10L15 5L22 30L0 16L-22 30L-15 5L-34 -10L-10 -11Z', PAL.yellow, 0.5, 6)}</g>`
    back += `<g transform="translate(118 -226) rotate(-6)">${pol('M-30 -20Q-30 -26 -24 -26H24Q30 -26 30 -20V20Q30 26 24 26H-24Q-30 26 -30 20Z', PAL.mint, 0.5, 6)}${text('Aa', 0, 11, 30, '#FFFFFF')}</g>`
    back += flat('M-196 -96L196 -96L188 -120L-188 -120Z', Lg[1])
    const face =
      'M-196 -86Q-196 -96 -186 -96L186 -96Q196 -96 196 -86L196 6Q196 16 186 16L-186 16Q-196 16 -196 6Z'
    let front = pol(face, R)
    front += ln('M-188 -84H188', R[2], 4)
    for (const x of [-104, 104])
      front +=
        pol(`M${x - 13} -98H${x + 13}V16H${x - 13}Z`, T, 0.4, 6) +
        pol(`M${x - 17} -66H${x + 17}V-42H${x - 17}Z`, G, 0.4, 6) +
        `<rect x="${x - 7}" y="-60" width="14" height="12" rx="3" fill="${T[1]}"/>`
    for (const x of [-180, 180]) front += pol(ell(x, -84, 14, 10), G, 0.3, 5)
    // a striped sleeve spilling over the front edge
    const sl = 'M138 -100Q150 -112 168 -104L176 -40Q178 -26 164 -24L150 -24Q138 -26 140 -40Z'
    front +=
      pol(sl, PAL.white, 0.6) +
      clipTo(
        sl,
        `<path d="M120 -92H190V-80H120ZM120 -70H190V-58H120ZM120 -48H190V-36H120Z" fill="${PAL.blue[0]}"/>`,
      )
    return { back, front, h: 380 }
  },
}

// one hamsi (European anchovy, her canon favourite fish): slim, blue-green back, silver belly, a
// forked tail; snout to the left, origin at the middle of the body
function hamsiFish() {
  const body = 'M-48 0Q-34 -13 -2 -11Q24 -10 36 -4L52 -15Q47 0 52 13L36 4Q24 9 -2 9Q-34 11 -48 0Z'
  return (
    pol(body, ['#5E9FB5', '#3E7A91', '#9ED0E0'], 0.4, 6) +
    clipTo(
      body,
      `<path d="M-60 1Q0 -4 60 1V20H-60Z" fill="#DDE8F3"/>` +
        ln('M-30 1Q0 -3 32 0', '#FFFFFF', 3, ' opacity="0.9"') +
        ln('M-30 -8Q-26 -1 -30 6', '#3E7A91', 3),
    ) +
    `<circle cx="-38" cy="-2" r="4.2" fill="#FFF" stroke="${LN}" stroke-width="2.5"/><circle cx="-37.5" cy="-1.8" r="1.9" fill="${LN}"/>`
  )
}

// ================================================================== FLOOR PROPS (origin: footprint centre)
export const FLOOR = {
  // a ball of yarn with two knitting needles through it and a loose thread; rot rolls it
  'yarn-ball': ({ rot = 0 } = {}) => {
    const Y = PAL.berry,
      r = 52
    let s = shadow(62, 12, 0, 2)
    s +=
      ln('M-30 -4Q-80 6 -126 -2Q-160 -8 -196 2', LN, 6 + OL) +
      ln('M-30 -4Q-80 6 -126 -2Q-160 -8 -196 2', Y[0], 6)
    s +=
      rope('M-58 -96L64 -20', PAL.wood[0], 7) +
      `<circle cx="-62" cy="-99" r="9" fill="${PAL.yellow[0]}" stroke="${LN}" stroke-width="5"/>`
    const ball = circ(0, -r, r)
    let strands = ''
    for (let i = 0; i < 5; i++)
      strands += `<ellipse cx="0" cy="0" rx="${r * 0.95}" ry="${r * (0.25 + i * 0.12)}" fill="none" stroke="${Y[1]}" stroke-width="4" transform="rotate(${-30 + i * 36})"/>`
    for (let i = 0; i < 3; i++)
      strands += `<ellipse cx="0" cy="0" rx="${r * 0.6}" ry="${r * 0.95}" fill="none" stroke="${Y[2]}" stroke-width="4" transform="rotate(${50 + i * 50})" opacity="0.8"/>`
    s +=
      pol(ball, Y) +
      clipTo(ball, `<g transform="translate(0 ${-r}) rotate(${n1(rot)})">${strands}</g>`)
    s +=
      rope('M-66 -60L70 -104', PAL.wood[0], 7) +
      `<circle cx="74" cy="-106" r="9" fill="${PAL.blue[0]}" stroke="${LN}" stroke-width="5"/>`
    return s
  },
  // a felt wind-up mouse (the key on its back turns)
  'toy-mouse': ({ t = 0 } = {}) => {
    const Gr = PAL.grey
    let s = shadow(70, 10, 6, 2)
    s += rope('M62 -14Q104 -10 118 -34Q128 -56 104 -60', PAL.pink[0], 6)
    s += pol('M-70 -12Q-70 -64 -14 -66Q44 -68 68 -26Q76 -4 58 0L-56 0Q-70 0 -70 -12Z', Gr)
    s +=
      pol(circ(-26, -66, 20), Gr, 0.5) + `<circle cx="-26" cy="-66" r="10" fill="${PAL.pink[0]}"/>`
    s += `<circle cx="-48" cy="-36" r="5.5" fill="${LN}"/><circle cx="-50" cy="-38" r="1.8" fill="#FFF"/>`
    s += pol(circ(-74, -18, 8), PAL.pink, 0.3, 5)
    s += ln('M-76 -26L-104 -36M-76 -16L-106 -14', LN, 3)
    s += ln('M-6 -58Q8 -30 -2 -4', Gr[1], 4, ' stroke-dasharray="7 7"')
    const k = Math.cos(t * 6)
    s += `<g transform="translate(24 -66)">${rope('M0 0V-18', PAL.gold[1], 5)}<g transform="translate(0 -22) scale(${n1(Math.max(0.2, Math.abs(k)) * 100) / 100} 1)">${pol('M0 0Q-24 -18 -26 -4Q-24 10 0 0Q24 10 26 -4Q24 -18 0 0Z', PAL.gold, 0.3, 5)}</g></g>`
    return s
  },
  // a crinkly catnip fish, the plush kind with stitches
  'catnip-fish': () => {
    let s = shadow(80, 10, 0, 2)
    const body =
      'M-80 -28Q-56 -70 10 -60Q46 -54 64 -36L96 -60Q104 -30 96 2L64 -20Q40 -2 0 2Q-60 4 -80 -28Z'
    s +=
      pol(body, PAL.mint) +
      clipTo(
        body,
        ln('M8 -60Q24 -30 8 0', PAL.mint[1], 4) +
          ln('M-30 -56Q-20 -46 -30 -36M-10 -56Q0 -46 -10 -36', PAL.mint[2], 4),
      )
    s += ln('M-74 -30Q-30 -8 60 -28', PAL.pink[0], 4, ' stroke-dasharray="6 7"')
    s += `<circle cx="-50" cy="-38" r="8" fill="#FFF" stroke="${LN}" stroke-width="4"/><circle cx="-48" cy="-37" r="3.5" fill="${LN}"/>`
    return s
  },
  // the treat pouch from photo 10: a stand-up foil pouch with a zip, a window full of treats, a
  // fish on the front; a few treats spilled at its foot
  'treat-pouch': () => {
    const P = PAL.purple
    let s = shadow(84, 12, 10, 2)
    const pouch = 'M-56 -164L56 -164L58 -18Q60 0 42 0L-42 0Q-60 0 -58 -18Z'
    s += pol(pouch, P)
    s += clipTo(
      pouch,
      ln('M-60 -146H60', P[1], 5) +
        ln('M-60 -152H60', P[2], 3) +
        `<path d="M-62 -100Q0 -112 62 -100V-96Q0 -108 -62 -96Z" fill="${P[1]}" opacity="0.6"/>`,
    )
    s += `<path d="M-56 -164L-48 -158L-56 -152" fill="none" stroke="${LN}" stroke-width="4"/>`
    // window with treats
    s += flat(
      'M-36 -70Q-36 -82 -24 -82H24Q36 -82 36 -70V-28Q36 -16 24 -16H-24Q-36 -16 -36 -28Z',
      PAL.cream[0],
      5,
    )
    for (const [x, y] of [
      [-18, -60],
      [4, -66],
      [20, -50],
      [-10, -36],
      [12, -30],
      [-24, -30],
    ])
      s += `<path transform="translate(${x} ${y})" d="M-7 0Q-8 -7 0 -7Q8 -7 7 0Q8 7 0 7Q-8 7 -7 0Z" fill="#A9652E" stroke="${LN}" stroke-width="2.5"/>`
    // the fish emblem
    s += `<g transform="translate(0 -122)">${pol('M-30 0Q-14 -18 10 -12Q20 -10 26 -4L40 -14Q42 0 40 14L26 4Q14 16 -8 14Q-24 12 -30 0Z', PAL.yellow, 0.4, 5)}<circle cx="-16" cy="-2" r="3.5" fill="${LN}"/></g>`
    for (const [x, y] of [
      [70, -8],
      [92, -6],
      [80, -22],
    ])
      s += `<path transform="translate(${x} ${y})" d="M-9 0Q-10 -9 0 -9Q10 -9 9 0Q10 9 0 9Q-10 9 -9 0Z" fill="#A9652E" stroke="${LN}" stroke-width="3.5"/>`
    return s
  },
  // a ceramic food bowl, a heap of kibble, a paw print on the front
  'food-bowl': () => {
    const B = PAL.pink
    let s = shadow(104, 14, 0, 2)
    s += flat(ell(0, -56, 94, 18), B[1])
    for (const [x, y] of [
      [-50, -62],
      [-30, -72],
      [-8, -78],
      [14, -76],
      [36, -70],
      [56, -60],
      [-14, -64],
      [20, -62],
      [-40, -56],
      [44, -54],
    ])
      s += `<path transform="translate(${x} ${y})" d="M-11 0Q-12 -10 0 -10Q12 -10 11 0Q12 9 0 9Q-12 9 -11 0Z" fill="#B0703A" stroke="${LN}" stroke-width="3.5"/>`
    const bowl = 'M-96 -54Q0 -30 96 -54Q92 -14 70 -2L-70 -2Q-92 -14 -96 -54Z'
    s += pol(bowl, B)
    s += ln('M-90 -50Q0 -28 90 -50', B[2], 5)
    s += `<g transform="translate(0 -26)" fill="#FFFFFF"><ellipse cx="0" cy="4" rx="11" ry="9"/><circle cx="-12" cy="-8" r="5"/><circle cx="0" cy="-13" r="5"/><circle cx="12" cy="-8" r="5"/></g>`
    return s
  },
  // a whole fish (sardine), lying on the floor
  fish: () => {
    const S = PAL.silver
    let s = shadow(96, 10, 0, 2)
    const body = 'M-96 -28Q-50 -66 34 -44L92 -70Q84 -36 94 -2L34 -18Q-50 10 -96 -28Z'
    s += pol(body, S)
    s += clipTo(
      body,
      ln('M-64 -48Q-54 -28 -64 -10', S[1], 5) +
        [-30, -6, 18].map((x) => ln(`M${x} -40Q${x + 10} -32 ${x} -24`, S[2], 4)).join('') +
        `<path d="M-96 -24Q0 -18 96 -24V20H-96Z" fill="${S[2]}" opacity="0.5"/>`,
    )
    s += pol('M-6 -54L14 -74L24 -50Z', S, 0.4, 6)
    s += `<circle cx="-74" cy="-34" r="9" fill="#FFF" stroke="${LN}" stroke-width="4"/><circle cx="-72" cy="-33" r="4" fill="${LN}"/>`
    return s
  },
  // ---------------------------------------------------------------- the kitchen (food and drink)
  // Text-free like everything else: no label, no brand, no word on any tin or pouch; a band of colour
  // or a paw print says "cat food" in every locale.

  // her favourite fish (canon, bible §13): three hamsi on a blue-rimmed saucer, one already turned
  // tail-out over the edge, the way they sit after a cat has "only sniffed" them
  hamsi: () => {
    let s = shadow(108, 13, 0, 2)
    s += pol(ell(0, -20, 106, 28), PAL.white, 0.6)
    s += ln(`M-86 -26Q0 6 86 -26`, PAL.blue[0], 7) + flat(ell(0, -24, 76, 16), '#F1F4FA', 0)
    s += [
      [-8, -54, -10, 1],
      [12, -38, 7, 1],
      [-14, -24, -3, -1],
    ]
      .map(
        ([x, y, r, d]) =>
          `<g transform="translate(${x} ${y}) rotate(${r}) scale(${1.3 * d} 1.3)">${hamsiFish()}</g>`,
      )
      .join('')
    return s
  },
  // plain boiled chicken, shredded, still warm: the top of every scale she has
  'boiled-chicken': ({ t = 0 } = {}) => {
    const C = ['#F6E2BF', '#D8B27C', '#FFF7E8']
    let s = shadow(100, 13, 0, 2)
    const sw = 5 * Math.sin(t * 2.2)
    s += ln(
      `M-30 -116Q${-44 + sw} -140 -28 -160Q${-14 + sw} -180 -30 -202`,
      '#FFFFFF',
      8,
      ' opacity="0.8"',
    )
    s += ln(
      `M26 -122Q${12 - sw} -146 28 -164Q${44 - sw} -184 30 -204`,
      '#FFFFFF',
      8,
      ' opacity="0.65"',
    )
    // a pile of torn strips, each its own little region, so it reads as shreds, not a lump
    const strip = (x, y, r, L = 58, w = 10) =>
      `<g transform="translate(${x} ${y}) rotate(${r})">${pol(`M${-L / 2} 0Q${-L / 4} ${-w} 0 ${-w * 0.7}Q${L / 4} ${-w * 1.1} ${L / 2} -2Q${L / 4} ${w * 0.4} 0 ${w * 0.25}Q${-L / 4} ${w * 0.5} ${-L / 2} 0Z`, C, 0.25, 4)}${ln(`M${-L / 2 + 8} -3Q0 -7 ${L / 2 - 8} -4`, C[1], 2.5)}</g>`
    for (const a of [
      [-58, -66, -8],
      [-20, -70, 10],
      [22, -68, -6],
      [60, -64, 12],
      [-40, -84, 18],
      [0, -88, -14],
      [40, -84, 6],
      [-18, -102, -4],
      [22, -104, 20],
      [2, -116, 2],
    ])
      s += strip(...a)
    const bowl = 'M-96 -62Q0 -40 96 -62Q90 -16 66 -2L-66 -2Q-90 -16 -96 -62Z'
    s += pol(bowl, PAL.blue)
    s += ln('M-90 -58Q0 -36 90 -58', PAL.blue[2], 5)
    s += strip(80, -60, 30, 36, 11)
    return s
  },
  // a wet-food pouch, torn open at the corner, gravy and chunks slumped out onto a saucer
  'wet-food-pouch': () => {
    const T = ['#3FA7B5', '#2B7F8C', '#8EDBE3']
    let s = shadow(104, 12, 6, 2)
    s += pol(ell(18, -12, 92, 18), PAL.white, 0.6)
    // the pouch leans back against nothing, the way pouches do
    s += `<g transform="translate(-34 -10) rotate(-14)">`
    const pouch =
      'M-46 0Q-52 -60 -46 -150L-30 -142L-16 -154L0 -142L16 -154L30 -142L46 -150Q52 -60 46 0Q0 8 -46 0Z'
    s += pol(pouch, T)
    s += clipTo(
      pouch,
      `<path d="M-60 -70Q0 -92 60 -70V-50Q0 -72 -60 -50Z" fill="${T[2]}" opacity="0.8"/>` +
        ln('M-60 -18H60', T[1], 5),
    )
    // a paw print instead of any word
    s += `<g transform="translate(2 -104)" fill="#FFFFFF"><ellipse cx="0" cy="5" rx="11" ry="9"/><circle cx="-12" cy="-8" r="5"/><circle cx="0" cy="-13" r="5"/><circle cx="12" cy="-8" r="5"/></g>`
    s += `</g>`
    // what came out: glossy gravy and chunks
    const gravy = 'M-6 -20Q20 -40 60 -30Q96 -24 92 -12Q60 0 10 -6Q-12 -8 -6 -20Z'
    s += pol(gravy, ['#9A5A30', '#76411F', '#C88452'], 0.5, 6)
    for (const [x, y, r] of [
      [22, -24, 11],
      [48, -28, 13],
      [70, -20, 10],
      [36, -14, 8],
    ])
      s += pol(
        `M${x - r} ${y}Q${x - r} ${y - r} ${x} ${y - r}Q${x + r} ${y - r} ${x + r} ${y}Q${x + r} ${y + r * 0.7} ${x} ${y + r * 0.7}Q${x - r} ${y + r * 0.7} ${x - r} ${y}Z`,
        ['#B26D3C', '#8A4E26', '#D9945F'],
        0.3,
        4,
      )
    s += `<path d="M30 -32Q44 -38 58 -34" stroke="#FFFFFF" stroke-width="4" fill="none" stroke-linecap="round" opacity="0.7"/>`
    return s
  },
  // a tuna tin, ring-pull lid peeled up behind it, pink flakes inside (the can opener's sound is the gag)
  'tuna-can': () => {
    const S = PAL.silver
    let s = shadow(96, 13, 10, 2)
    // the lid, hinged at the back, peeled up, its ring on top
    s += `<g transform="translate(30 -102) rotate(-28)">${pol(ell(0, -40, 50, 40), S, 0.5)}${ln(`M-34 -40A34 28 0 0 1 34 -40`, S[1], 4)}${pol(ell(0, -76, 15, 10), S, 0.3, 5)}${flat(ell(0, -76, 7, 4), S[1], 0)}</g>`
    const side = 'M-74 -94L-74 -10Q-74 4 0 4Q74 4 74 -10L74 -94Z'
    s += pol(side, S)
    s += clipTo(
      side,
      `<path d="M-80 -70Q0 -54 80 -70V-36Q0 -20 -80 -36Z" fill="${PAL.blue[0]}"/>` +
        ln('M-80 -72Q0 -56 80 -72', PAL.blue[2], 4) +
        ln('M-80 -20Q0 -4 80 -20', S[1], 4),
    )
    s += `<g transform="translate(0 -52)">${pol('M-26 0Q-10 -14 10 -9Q18 -7 24 -2L34 -10Q36 0 34 10L24 2Q12 12 -6 10Q-20 8 -26 0Z', PAL.white, 0.3, 4)}</g>`
    s += pol(ell(0, -94, 74, 18), [S[1], '#5F7799', S[0]], 0.4)
    s += flat(ell(0, -92, 62, 13), '#E9A48F', 0)
    for (const [x, y] of [
      [-30, -94],
      [-6, -98],
      [18, -92],
      [38, -96],
      [-14, -88],
      [8, -86],
    ])
      s += `<path transform="translate(${x} ${y})" d="M-9 0Q-6 -6 2 -5Q10 -3 8 2Q2 6 -6 4Z" fill="#F7C2B2" stroke="#C97D68" stroke-width="2.5"/>`
    return s
  },
  // a lickable treat tube: squeezed thin in the middle, torn at the top, a curl of paste
  'treat-tube': () => {
    const P = PAL.pink
    let s = shadow(84, 11, 0, 2)
    // a stick-shaped tube: crimped ends, flattened where it has been squeezed, torn top, a curl of paste
    const tube = (fill, squeezed) => {
      const d = squeezed
        ? 'M-17 -6L17 -6L16 -60Q9 -76 10 -92L16 -150L-16 -150L-10 -92Q-9 -76 -16 -60Z'
        : 'M-17 -6L17 -6L17 -150L-17 -150Z'
      return (
        pol(d, fill, 0.5) +
        clipTo(
          d,
          '<path d="M-30 -36L30 -60V-48L-30 -24ZM-30 -112L30 -136V-124L-30 -100Z" fill="#FFFFFF"/>',
        ) +
        pol('M-21 -6L21 -6L21 6L-21 6Z', [fill[1], fill[1], fill[0]], 0.3, 5) +
        ln('M-14 -2V4M-6 -2V4M2 -2V4M10 -2V4', fill[0], 2.5)
      )
    }
    s += `<g transform="translate(46 -8) rotate(14)">${tube(PAL.mint, false)}${pol('M-21 -150L21 -150L21 -162L-21 -162Z', [PAL.mint[1], PAL.mint[1], PAL.mint[0]], 0.3, 5)}</g>`
    s += `<g transform="translate(-30 -8) rotate(-8)">${tube(P, true)}`
    s += `<path d="M-16 -150L-11 -157L-5 -150L0 -158L5 -150L11 -157L16 -150" fill="none" stroke="${LN}" stroke-width="4" stroke-linejoin="round"/>`
    s += pol(
      'M-14 -156Q-22 -184 0 -190Q22 -190 16 -172Q30 -166 14 -154Z',
      ['#F3D7A2', '#D8B474', '#FFF1D2'],
      0.4,
      6,
    )
    s += `</g>`
    // a lick-clean smear on the floor
    s += pol(ell(-92, -2, 18, 5), ['#F3D7A2', '#D8B474', '#FFF1D2'], 0.2, 4)
    return s
  },
  // the "empty" bowl: kibble all round the edge, and in the middle the bottom shows (crisis)
  'empty-bowl': () => {
    const B = PAL.blue
    let s = shadow(106, 14, 0, 2)
    // the inside, seen from above-ish: pale floor with the bowl's own paw print showing through
    s += flat(ell(0, -62, 94, 30), B[1])
    s += `<path d="${ell(0, -60, 60, 17)}" fill="#D6E3FF"/>`
    s += `<g transform="translate(0 -60) scale(1 0.55)" fill="${B[2]}"><ellipse cx="0" cy="5" rx="13" ry="10"/><circle cx="-14" cy="-9" r="6"/><circle cx="0" cy="-15" r="6"/><circle cx="14" cy="-9" r="6"/></g>`
    // kibble round the rim only
    const ring = []
    for (let i = 0; i < 16; i++) {
      const a = (i / 16) * Math.PI * 2
      ring.push([Math.cos(a) * 76, -60 + Math.sin(a) * 23])
    }
    for (const [x, y] of ring.filter(([, y]) => y < -48))
      s += `<path transform="translate(${n1(x)} ${n1(y)})" d="M-10 0Q-11 -9 0 -9Q11 -9 10 0Q11 8 0 8Q-11 8 -10 0Z" fill="#B0703A" stroke="${LN}" stroke-width="3.5"/>`
    const bowl = 'M-98 -60Q0 -24 98 -60Q94 -16 72 -2L-72 -2Q-94 -16 -98 -60Z'
    s += pol(bowl, B)
    s += ln('M-92 -56Q0 -22 92 -56', B[2], 5)
    // two that she scooped out onto the floor
    for (const [x, y, r] of [
      [118, -6, 20],
      [-122, -4, -30],
    ])
      s += `<path transform="translate(${x} ${y}) rotate(${r})" d="M-10 0Q-11 -9 0 -9Q11 -9 10 0Q11 8 0 8Q-11 8 -10 0Z" fill="#B0703A" stroke="${LN}" stroke-width="3.5"/>`
    return s
  },
  // a terracotta pot of fresh catnip: soft toothed leaves, little lilac flower spikes, one leaf bitten
  catnip: ({ t = 0 } = {}) => {
    const Lf = ['#93CC82', '#62A356', '#CBEFBC'],
      T = ['#D9825B', '#B0603F', '#F2A982']
    let s = shadow(70, 11, 0, 2)
    const sw = 3 * Math.sin(t * 1.7)
    const leaf = (x, y, r, k = 1, bite = false) => {
      const d = 'M0 0Q-26 -10 -24 -36Q-14 -58 0 -62Q14 -58 24 -36Q26 -10 0 0Z'
      const body = bite
        ? 'M0 0Q-26 -10 -24 -36Q-14 -58 0 -62Q6 -60 10 -56Q4 -50 12 -44Q4 -38 16 -34Q22 -30 24 -26Q26 -10 0 0Z'
        : d
      return `<g transform="translate(${x} ${y}) rotate(${n1(r + sw)}) scale(${k})">${pol(body, Lf, 0.4, 6)}${ln('M0 -4V-52M0 -18L-12 -28M0 -30L12 -40M0 -18L12 -28', Lf[1], 3)}</g>`
    }
    const spike = (x, y, r) =>
      `<g transform="translate(${x} ${y}) rotate(${n1(r + sw * 1.4)}) scale(1.2)">${rope('M0 0V-64', Lf[1], 4)}${[
        [0, -70, 9],
        [-5, -58, 8],
        [5, -50, 8],
        [-4, -40, 7],
      ]
        .map(([a, b, rr]) => pol(circ(a, b, rr), ['#C9B6FF', '#9F86E6', '#ECE4FF'], 0.25, 4))
        .join('')}</g>`
    s += spike(-18, -96, -10) + spike(22, -100, 12)
    s +=
      leaf(-34, -92, -48) +
      leaf(34, -92, 48, 1, true) +
      leaf(-14, -96, -14, 1.1) +
      leaf(14, -98, 16, 1.05) +
      leaf(0, -94, 0, 0.9)
    // the pot: a rim band and a tapered body
    s += pol('M-52 -64L52 -64L42 -4Q40 2 34 2L-34 2Q-40 2 -42 -4Z', T)
    s += pol('M-60 -96L60 -96L58 -66L-58 -66Z', T, 0.6)
    s += ln('M-54 -90H54', T[2], 4)
    return s
  },
  // a tray of cat grass: straight bright blades, two bent over where she has been chewing
  'cat-grass': ({ t = 0 } = {}) => {
    const G = PAL.green
    let s = shadow(86, 11, 0, 2)
    const sw = 2.5 * Math.sin(t * 1.9)
    let blades = ''
    const xs = [-58, -46, -34, -22, -10, 2, 14, 26, 38, 50, 60]
    xs.forEach((x, i) => {
      const h = 120 + ((i * 37) % 40),
        lean = ((i * 13) % 11) - 5 + sw
      const tip = [x + lean * 1.6, -86 - h]
      blades += pol(
        `M${x - 6} -84Q${n1(x + lean * 0.5 - 5)} ${n1(-84 - h * 0.6)} ${n1(tip[0])} ${n1(tip[1])}Q${n1(x + lean * 0.5 + 5)} ${n1(-84 - h * 0.6)} ${x + 6} -84Z`,
        i % 3 === 1 ? [G[1], '#237550', G[0]] : G,
        0.25,
        5,
      )
    })
    // the chewed ones, folded over the rim
    blades += pol(
      'M-4 -84Q-2 -150 30 -168Q60 -178 84 -150Q60 -160 36 -152Q10 -140 8 -84Z',
      G,
      0.3,
      5,
    )
    blades += pol(
      'M-40 -84Q-44 -130 -70 -142Q-92 -146 -104 -124Q-84 -134 -68 -128Q-50 -118 -30 -84Z',
      G,
      0.3,
      5,
    )
    s += blades
    // the tray
    s += pol('M-74 -90L74 -90L66 -2Q64 2 58 2L-58 2Q-64 2 -66 -2Z', PAL.white)
    s += pol('M-80 -100L80 -100L78 -86L-78 -86Z', PAL.white, 0.5)
    s += ln('M-70 -50H70', PAL.white[1], 4)
    return s
  },
  // a pet water fountain, burbling away; she drinks from anything but this
  'water-fountain': ({ t = 0 } = {}) => {
    const W = ['#9AD0FF', '#5FA4E8', '#D9F0FF']
    let s = shadow(104, 13, 0, 2)
    const base = 'M-100 -56Q0 -34 100 -56Q96 -12 72 -2L-72 -2Q-96 -12 -100 -56Z'
    s += flat(ell(0, -58, 98, 22), W[0])
    const r = (t * 0.9) % 1
    s += `<ellipse cx="0" cy="-58" rx="${n1(24 + r * 60)}" ry="${n1(6 + r * 14)}" fill="none" stroke="${W[2]}" stroke-width="4" opacity="${n1((1 - r) * 100) / 100}"/>`
    // a spout on a column; a clear arc of water pours from it into the basin
    s += pol('M-14 -60L14 -60L12 -150L-12 -150Z', PAL.white, 0.5)
    s += pol('M-12 -150Q-12 -164 4 -164L40 -162Q48 -160 46 -150L12 -146Z', PAL.white, 0.4, 6)
    const off = n1(-((t * 60) % 24))
    s +=
      ln('M44 -154Q86 -150 86 -66', LN, 18) +
      ln('M44 -154Q86 -150 86 -66', W[0], 11) +
      ln(
        'M44 -154Q86 -150 86 -66',
        '#FFFFFF',
        4,
        ` stroke-dasharray="6 18" stroke-dashoffset="${off}"`,
      )
    s += `<g transform="translate(84 -60)">${[
      [-10, -8],
      [10, -12],
      [0, -16],
    ]
      .map(
        ([x, y]) =>
          `<circle cx="${x}" cy="${y}" r="5" fill="${W[2]}" stroke="${LN}" stroke-width="2.5"/>`,
      )
      .join('')}</g>`
    s += pol(base, PAL.white)
    s += ln('M-94 -52Q0 -30 94 -52', PAL.white[1], 5)
    s += `<g transform="translate(-50 -26)" fill="${W[1]}"><path d="M0 -14Q9 -2 0 4Q-9 -2 0 -14Z"/></g>`
    return s
  },
  // your glass of water: the one she actually drinks from (half full, a paw-dip ripple, drips)
  'water-glass': ({ t = 0 } = {}) => {
    const W = ['#A9D8FF', '#73B4F0', '#E2F3FF']
    let s = shadow(56, 10, 8, 2)
    const glass = 'M-44 -170L44 -170L36 -8Q35 2 26 2L-26 2Q-35 2 -36 -8Z'
    const water = 'M-41 -96Q0 -88 41 -96L36 -8Q35 2 26 2L-26 2Q-35 2 -36 -8Z'
    s += `<path d="${glass}" fill="#EEF6FF" opacity="0.55"/>`
    s += pol(water, W, 0.6, 0)
    const r = (t * 1.2) % 1
    s += `<ellipse cx="6" cy="-94" rx="${n1(8 + r * 26)}" ry="${n1(2 + r * 4)}" fill="none" stroke="#FFFFFF" stroke-width="3" opacity="${n1((1 - r) * 100) / 100}"/>`
    s += `<path d="${glass}" fill="none" stroke="${LN}" stroke-width="${OL}" stroke-linejoin="round"/>`
    s +=
      ln('M-30 -156L-24 -24', '#FFFFFF', 7, ' opacity="0.9"') +
      ln('M28 -150L26 -120', '#FFFFFF', 5, ' opacity="0.7"')
    // drips down the side and a little puddle (the paw went in)
    s += `<path d="M42 -120Q46 -110 42 -104Q38 -110 42 -120Z" fill="${W[0]}" stroke="${LN}" stroke-width="3"/>`
    s += pol(ell(64, -2, 26, 6), W, 0.3, 4)
    return s
  },
  // the butter dish, lid off, a tongue-shaped groove licked along the block
  'butter-dish': () => {
    const Bu = ['#FFE58E', '#EBC44F', '#FFF6CC']
    let s = shadow(110, 13, 0, 2)
    // the lid, set down (knocked) to one side, upside down
    s += `<g transform="translate(96 -14) rotate(18)">${pol('M-46 0Q-46 -40 0 -42Q46 -40 46 0Z', PAL.mint)}${pol(ell(0, -44, 10, 6), PAL.mint, 0.3, 5)}</g>`
    // the dish
    s += pol('M-96 -34L96 -34L84 -4Q82 2 74 2L-74 2Q-82 2 -84 -4Z', PAL.mint)
    s += ln('M-90 -28H90', PAL.mint[2], 4)
    // the block, in two-point-ish perspective: top, front, side
    s += pol('M-60 -94L44 -94L60 -78L-44 -78Z', Bu, 0.5)
    s += pol('M-60 -94L-44 -78L-44 -34L-60 -48Z', [Bu[1], '#C9A23A', Bu[0]], 0.5)
    s += pol('M-44 -78L60 -78L60 -34L-44 -34Z', Bu, 0.6)
    // the licked groove: a scoop out of the front-top edge, with tongue-stroke lines
    s += `<path d="M-4 -78Q10 -60 30 -60Q46 -60 52 -78Z" fill="${Bu[1]}" stroke="${LN}" stroke-width="4" stroke-linejoin="round"/>`
    s += ln('M6 -74Q16 -64 28 -64M18 -76Q28 -68 40 -70', '#D5AE45', 3)
    s += glint(26, -86, 7, 0.9)
    return s
  },
  // your plate: half a sandwich with a cat-sized bite out of the corner, crumbs, a fork
  'human-plate': () => {
    let s = shadow(110, 13, 0, 2)
    s += pol(ell(0, -18, 106, 26), PAL.white, 0.6)
    s += ln('M-90 -24Q0 6 90 -24', PAL.blue[0], 6)
    // a square slice of bread on top of filling on top of bread, seen from the front; the bite is a
    // scalloped notch in the top-right corner
    const B = ['#F4D7A4', '#D7A865', '#FFEBC8'],
      crust = '#B97C3C'
    s += `<g transform="translate(-6 0)">`
    s += pol('M-66 -28L66 -28L66 -50L-66 -50Z', B, 0.5)
    s +=
      ln('M-70 -54H70', '#6DBE5C', 9) +
      ln('M-66 -60H66', '#F08C8C', 8) +
      ln('M-62 -66H62', '#FFD84A', 7)
    const top =
      'M-66 -68L-66 -132Q-66 -146 -50 -146H18Q30 -148 32 -138Q40 -144 46 -134Q56 -136 56 -124Q66 -122 64 -110L66 -68Z'
    s += pol(top, B)
    s += `<path d="${top}" fill="none" stroke="${crust}" stroke-width="7" transform="scale(0.9) translate(0 -8)" opacity="0.55"/>`
    s += `</g>`
    for (const [x, y] of [
      [66, -32],
      [80, -26],
      [58, -22],
    ])
      s += `<circle cx="${x}" cy="${y}" r="4" fill="#D7A865" stroke="${LN}" stroke-width="2"/>`
    return s
  },
  // a yogurt pot with its foil lid peeled off and licked to a shine
  'yogurt-lid': () => {
    let s = shadow(100, 12, 10, 2)
    const pot = 'M-44 -116L44 -116L36 -6Q35 2 26 2L-26 2Q-35 2 -36 -6Z'
    s += pol(pot, PAL.white)
    s += clipTo(
      pot,
      `<path d="M-60 -82H60V-58H-60Z" fill="${PAL.blue[0]}"/><path d="M-60 -76H60V-72H-60Z" fill="${PAL.blue[2]}"/>`,
    )
    s += pol(ell(0, -116, 46, 11), PAL.white, 0.4)
    s += flat(ell(0, -115, 38, 7), '#FFFDF6', 0)
    // the foil lid on the floor: a flat silver disc, its tab, licked to a shine
    s += `<g transform="translate(86 -12)">${pol(ell(0, 0, 40, 13), PAL.silver, 0.4, 6)}${pol('M34 -4L56 -12L60 -2L38 4Z', PAL.silver, 0.3, 5)}${ln('M-24 0Q-12 -6 0 0Q12 6 24 0', PAL.silver[1], 3)}${glint(-12, -4, 10)}${glint(16, 2, 6, 0.8)}</g>`
    return s
  },
  // flashcards: a stack and two standing cards, the viewer's alphabet and another one
  flashcards: ({ glyph = 'A', other = 'あ' } = {}) => {
    let s = shadow(110, 12, 0, 2)
    s += pol('M-104 -8L80 -8L104 -24L-80 -24Z', PAL.white, 0.5) + ln('M-104 -2L80 -2', LN, 4)
    const card = (g, bandCol, col) =>
      `${pol('M-54 -70Q-54 -78 -46 -78H46Q54 -78 54 -70V70Q54 78 46 78H-46Q-54 78 -54 70Z', PAL.white, 0.6)}<path d="M-50 -74H50V-52H-50Z" fill="${bandCol}"/>${text(g, 0, 26, 76, col)}<path d="M-30 52H30" stroke="${PAL.white[1]}" stroke-width="7" stroke-linecap="round"/>`
    s += `<g transform="translate(46 -100) rotate(12)">${card(other, PAL.red[0], PAL.red[1])}</g>`
    s += `<g transform="translate(-36 -96) rotate(-8)">${card(glyph, PAL.blue[0], PAL.blue[1])}</g>`
    return s
  },
  // a tiny fat dictionary standing up, a ribbon bookmark hanging out
  dictionary: () => {
    let s = shadow(84, 12, 0, 2)
    s += `<g transform="rotate(-5)">`
    s += pol('M40 -156L62 -146L62 -4L40 -2Z', PAL.cream, 0.4)
    s += ln('M46 -140V-12M52 -136V-12M57 -132V-12', PAL.cream[1], 2.5)
    s += pol('M-64 -156Q-70 -156 -70 -150V-8Q-70 -2 -64 -2H40V-156Z', PAL.navy)
    s += pol('M-46 -156H40V-2H-46Z', PAL.blue, 0.8)
    s += `<path d="M-68 -132H-48M-68 -122H-48M-68 -36H-48M-68 -26H-48" stroke="${PAL.gold[0]}" stroke-width="5"/>`
    s += `<g transform="translate(-3 -92)">${pol('M-32 -22Q-32 -32 -22 -32H22Q32 -32 32 -22V8Q32 18 22 18H-2L-16 30L-14 18H-22Q-32 18 -32 8Z', PAL.yellow, 0.5, 6)}${text('Aa', 0, 4, 30, PAL.navy[0])}</g>`
    s += rope('M20 -4Q22 18 12 30', PAL.red[0], 9)
    s += `</g>`
    return s
  },
  // a passport, open, stamps on both pages
  passport: () => {
    let s = shadow(100, 10, 0, 2)
    s += pol('M-104 -10L0 -2L104 -10L92 -40L0 -32L-92 -40Z', PAL.navy, 0.5)
    s +=
      pol('M-94 -36L0 -28L0 -98L-86 -108Z', PAL.cream, 0.5) +
      pol('M94 -36L0 -28L0 -98L86 -108Z', PAL.cream, 0.5)
    s += `<g transform="translate(-46 -68) rotate(-14)"><circle r="20" fill="none" stroke="${PAL.red[0]}" stroke-width="5"/><path d="M-10 0H10M0 -10V10" stroke="${PAL.red[0]}" stroke-width="4"/></g>`
    s += `<g transform="translate(46 -72) rotate(10)"><rect x="-24" y="-16" width="48" height="32" rx="6" fill="none" stroke="${PAL.blue[0]}" stroke-width="5"/><path d="M-12 6L0 -8L12 6" fill="none" stroke="${PAL.blue[0]}" stroke-width="4"/></g>`
    return s
  },
  // a desk globe on a stand; rot turns the land masses (soft blobs, deliberately no real borders)
  globe: ({ rot = 0 } = {}) => {
    let s = shadow(80, 12, 0, 2)
    s += pol('M-66 -8Q-66 -24 0 -24Q66 -24 66 -8Q66 4 0 4Q-66 4 -66 -8Z', PAL.wood)
    s += rope('M0 -24V-92', PAL.wood[0], 12)
    const R = 82,
      cy = -196
    const sph = circ(0, cy, R)
    let land = ''
    const off = ((((rot % 360) + 360) % 360) / 360) * 400
    for (const k of [-1, 0, 1]) {
      const x0 = k * 400 - off
      land += `<g transform="translate(${n1(x0)} ${cy})" fill="${PAL.green[0]}" stroke="${PAL.green[1]}" stroke-width="4"><path d="M-40 -60Q-10 -74 10 -54Q30 -40 14 -16Q0 4 -24 -6Q-50 -18 -40 -60Z"/><path d="M30 10Q56 2 66 26Q70 52 44 60Q24 62 22 40Q20 22 30 10Z"/><path d="M120 -50Q160 -66 190 -40Q206 -10 176 6Q140 16 124 -8Q110 -30 120 -50Z"/><path d="M230 20Q256 8 270 30Q276 54 250 56Q228 52 230 20Z"/><path d="M300 -40Q332 -52 350 -26Q354 0 326 4Q300 2 300 -40Z"/></g>`
    }
    s +=
      `<g transform="rotate(-18 0 ${cy})">` +
      pol(sph, ['#7CC8F4', '#4F9BD8', '#BDE6FF']) +
      clipTo(
        sph,
        land + ln(`M${-R} ${cy}Q0 ${cy + 30} ${R} ${cy}`, '#4F9BD8', 4, ' opacity="0.6"'),
      ) +
      `</g>`
    s += rope(`M-28 ${cy + 100}A104 104 0 1 1 28 ${cy - 100}`, PAL.gold[0], 9)
    s += pol(circ(30, cy - 102, 9), PAL.gold, 0.3, 5)
    return s
  },
  // a sign on a stick, speech-bubble shaped, three alphabets on it
  'speech-sign': () => {
    let s = shadow(50, 10, 0, 2)
    s += pol('M-24 -2L24 -2L18 -22L-18 -22Z', PAL.wood, 0.5)
    s += rope('M0 -20V-400', PAL.wood[0], 14, PAL.wood[2])
    // the board rides high and a little outward (it always stands screen-left), so her ears and
    // head do not cover the glyphs
    const b =
      'M-86 -472Q-86 -502 -56 -502H56Q86 -502 86 -472V-330Q86 -300 56 -300H6L-24 -270L-24 -300H-56Q-86 -300 -86 -330Z'
    s += `<g transform="translate(-34 -96)">${pol(b, PAL.white)}${text('A', -34, -418, 64, PAL.blue[0]) + text('Ж', 34, -418, 64, PAL.red[0]) + text('ع', 0, -330, 64, PAL.mint[1])}</g>`
    // a little smaller than drawn, so the board clears the frame edge under the camera's push-in
    return `<g transform="scale(0.84)">${s}</g>`
  },
  // a gold cup on a wooden base, a star on the bowl, a blank plaque
  trophy: ({ t = 0 } = {}) => {
    const G = PAL.gold
    let s = shadow(96, 14, 0, 2)
    s +=
      pol('M-74 -2L74 -2L66 -42L-66 -42Z', PAL.wood) +
      pol('M-56 -42L56 -42L50 -78L-50 -78Z', PAL.wood)
    s += pol('M-30 -30H30V-14H-30Z', G, 0.3, 5)
    s +=
      rope('M-62 -214Q-112 -214 -102 -170Q-94 -142 -56 -146', G[0], 14, G[2]) +
      rope('M62 -214Q112 -214 102 -170Q94 -142 56 -146', G[0], 14, G[2])
    s += pol('M-18 -78L18 -78L12 -128L-12 -128Z', G, 0.5)
    s += pol('M-74 -232L74 -232Q72 -150 0 -124Q-72 -150 -74 -232Z', G)
    s += pol(ell(0, -232, 74, 12), [G[1], '#B57700', G[0]], 0.4)
    s += pol(
      'M0 -206L8 -188L28 -186L13 -173L18 -153L0 -164L-18 -153L-13 -173L-28 -186L-8 -188Z',
      [G[2], G[0], '#FFFFFF'],
      0.3,
      5,
    )
    const k = Math.max(0, Math.sin(t * 3))
    if (k > 0.05) s += glint(-46, -204, 22 * k, 0.95)
    return s
  },
  // one tier, pink frosting drips, sprinkles, a single candle (she does not count)
  cake: ({ t = 0, lit = true } = {}) => {
    let s = shadow(126, 14, 0, 2)
    s += pol(ell(0, -6, 128, 18), PAL.white, 0.5)
    s += pol('M-100 -100L100 -100L100 -14Q100 -2 88 -2L-88 -2Q-100 -2 -100 -14Z', PAL.cream)
    s += ln('M-96 -48H96', '#F2C472', 6)
    s += pol(
      'M-104 -100Q-104 -122 0 -122Q104 -122 104 -100L104 -76Q96 -62 88 -76Q80 -92 70 -70Q62 -52 52 -72Q42 -88 30 -70Q20 -56 10 -74Q-2 -90 -14 -70Q-24 -54 -34 -74Q-46 -92 -58 -68Q-66 -54 -76 -74Q-88 -92 -96 -72Q-102 -66 -104 -78Z',
      PAL.pink,
    )
    for (const [x, y, c, r] of [
      [-60, -108, PAL.yellow[0], 20],
      [-20, -112, PAL.blue[0], -30],
      [30, -108, PAL.mint[0], 40],
      [62, -112, PAL.yellow[0], -10],
      [6, -100, PAL.blue[0], 70],
      [-44, -96, PAL.mint[0], 10],
    ])
      s += `<rect x="${x - 7}" y="${y - 3}" width="14" height="6" rx="3" fill="${c}" transform="rotate(${r} ${x} ${y})"/>`
    s +=
      pol('M-9 -170H9V-112H-9Z', PAL.white, 0.4, 6) +
      clipTo(
        'M-9 -170H9V-112H-9Z',
        '<path d="M-12 -150L12 -164V-156L-12 -142ZM-12 -128L12 -142V-134L-12 -120Z" fill="#3B6CF6"/>',
      )
    if (lit) {
      const f = 1 + 0.08 * Math.sin(t * 23) + 0.05 * Math.sin(t * 37),
        sw = 3 * Math.sin(t * 11)
      s += `<g transform="translate(0 -172) scale(${n1(f * 100) / 100}) skewX(${n1(sw)})">${pol('M0 -46Q20 -18 12 -4Q6 6 0 6Q-6 6 -12 -4Q-20 -18 0 -46Z', ['#FFB21E', '#F07A12', '#FFE88A'], 0.4, 5)}<path d="M0 -24Q8 -10 4 -2Q0 2 -4 -2Q-8 -10 0 -24Z" fill="#FFF3B0"/></g>`
    }
    return s
  },
  // a confetti cannon (a party popper on a little foot) that fires at `pop`; dir = -1 aims left
  'confetti-cannon': ({ t = 0, pop = 1e9, dir = 1 } = {}) => {
    const u = t - pop
    const kick = u > 0 && u < 0.25 ? Math.sin((u / 0.25) * Math.PI) * 8 : 0
    let s = shadow(64, 10, 0, 2)
    let g = pol('M-40 -2L40 -2L30 -26L-30 -26Z', PAL.navy, 0.5)
    g += `<g transform="translate(0 -26) rotate(${n1(CANNON_TILT + kick)})">`
    const tube = 'M-20 0L20 0L34 -150L-34 -150Z'
    g +=
      pol(tube, PAL.yellow) +
      clipTo(
        tube,
        '<path d="M-60 -24L60 -60V-44L-60 -8ZM-60 -74L60 -110V-94L-60 -58ZM-60 -124L60 -160V-144L-60 -108Z" fill="#3B6CF6"/>',
      )
    g += pol(ell(0, -150, 34, 9), [PAL.yellow[1], PAL.yellowIn[1], PAL.yellow[0]], 0.3, 6)
    if (u < 0) g += pol('M-30 -152Q0 -178 30 -152Z', PAL.pink, 0.4, 6)
    g += `</g>`
    s += dir < 0 ? `<g transform="scale(-1 1)">${g}</g>` : g
    return s
  },
  // a wrapped gift, ribbon and bow
  'gift-box': () => {
    let s = shadow(100, 12, 0, 2)
    s += pol('M-84 -100L84 -100L80 -4Q80 2 74 2L-74 2Q-80 2 -80 -4Z', PAL.blue)
    s += pol('M-96 -100L96 -100L96 -124Q96 -130 90 -130L-90 -130Q-96 -130 -96 -124Z', PAL.blue, 0.6)
    s += `<path d="M-14 -130H14V2H-14Z" fill="${PAL.yellow[0]}" stroke="${LN}" stroke-width="4"/>`
    s += `<g transform="translate(0 -132)">${pol('M0 0Q-30 -40 -56 -26Q-60 -4 0 0Z', PAL.yellow, 0.4, 6)}${pol('M0 0Q30 -40 56 -26Q60 -4 0 0Z', PAL.yellow, 0.4, 6)}${pol(circ(0, -2, 11), PAL.yellow, 0.3, 5)}</g>`
    return s
  },
  // a party balloon on a string, tied to a little weight; sway in degrees
  balloon: ({ sway = 0 } = {}) => {
    let s = shadow(30, 8, 0, 2)
    s += pol('M-20 -2L20 -2L16 -26L-16 -26Z', PAL.gold, 0.4, 6)
    const top = [
      Math.sin((sway * Math.PI) / 180) * 380,
      -Math.cos((sway * Math.PI) / 180) * 380 - 26,
    ]
    s += ln(
      `M0 -26Q${n1(top[0] * 0.3 + 20)} ${n1(top[1] * 0.5)} ${n1(top[0])} ${n1(top[1])}`,
      LN,
      3,
    )
    s += `<g transform="translate(${n1(top[0])} ${n1(top[1])}) rotate(${n1(sway)})">${pol('M-8 6L8 6L4 -4L-4 -4Z', PAL.berry, 0.3, 5)}${pol('M0 -4Q-70 -40 -66 -110Q-60 -170 0 -172Q60 -170 66 -110Q70 -40 0 -4Z', PAL.berry)}<path d="M-38 -130Q-36 -150 -18 -156" stroke="#FFFFFF" stroke-width="9" fill="none" stroke-linecap="round" opacity="0.85"/></g>`
    return s
  },
}

// ================================================================== AIR (toys that move through the frame)
export const AIR = {
  // feathers on a string; the stick runs off the top-right of the frame. ang swings the string.
  'feather-wand': ({ ang = 0, stick = [520, -900], tip = [120, -260], L = 210 } = {}) => {
    let s = rope(`M${stick[0]} ${stick[1]}L${tip[0]} ${tip[1]}`, PAL.wood[0], 9, PAL.wood[2])
    const a = (ang * Math.PI) / 180,
      end = [tip[0] + Math.sin(a) * L, tip[1] + Math.cos(a) * L]
    s += ln(
      `M${tip[0]} ${tip[1]}Q${n1((tip[0] + end[0]) / 2 + 14)} ${n1((tip[1] + end[1]) / 2)} ${n1(end[0])} ${n1(end[1])}`,
      LN,
      3,
    )
    const feather = (rot, c) =>
      `<g transform="rotate(${rot})">${pol('M0 0Q-18 46 0 108Q18 46 0 0Z', c, 0.5, 6)}${ln('M0 6V100', c[1], 3)}${ln('M0 30L-10 40M0 50L-12 62M0 30L10 40M0 50L12 62M0 70L-9 80M0 70L9 80', c[1], 2.5)}</g>`
    s += `<g transform="translate(${n1(end[0])} ${n1(end[1])}) rotate(${n1(-ang * 0.6)})">${feather(24, PAL.pink)}${feather(-22, PAL.blue)}${feather(0, PAL.yellow)}${pol(circ(0, 0, 11), PAL.wood, 0.3, 5)}</g>`
    return s
  },
  // the red dot: no beam, no source, just the dot (she never catches it)
  'red-dot': ({ k = 1 } = {}) =>
    `<circle r="${n1(30 * k)}" fill="#FF2E3A" opacity="0.22"/><circle r="${n1(17 * k)}" fill="#FF2E3A" opacity="0.5"/><circle r="${n1(9 * k)}" fill="#FF2E3A"/><circle cx="-2" cy="-2" r="${n1(3.2 * k)}" fill="#FFFFFF"/>`,
  // a fuzzy moth; flap 0..1
  moth: ({ flap = 0 } = {}) => {
    const w = 0.35 + 0.65 * Math.abs(Math.cos(flap * Math.PI * 2))
    const M = ['#EFE4CF', '#CDBB9A', '#FFF8EA']
    let s = `<g transform="scale(1 ${n1(w * 100) / 100})">${pol('M0 0Q-50 -46 -66 -16Q-70 14 0 0Z', M, 0.4, 6)}${pol('M0 0Q50 -46 66 -16Q70 14 0 0Z', M, 0.4, 6)}<circle cx="-40" cy="-16" r="7" fill="${M[1]}"/><circle cx="40" cy="-16" r="7" fill="${M[1]}"/></g>`
    s += `<g transform="scale(1 ${n1((0.5 + 0.5 * w) * 100) / 100})">${pol('M0 4Q-34 20 -36 36Q-20 40 0 8Z', M, 0.3, 5)}${pol('M0 4Q34 20 36 36Q20 40 0 8Z', M, 0.3, 5)}</g>`
    s += pol(ell(0, 6, 9, 22), ['#A88B66', '#7F6648', '#C9AE86'], 0.3, 5)
    s += ln('M-3 -14Q-12 -34 -22 -36M3 -14Q12 -34 22 -36', LN, 3)
    s += `<circle cx="-4" cy="-10" r="2.6" fill="${LN}"/><circle cx="4" cy="-10" r="2.6" fill="${LN}"/>`
    return s
  },
}

// ================================================================== WEARABLES
// Head-local, origin at the anchor the registry gives; the caller places them with headAt().
export const HEAD = {
  // round-cornered cat-eye sunglasses, yellow frames, dark lenses with a glint
  sunglasses: {
    anchor: [0, 4, 84],
    draw: ({ lensX = 57, f = [1, 1] } = {}) => {
      const lens =
        'M-50 -36Q-58 -36 -57 -26L-54 20Q-52 40 -30 40H30Q52 40 54 20L57 -26Q58 -36 50 -36Z'
      const one = (sd, sc) => {
        if (sc < 0.12) return ''
        const id = uid()
        return (
          `<g transform="translate(${sd * lensX} 0) scale(${n1(sc * sd * 100) / 100} 1)">` +
          ln('M50 -34L66 -48L62 -22', LN, 16) +
          ln('M50 -34L66 -48L62 -22', PAL.yellow[0], 8) +
          `<path d="${lens}" fill="#262A3A" stroke="${LN}" stroke-width="22" stroke-linejoin="round"/>` +
          `<path d="${lens}" fill="none" stroke="${PAL.yellow[0]}" stroke-width="12" stroke-linejoin="round"/>` +
          `<path d="${lens}" fill="none" stroke="${PAL.yellow[2]}" stroke-width="3" transform="translate(-2 -3)" opacity="0.8"/>` +
          `<clipPath id="${id}"><path d="${lens}"/></clipPath><g clip-path="url(#${id})"><path d="M-40 40L10 -40H30L-20 40Z" fill="#FFFFFF" opacity="0.55"/><path d="M8 40L48 -30H56L18 40Z" fill="#FFFFFF" opacity="0.35"/><path d="M-60 14Q0 30 60 14V50H-60Z" fill="#3B4260"/></g></g>`
        )
      }
      return (
        `<g transform="scale(0.9)">` +
        rope(`M${-lensX + 48} -10Q0 -24 ${lensX - 48} -10`, PAL.yellow[0], 8) +
        one(-1, f[0]) +
        one(1, f[1]) +
        '</g>'
      )
    },
  },
  // round wire reading glasses, sitting low (the verdict face)
  'reading-glasses': {
    anchor: [0, 18, 86],
    draw: ({ lensX = 54, f = [1, 1] } = {}) => {
      const one = (sd, sc) =>
        sc < 0.12
          ? ''
          : `<g transform="translate(${sd * lensX} 0) scale(${n1(sc * 100) / 100} 1)"><circle r="34" fill="#E8F4FF" opacity="0.28"/><circle r="34" fill="none" stroke="${LN}" stroke-width="12"/><circle r="34" fill="none" stroke="${PAL.gold[0]}" stroke-width="6"/><path d="M-20 -14Q-10 -26 4 -26" stroke="#FFF" stroke-width="5" fill="none" stroke-linecap="round" opacity="0.9"/></g>`
      return (
        rope(`M${-lensX + 32} -4Q0 -16 ${lensX - 32} -4`, PAL.gold[0], 5) +
        one(-1, f[0]) +
        one(1, f[1])
      )
    },
  },
  // a gold crown, a little crooked, gems that are not any real regalia
  crown: {
    anchor: [0, -88, 40],
    draw: () => {
      const G = PAL.gold
      const c = 'M-58 0L-64 -62L-32 -30L0 -76L32 -30L64 -62L58 0Z'
      let s = `<g transform="rotate(-9)">` + pol(c, G)
      s += pol('M-60 0L60 0L60 -20L-60 -20Z', [G[1], '#B57700', G[0]], 0.5, 7)
      s +=
        pol(circ(-64, -66, 9), G, 0.3, 5) +
        pol(circ(0, -80, 10), G, 0.3, 5) +
        pol(circ(64, -66, 9), G, 0.3, 5)
      s +=
        pol(ell(0, -10, 11, 9), PAL.blue, 0.3, 5) +
        pol('M-38 -10L-30 -18L-22 -10L-30 -2Z', PAL.red, 0.3, 4) +
        pol('M38 -10L30 -18L22 -10L30 -2Z', PAL.red, 0.3, 4)
      s += glint(-28, -42, 10, 0.9)
      return s + '</g>'
    },
  },
  // a striped party hat, worn off to one side, a pompom on top
  'party-hat': {
    anchor: [-30, -90, 30],
    draw: () => {
      const cone = 'M-44 0L-2 -150L44 0Q0 14 -44 0Z'
      let s =
        `<g transform="rotate(-20)">` +
        pol(cone, PAL.blue) +
        clipTo(
          cone,
          '<path d="M-60 -20L60 -60V-40L-60 0ZM-60 -70L60 -110V-90L-60 -50ZM-60 -120L60 -160V-140L-60 -100Z" fill="#FFC409"/>',
        )
      s += ln('M-44 0Q0 14 44 0', LN, 6)
      for (const [x, y, r] of [
        [-2, -156, 16],
        [-14, -166, 11],
        [10, -168, 11],
        [-2, -176, 10],
      ])
        s += pol(circ(x, y, r), PAL.white, 0.3, 5)
      return s + '</g>'
    },
  },
  // a big polka-dot bow at the base of her right (screen-right) ear
  bow: {
    anchor: [74, -90, 46],
    draw: () => {
      const P = PAL.pink
      let s = `<g transform="rotate(22)">`
      s += pol('M-4 6L-22 50L-6 44L4 58Z', P, 0.4, 6) + pol('M4 6L22 48L6 42Z', P, 0.4, 6)
      const loop = 'M0 0Q-34 -40 -58 -18Q-66 8 -40 18Q-20 22 0 0Z'
      s += pol(loop, P, 0.6) + pol('M0 0Q34 -40 58 -18Q66 8 40 18Q20 22 0 0Z', P, 0.6)
      s += `<g fill="#FFFFFF"><circle cx="-40" cy="-6" r="5"/><circle cx="-24" cy="-18" r="4"/><circle cx="40" cy="-6" r="5"/><circle cx="24" cy="-18" r="4"/></g>`
      s += pol(ell(0, 0, 12, 14), P, 0.3, 6)
      return s + '</g>'
    },
  },
  // headphones: band over the crown, cups on her cheeks (cartoon logic: where a person's ears are)
  headphones: {
    anchor: [0, 0, 0],
    draw: () => {
      let s = rope('M-110 -26C-118 -150 118 -150 110 -26', PAL.blue[0], 16, PAL.blue[2])
      for (const sd of [-1, 1])
        s += `<g transform="translate(${sd * 112} -6)">${pol('M-22 -38Q-22 -46 -14 -46H14Q22 -46 22 -38V38Q22 46 14 46H-14Q-22 46 -22 38Z', PAL.yellow, 0.5)}<path d="M${sd * -26} -34V34" stroke="${PAL.dark[0]}" stroke-width="10" stroke-linecap="round"/></g>`
      return s
    },
  },
  // a beret, tilted, a stalk on top; it sits over the base of her ears
  beret: {
    anchor: [-6, -92, 30],
    draw: () => {
      const b = 'M-86 6Q-96 -40 -10 -46Q84 -48 90 -8Q86 12 40 14Q-30 18 -86 6Z'
      return `<g transform="rotate(-10)">${pol(b, PAL.red)}${ln('M-80 4Q0 22 84 -4', PAL.red[1], 5)}${pol('M-4 -46L4 -46L2 -62L-2 -62Z', PAL.red, 0.3, 5)}</g>`
    },
  },
  // a gold star sticker on her forehead ("gold star")
  'gold-star': {
    anchor: [0, -60, 100],
    draw: () =>
      pol('M0 -26L8 -9L26 -8L12 4L17 23L0 13L-17 23L-12 4L-26 -8L-8 -9Z', PAL.gold, 0.4, 6) +
      glint(-6, -6, 6),
  },
}
// Neck-anchored, drawn between her body and her head so the chin overlaps them.
export const NECK = {
  // a knitted scarf, wrapped once, one end hanging over her chest
  scarf: () => {
    const Y = PAL.yellow
    const wrap = 'M-80 -4Q0 34 80 -4L76 30Q0 70 -76 30Z'
    let s =
      pol('M18 34L56 30L66 140L26 148Z', Y) +
      clipTo(
        'M18 34L56 30L66 140L26 148Z',
        '<path d="M0 60L80 54V70L0 76ZM0 100L80 94V110L0 116Z" fill="#3B6CF6"/>',
      )
    s += ln('M30 146L28 166M40 146L40 168M50 144L52 166M60 142L64 162', Y[0], 7)
    s +=
      pol(wrap, Y) +
      clipTo(
        wrap,
        '<path d="M-90 4Q0 44 90 4V16Q0 56 -90 16Z" fill="#3B6CF6"/>' +
          [-60, -40, -20, 0, 20, 40, 60]
            .map((x) =>
              ln(
                `M${x} ${14 + Math.abs(x) * -0.1}V${40 - Math.abs(x) * 0.2}`,
                Y[1],
                3,
                ' opacity="0.7"',
              ),
            )
            .join(''),
      )
    s += pol(ell(36, 36, 22, 16), Y, 0.4)
    return s
  },
  bowtie: () =>
    `<g transform="translate(0 44)">${pol('M0 0L-46 -24L-46 24Z', PAL.blue, 0.5)}${pol('M0 0L46 -24L46 24Z', PAL.blue, 0.5)}<g fill="#FFFFFF"><circle cx="-30" cy="-6" r="4"/><circle cx="-24" cy="10" r="4"/><circle cx="30" cy="-6" r="4"/><circle cx="24" cy="10" r="4"/></g>${pol('M-12 -12H12V12H-12Z', PAL.blue, 0.3, 6)}</g>`,
  // a rosette medal on a ribbon (milestone)
  medal: () => {
    let s =
      pol('M-34 0L-6 0L10 84L-12 84Z', PAL.blue, 0.5) + pol('M34 0L6 0L-10 84L12 84Z', PAL.red, 0.5)
    s += `<g transform="translate(0 110)">${pol(circ(0, 0, 44), PAL.gold)}${pol('M0 -22L6 -8L22 -7L10 4L14 20L0 11L-14 20L-10 4L-22 -7L-6 -8Z', [PAL.gold[2], PAL.gold[0], '#FFFFFF'], 0.3, 5)}</g>`
    return s
  },
}

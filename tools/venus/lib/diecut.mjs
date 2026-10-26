// The die-cut both sticker scripts use: a white border grown from the whisker-free render (so it
// hugs the body and not the hairs), a soft shadow, then trimmed and centred on a transparent 512 px
// square. ImageMagick runs without a shell, so every path is one argument whatever it contains.
import { execFileSync } from 'node:child_process'

export function dieCut(art, mask, out, { strip = false } = {}) {
  execFileSync('magick', [
    art,
    ...['-bordercolor', 'none', '-border', '40'],
    ...['(', mask, '-bordercolor', 'none', '-border', '40', '-alpha', 'extract'],
    ...['-morphology', 'Dilate', 'Disk:18', '-background', 'white', '-alpha', 'shape', ')'],
    ...['+swap', '-compose', 'over', '-composite'],
    ...['(', '+clone', '-background', '#14161B', '-shadow', '35x8+0+8', ')'],
    ...['+swap', '-background', 'none', '-layers', 'merge', '+repage', '-trim', '+repage'],
    ...['-resize', '492x492', '-gravity', 'center', '-background', 'none', '-extent', '512x512'],
    ...(strip ? ['-strip'] : []),
    out,
  ])
}

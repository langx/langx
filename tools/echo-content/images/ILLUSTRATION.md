# Patient Objects

The drawing language for a cue — the picture above the sentence on an Echo
card. It governs the files here marked `data-origin="langx"`; the OpenMoji ones
follow it only as far as the plate and the size, which is the part that makes
the two sit together.

## The philosophy

A card asks a question, and the picture is not the question. It is the thing
the eye lands on a quarter-second before the words, and its whole job is to
have already said, wordlessly, what the sentence is about — then to get out of
the way. So the drawing is quiet where an emoji is loud: one subject, held
still, given air on every side. Nothing gestures at the reader. Nothing is
funny. A cue that performs is a cue that competes.

Form is flat and closed. Every shape is a solid field bounded by a single ink
contour of one unvarying weight, the way a sign painter cuts a stencil — no
gradient, no blur, no shadow, no highlight pretending at a light source. Depth,
where it is needed, comes from overlap and from the order of the fields, never
from soft edges. Corners are radiused on the same small scale throughout, so a
hundred drawings made months apart still look cut by the same hand. This
consistency is the labour: it is invisible when it works and the only thing
visible when it fails.

Colour is a closed vocabulary and a small one. Warm yellow carries the subject.
Blue carries what is cool, wet, distant or spoken. Orange is heat, welcome and
arrival. Green is assent, growth, the answer being yes. Red is refusal, alarm
and the heart, and outside those three it is never spent, so that it still
means something where it appears. Ink is the contour and the feature. Every
field is one of these and nothing between them; a colour mixed to taste is a
colour the next eight hundred drawings cannot reuse.

Every drawing sits on the same plate — one rounded rectangle of near-white,
inside the file rather than behind it. This is not decoration and it is not a
per-drawing choice. It is what lets an ink contour survive a dark interface
without a second asset, and one tint rather than three hundred is what lets a
deck of cards read as a set. A tint picked to flatter a single drawing is a
tint that makes it a stranger to the other three hundred and forty-seven.

Composition is centred and margined without exception: the subject sits in the
middle two-thirds, and the outer band stays empty. Rhythm comes from honest
repetition — rays at equal angles, drops on an even fall, confetti on a
scattered but deliberate grid — counted out rather than strewn, because the eye
reads a counted pattern as intention and a random one as noise. Scale is
generous; one subject filling its plate beats three subjects explaining each
other.

No word ever enters the drawing. The card already carries the sentence in the
language being learned and its meaning in the reader's own, and a picture that
spells anything is a picture that works in one language out of eight. This is
also why the marks — `?`, `OK`, `SOS`, `NEW` — were left to OpenMoji rather
than redrawn: a glyph that is already a piece of typography gains nothing from
being traced, and a hand-drawn copy of one is the fastest way to make a set
look inconsistent.

## The rules, so they can be checked

- Canvas 400×300, subject inside the centre 268×200, margin never encroached.
- Contour: 10 units, round cap, round join, one weight everywhere.
- Palette only: `#ffc409` `#ff571a` `#3b6cf6` `#009f70` `#e5484d` `#17191c`
  `#ffffff`, and the plate's `#f4f5f7`.
- Plate: full bleed, 28-unit radius, `#f4f5f7`, on every file without exception.
- `data-origin="langx"` on the `<svg>`, or `build.mjs` will overwrite it.
- No gradient, no blur, no shadow, no text.
- Legible at 64pt and at 240pt. Checked at both, not assumed.

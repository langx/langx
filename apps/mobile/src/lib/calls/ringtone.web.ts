/**
 * The ring and the ringback, made rather than played.
 *
 * Two short tones from the Web Audio API instead of a sound file. A file would
 * have to be chosen, licensed, bundled and then decoded before the first ring;
 * two sine waves need none of that, and a call's ring is the one sound in the
 * app that must not arrive late.
 *
 * **A browser may refuse.** A page is not allowed to start sound until
 * somebody has interacted with it, and a call can arrive in a tab nobody has
 * touched since it loaded. So the ring is never the only sign: the call screen
 * is up, and while the tab is not the one in front its title says who is
 * calling. Everything here fails silently for that reason — a refused ring is
 * a quiet call, not an error.
 */
type Kind = 'incoming' | 'outgoing'

/** Seconds on, seconds off, and the two frequencies sounded together. */
const PATTERNS: Record<Kind, { on: number; off: number; tones: [number, number]; gain: number }> = {
  // Brighter and more insistent: this one has to be noticed.
  incoming: { on: 1, off: 2, tones: [520, 660], gain: 0.12 },
  // The tone a caller has always heard, quieter: it is only reassurance.
  outgoing: { on: 2, off: 4, tones: [440, 480], gain: 0.05 },
}

let context: AudioContext | null = null
let timer: ReturnType<typeof setInterval> | null = null
let titleTimer: ReturnType<typeof setInterval> | null = null
let savedTitle: string | null = null

function burst(kind: Kind): void {
  if (!context) return
  const pattern = PATTERNS[kind]
  const now = context.currentTime
  const gain = context.createGain()
  // A short ramp at each end, or the tone starts and stops with a click.
  gain.gain.setValueAtTime(0, now)
  gain.gain.linearRampToValueAtTime(pattern.gain, now + 0.05)
  gain.gain.setValueAtTime(pattern.gain, now + pattern.on - 0.05)
  gain.gain.linearRampToValueAtTime(0, now + pattern.on)
  gain.connect(context.destination)
  for (const frequency of pattern.tones) {
    const oscillator = context.createOscillator()
    oscillator.frequency.value = frequency
    oscillator.connect(gain)
    oscillator.start(now)
    oscillator.stop(now + pattern.on)
  }
}

/**
 * `label` is put in the tab's title while an incoming call rings and the tab
 * is not the one being looked at — the only thing a background tab can show.
 */
export function startRinging(kind: Kind, label?: string): void {
  stopRinging()
  try {
    context = new AudioContext()
    void context.resume().catch(() => undefined)
    burst(kind)
    const pattern = PATTERNS[kind]
    timer = setInterval(() => burst(kind), (pattern.on + pattern.off) * 1000)
  } catch {
    context = null
  }

  if (kind === 'incoming' && label && typeof document !== 'undefined') {
    savedTitle = document.title
    let shown = false
    titleTimer = setInterval(() => {
      if (savedTitle === null) return
      // Only while it is hidden: in front, the call screen is the title.
      shown = document.hidden ? !shown : false
      document.title = shown ? label : savedTitle
    }, 1000)
  }
}

export function stopRinging(): void {
  if (timer) clearInterval(timer)
  timer = null
  if (titleTimer) clearInterval(titleTimer)
  titleTimer = null
  if (savedTitle !== null && typeof document !== 'undefined') document.title = savedTitle
  savedTitle = null
  if (context) void context.close().catch(() => undefined)
  context = null
}

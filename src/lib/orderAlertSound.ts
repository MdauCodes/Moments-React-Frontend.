// Looping two-tone alarm for new-order alerts, synthesised with Web Audio so there's no asset to
// ship. Browsers only allow audio after a user gesture on the page, so a first-interaction
// listener resumes the context ahead of time — staff have always clicked something (login,
// navigation) long before an order lands.

let ctx: AudioContext | null = null;
let timer: ReturnType<typeof setInterval> | null = null;

function getCtx(): AudioContext | null {
  if (typeof window === "undefined") return null;
  const Ctor =
    window.AudioContext ??
    (window as unknown as { webkitAudioContext?: typeof AudioContext }).webkitAudioContext;
  if (!Ctor) return null;
  if (!ctx) ctx = new Ctor();
  return ctx;
}

export function primeOrderAlertSound(): void {
  const unlock = () => {
    try {
      void getCtx()?.resume();
    } catch {
      /* audio unavailable — the visual alert still works */
    }
  };
  window.addEventListener("pointerdown", unlock, { once: true });
  window.addEventListener("keydown", unlock, { once: true });
}

function beep(c: AudioContext, freq: number, start: number, dur: number) {
  const osc = c.createOscillator();
  const gain = c.createGain();
  osc.type = "square";
  osc.frequency.value = freq;
  gain.gain.setValueAtTime(0.0001, start);
  gain.gain.exponentialRampToValueAtTime(0.25, start + 0.02);
  gain.gain.exponentialRampToValueAtTime(0.0001, start + dur);
  osc.connect(gain).connect(c.destination);
  osc.start(start);
  osc.stop(start + dur + 0.02);
}

function ring() {
  const c = getCtx();
  if (!c) return;
  void c.resume();
  const t = c.currentTime;
  beep(c, 988, t, 0.18);
  beep(c, 1319, t + 0.22, 0.18);
  beep(c, 988, t + 0.5, 0.18);
  beep(c, 1319, t + 0.72, 0.18);
}

export function startOrderAlertSound(): void {
  if (timer) return;
  try {
    ring();
    timer = setInterval(ring, 2500);
  } catch {
    /* audio unavailable */
  }
}

export function stopOrderAlertSound(): void {
  if (timer) clearInterval(timer);
  timer = null;
}

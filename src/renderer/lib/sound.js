// Everything the mascot sounds like, synthesised at runtime.
//
// No audio files anywhere: a desk pet that ships 4MB of samples to make eleven
// noises is not a good trade, and procedural tones can be pitched from state —
// a harder landing really is a lower, louder thud rather than the same clip
// played again. The whole module is a nicety, so every entry point swallows its
// own errors; audio failing must never take the mascot down with it.

const clamp01 = (v) => (v < 0 ? 0 : v > 1 ? 1 : v);

// Per-emotion-group voice. The mascot should not sound the same when it is
// delighted as when it is annoyed, and grouping keeps that to five timbres
// rather than forty-two.
const VOICES = {
  bright: { wave: 'sine', detune: 0, lift: 1.9 },      // happy, excited, love
  soft: { wave: 'sine', detune: -4, lift: 1.15 },      // content, sleepy, shy
  curious: { wave: 'triangle', detune: 0, lift: 1.5 }, // curious, alert
  spiky: { wave: 'sawtooth', detune: 8, lift: 0.62 },  // annoyed, angry
  hollow: { wave: 'square', detune: 0, lift: 0.8 },    // glitched, dizzy
};

const EMOTION_VOICE = {
  happy: 'bright', excited: 'bright', celebrating: 'bright', laughing: 'bright',
  love: 'bright', smitten: 'bright', proud: 'bright', wink: 'bright',
  content: 'soft', sleepy: 'soft', sleeping: 'soft', shy: 'soft', pleading: 'soft',
  sad: 'soft', bored: 'soft',
  curious: 'curious', confused: 'curious', thinking: 'curious', alert: 'curious',
  listening: 'curious', focused: 'curious', working: 'curious', peek: 'curious',
  annoyed: 'spiky', angry: 'spiky', skeptical: 'spiky', smug: 'spiky',
  glitched: 'hollow', dizzy: 'hollow', shocked: 'hollow', scared: 'hollow',
  surprised: 'hollow',

  // The wider roster. Anything unlisted falls back to 'soft', which is the
  // timbre that suits a bot saying something unremarkable.
  giggling: 'bright', beaming: 'bright', delighted: 'bright', adoring: 'bright',
  flirty: 'bright', giddy: 'bright', teasing: 'bright', highfiving: 'bright',
  triumphant: 'bright', cheering: 'bright', starstruck: 'bright', playful: 'bright',
  eureka: 'bright', singing: 'bright', caffeinated: 'bright', hiccuping: 'bright',
  touched: 'soft', wistful: 'soft', drained: 'soft', moping: 'soft',
  heartbroken: 'soft', disappointed: 'soft', guilty: 'soft', cozy: 'soft',
  grateful: 'soft', apologetic: 'soft', lonely: 'soft', zen: 'soft', numb: 'soft',
  plotting: 'curious', calculating: 'curious', pondering: 'curious',
  inspecting: 'curious', eavesdropping: 'curious', waiting: 'curious',
  counting: 'curious', buffering: 'curious', spying: 'curious', sneaking: 'curious',
  determined: 'curious', reading: 'curious', searching: 'curious',
  grumpy: 'spiky', furious: 'spiky', offended: 'spiky', jealous: 'spiky',
  betrayed: 'spiky', unimpressed: 'spiky', sarcastic: 'spiky', defiant: 'spiky',
  stubborn: 'spiky', gloating: 'spiky', exasperated: 'spiky', sulking: 'spiky',
  spooked: 'hollow', paranoid: 'hollow', panicking: 'hollow', cringing: 'hollow',
  flustered: 'hollow', queasy: 'hollow', glitching: 'hollow', disoriented: 'hollow',
};

export class Sound {
  constructor() {
    this.ctx = null;
    this.master = null;
    this.enabled = false;
    this.volume = 0.5;
    this.hum = null;
    this.purrLoop = null;
    this.noiseBuffer = null;
  }

  set({ enabled, volume }) {
    if (enabled !== undefined) this.enabled = !!enabled;
    if (volume !== undefined) this.volume = clamp01(Number(volume) || 0);
    if (this.master) this.master.gain.value = this.volume * 0.55;
    if (!this.enabled) { this.stopHum(); this.stopPurr(); }
  }

  // Fire a cue by name. Moves name their sound as a string, and a typo there
  // must be silent rather than a crash halfway through a gesture.
  cue(name, ...args) {
    if (typeof name === 'string' && typeof this[name] === 'function') this[name](...args);
  }

  _ready() {
    if (!this.enabled) return null;
    try {
      if (!this.ctx) {
        const Ctor = window.AudioContext || window.webkitAudioContext;
        if (!Ctor) return null;
        this.ctx = new Ctor();
        this.master = this.ctx.createGain();
        this.master.gain.value = this.volume * 0.55;
        this.master.connect(this.ctx.destination);
      }
      // Some contexts start suspended until there has been a user gesture.
      if (this.ctx.state === 'suspended') this.ctx.resume().catch(() => {});
      return this.ctx;
    } catch {
      return null;
    }
  }

  // One shaped tone. `glide` sweeps to a second frequency, which is what makes
  // a throw whistle and a landing thump out of the same primitive.
  tone({ f = 440, to = null, d = 0.1, v = 0.06, wave = 'sine', delay = 0, detune = 0 }) {
    const ctx = this._ready();
    if (!ctx) return;
    try {
      const t = ctx.currentTime + delay;
      const osc = ctx.createOscillator();
      const gain = ctx.createGain();
      osc.type = wave;
      osc.detune.value = detune;
      osc.frequency.setValueAtTime(Math.max(20, f), t);
      if (to && to !== f) {
        osc.frequency.exponentialRampToValueAtTime(Math.max(20, to), t + d);
      }
      // A short attack stops every note starting with a click.
      gain.gain.setValueAtTime(0.0001, t);
      gain.gain.exponentialRampToValueAtTime(Math.max(0.0002, v), t + Math.min(0.012, d * 0.3));
      gain.gain.exponentialRampToValueAtTime(0.0001, t + d);
      osc.connect(gain).connect(this.master);
      osc.start(t);
      osc.stop(t + d + 0.03);
    } catch { /* never fatal */ }
  }

  // Filtered noise — the body of a thud, a bounce or a dust puff.
  burst({ d = 0.16, v = 0.09, cutoff = 900, type = 'lowpass' } = {}) {
    const ctx = this._ready();
    if (!ctx) return;
    try {
      if (!this.noiseBuffer) {
        const len = Math.floor(ctx.sampleRate * 0.4);
        const buf = ctx.createBuffer(1, len, ctx.sampleRate);
        const data = buf.getChannelData(0);
        for (let i = 0; i < len; i++) data[i] = Math.random() * 2 - 1;
        this.noiseBuffer = buf;
      }
      const t = ctx.currentTime;
      const src = ctx.createBufferSource();
      src.buffer = this.noiseBuffer;
      const filter = ctx.createBiquadFilter();
      filter.type = type;
      filter.frequency.setValueAtTime(cutoff, t);
      const gain = ctx.createGain();
      gain.gain.setValueAtTime(v, t);
      gain.gain.exponentialRampToValueAtTime(0.0001, t + d);
      src.connect(filter).connect(gain).connect(this.master);
      src.start(t);
      src.stop(t + d + 0.02);
    } catch { /* never fatal */ }
  }

  // ---- the actual cues ----------------------------------------------------

  poke() { this.tone({ f: 620, to: 900, d: 0.09, v: 0.05 }); }

  pop() { this.tone({ f: 300, to: 150, d: 0.12, v: 0.06, wave: 'triangle' }); }

  // Impact: heavier landings are lower, louder and dirtier.
  land(speed = 400) {
    const hard = clamp01(speed / 1600);
    this.burst({ d: 0.1 + hard * 0.12, v: 0.05 + hard * 0.11, cutoff: 380 + hard * 700 });
    this.tone({ f: 150 - hard * 60, to: 60, d: 0.14 + hard * 0.1, v: 0.05 + hard * 0.07, wave: 'sine' });
  }

  bounce(speed = 400) {
    const hard = clamp01(speed / 1400);
    this.tone({ f: 240 + hard * 180, to: 90, d: 0.16, v: 0.04 + hard * 0.05, wave: 'sawtooth' });
  }

  // A rising whistle that tracks how hard it was thrown.
  whoosh(speed = 1000) {
    const hard = clamp01(speed / 2600);
    this.burst({ d: 0.22, v: 0.03 + hard * 0.04, cutoff: 1400 + hard * 2600, type: 'bandpass' });
    this.tone({ f: 300 + hard * 200, to: 1100 + hard * 900, d: 0.26, v: 0.03 + hard * 0.03, wave: 'sine' });
  }

  type() { this.tone({ f: 1500, d: 0.012, v: 0.012, wave: 'square' }); }

  // Two notes in the emotion's own timbre — the mascot's "voice".
  emote(key) {
    const voice = VOICES[EMOTION_VOICE[key] || 'soft'];
    const base = 380 * voice.lift;
    this.tone({ f: base, to: base * 1.18, d: 0.1, v: 0.035, wave: voice.wave, detune: voice.detune });
    this.tone({ f: base * 1.5, to: base * 1.5, d: 0.09, v: 0.022, wave: voice.wave, delay: 0.075, detune: voice.detune });
  }

  // A timer going off has to cut through whatever you are doing.
  chime(urgent = false) {
    const notes = urgent ? [880, 1174, 880, 1174] : [660, 880, 1320];
    notes.forEach((f, i) => {
      this.tone({ f, to: f, d: 0.28, v: 0.09, wave: 'sine', delay: i * 0.16 });
      this.tone({ f: f * 2, to: f * 2, d: 0.2, v: 0.03, wave: 'sine', delay: i * 0.16 });
    });
  }

  celebrate() {
    [523, 659, 784, 1046].forEach((f, i) => {
      this.tone({ f, to: f * 1.01, d: 0.3, v: 0.07, wave: 'triangle', delay: i * 0.09 });
    });
  }

  // ---- the gesture cues ---------------------------------------------------
  // One per move in moves.js. Each is a couple of primitives at most: the point
  // is that a backflip and a sneeze sound like different events, not that either
  // is a finished sound effect.

  blip() { this.tone({ f: 880, to: 1200, d: 0.06, v: 0.04, wave: 'triangle' }); }

  boing() {
    // A struck spring: pitch overshoots, then wobbles back down.
    this.tone({ f: 180, to: 520, d: 0.09, v: 0.06, wave: 'triangle' });
    this.tone({ f: 520, to: 240, d: 0.22, v: 0.05, wave: 'triangle', delay: 0.09 });
    this.tone({ f: 300, to: 260, d: 0.14, v: 0.02, wave: 'sine', delay: 0.26 });
  }

  whistleUp() {
    this.tone({ f: 380, to: 1500, d: 0.34, v: 0.035, wave: 'sine' });
  }

  // Bigger than `celebrate`: a rising arpeggio that lands on a held third.
  fanfare() {
    [523, 659, 784, 1046].forEach((f, i) => {
      this.tone({ f, to: f, d: 0.22, v: 0.075, wave: 'triangle', delay: i * 0.11 });
    });
    [784, 1046, 1318].forEach((f) => {
      this.tone({ f, to: f, d: 0.5, v: 0.045, wave: 'sine', delay: 0.46 });
    });
  }

  // Clapping is many small broadband bursts with irregular spacing — regular
  // spacing reads as a machine rather than as hands.
  applause() {
    let t = 0;
    for (let i = 0; i < 14; i++) {
      this.burst({ d: 0.06, v: 0.028 + Math.random() * 0.02, cutoff: 1800 + Math.random() * 1800, type: 'bandpass' });
      t += 0.055 + Math.random() * 0.05;
      if (t > 1.2) break;
    }
  }

  thump() {
    this.burst({ d: 0.09, v: 0.06, cutoff: 300 });
    this.tone({ f: 110, to: 48, d: 0.18, v: 0.08, wave: 'sine' });
  }

  sparkleUp() {
    [1046, 1318, 1568, 2093].forEach((f, i) => {
      this.tone({ f, to: f * 1.02, d: 0.12, v: 0.028, wave: 'sine', delay: i * 0.06 });
    });
  }

  zap() {
    this.tone({ f: 1800, to: 180, d: 0.11, v: 0.05, wave: 'sawtooth' });
    this.burst({ d: 0.08, v: 0.04, cutoff: 3000, type: 'highpass' });
  }

  // Shivering: a low tone chopped into fast beats.
  brr() {
    for (let i = 0; i < 9; i++) {
      this.tone({ f: 150 + (i % 2) * 24, to: 140, d: 0.05, v: 0.03, wave: 'triangle', delay: i * 0.07 });
    }
  }

  buzz() { this.tone({ f: 92, to: 88, d: 0.5, v: 0.045, wave: 'square', detune: 12 }); }

  glitch() {
    for (let i = 0; i < 6; i++) {
      this.tone({
        f: 200 + Math.random() * 2200, d: 0.03, v: 0.03,
        wave: Math.random() < 0.5 ? 'square' : 'sawtooth', delay: i * 0.045,
      });
    }
  }

  grumble() {
    this.tone({ f: 78, to: 62, d: 0.55, v: 0.055, wave: 'sawtooth', detune: -12 });
    this.tone({ f: 116, to: 96, d: 0.5, v: 0.022, wave: 'triangle', delay: 0.04 });
  }

  huff() {
    this.burst({ d: 0.16, v: 0.05, cutoff: 800, type: 'bandpass' });
    this.tone({ f: 220, to: 150, d: 0.16, v: 0.03, wave: 'triangle' });
  }

  hmph() { this.tone({ f: 300, to: 190, d: 0.18, v: 0.045, wave: 'triangle', detune: -6 }); }

  sigh() {
    this.burst({ d: 0.55, v: 0.035, cutoff: 900, type: 'bandpass' });
    this.tone({ f: 320, to: 190, d: 0.55, v: 0.03, wave: 'sine' });
  }

  squish() {
    this.burst({ d: 0.14, v: 0.05, cutoff: 600 });
    this.tone({ f: 420, to: 120, d: 0.16, v: 0.035, wave: 'triangle' });
  }

  inflate() { this.tone({ f: 140, to: 520, d: 0.7, v: 0.035, wave: 'triangle' }); }

  deflate() {
    this.tone({ f: 520, to: 90, d: 0.6, v: 0.04, wave: 'triangle' });
    this.burst({ d: 0.5, v: 0.025, cutoff: 1400, type: 'bandpass' });
  }

  // Pitch swinging around a centre: the sound of something not quite solid.
  wobble() {
    for (let i = 0; i < 7; i++) {
      const f = 300 + Math.sin(i * 1.5) * 130 * Math.exp(-i * 0.22);
      this.tone({ f, to: f, d: 0.1, v: 0.032, wave: 'sine', delay: i * 0.08 });
    }
  }

  yawn() {
    this.tone({ f: 190, to: 430, d: 0.6, v: 0.035, wave: 'sine' });
    this.tone({ f: 430, to: 160, d: 0.7, v: 0.035, wave: 'sine', delay: 0.6 });
    this.burst({ d: 1.1, v: 0.018, cutoff: 700, type: 'bandpass' });
  }

  sneeze() {
    // Inhale, then everything at once.
    this.burst({ d: 0.32, v: 0.022, cutoff: 1200, type: 'bandpass' });
    this.tone({ f: 300, to: 620, d: 0.3, v: 0.02, wave: 'sine' });
    this.burst({ d: 0.24, v: 0.09, cutoff: 2600, type: 'bandpass' });
    this.tone({ f: 900, to: 200, d: 0.22, v: 0.05, wave: 'sawtooth', delay: 0.34 });
  }

  hiccup() {
    this.tone({ f: 620, to: 900, d: 0.05, v: 0.045, wave: 'triangle' });
    this.tone({ f: 300, to: 200, d: 0.09, v: 0.035, wave: 'sine', delay: 0.06 });
  }

  // Little feet. Many very short clicks, slightly irregular.
  scurry() {
    for (let i = 0; i < 12; i++) {
      this.tone({ f: 900 + Math.random() * 400, d: 0.02, v: 0.02, wave: 'square', delay: i * 0.09 });
    }
  }

  tiptoe() {
    for (let i = 0; i < 6; i++) {
      this.tone({ f: 1400 + Math.random() * 300, d: 0.015, v: 0.01, wave: 'sine', delay: i * 0.28 });
    }
  }

  // ---- the voice ----------------------------------------------------------
  // A blip per typed character, pitched by whatever the bot is feeling. This is
  // the difference between a speech bubble that types and a character that is
  // saying something: the same sentence sounds sulky when it is sulking.
  voice(emotion) {
    const voice = VOICES[EMOTION_VOICE[emotion] || 'soft'];
    const base = 300 * voice.lift;
    // A small random walk around the base pitch keeps a long line from reading
    // as a modem. Vowel-ish rather than melodic.
    const f = base * (0.86 + Math.random() * 0.34);
    this.tone({ f, to: f * (0.96 + Math.random() * 0.1), d: 0.045, v: 0.016, wave: voice.wave, detune: voice.detune });
  }

  // A one-shot purr, for the moves that want a single beat of it.
  purr() {
    for (let i = 0; i < 5; i++) {
      this.tone({ f: 68, to: 62, d: 0.1, v: 0.035, wave: 'sawtooth', delay: i * 0.11, detune: -8 });
    }
  }

  // Continuous purring while it is being petted. Same start/stop discipline as
  // the sleep hum, and it shares the guard so the two can never overlap.
  startPurr() {
    const ctx = this._ready();
    if (!ctx || this.purrLoop) return;
    try {
      const osc = ctx.createOscillator();
      const gain = ctx.createGain();
      const filter = ctx.createBiquadFilter();
      const lfo = ctx.createOscillator();
      const lfoGain = ctx.createGain();
      osc.type = 'sawtooth';
      osc.frequency.value = 58;
      filter.type = 'lowpass';
      filter.frequency.value = 320;
      gain.gain.value = 0.0001;
      gain.gain.exponentialRampToValueAtTime(0.03, ctx.currentTime + 0.2);
      // ~24 pulses a second is the rate a real purr sits at.
      lfo.frequency.value = 24;
      lfoGain.gain.value = 0.022;
      lfo.connect(lfoGain).connect(gain.gain);
      osc.connect(filter).connect(gain).connect(this.master);
      osc.start();
      lfo.start();
      this.purrLoop = { osc, lfo, gain };
    } catch { /* never fatal */ }
  }

  stopPurr() {
    if (!this.purrLoop) return;
    try {
      const { osc, lfo, gain } = this.purrLoop;
      const t = this.ctx.currentTime;
      gain.gain.cancelScheduledValues(t);
      gain.gain.setValueAtTime(Math.max(0.0001, gain.gain.value), t);
      gain.gain.exponentialRampToValueAtTime(0.0001, t + 0.3);
      osc.stop(t + 0.35);
      lfo.stop(t + 0.35);
    } catch { /* already gone */ }
    this.purrLoop = null;
  }

  // A very quiet, very slow breathing tone while it sleeps. Started and stopped
  // rather than retriggered, so it is genuinely continuous.
  startHum() {
    const ctx = this._ready();
    if (!ctx || this.hum) return;
    try {
      const osc = ctx.createOscillator();
      const gain = ctx.createGain();
      const lfo = ctx.createOscillator();
      const lfoGain = ctx.createGain();
      osc.type = 'sine';
      osc.frequency.value = 96;
      gain.gain.value = 0.014;
      // ~13 breaths a minute.
      lfo.frequency.value = 0.22;
      lfoGain.gain.value = 0.011;
      lfo.connect(lfoGain).connect(gain.gain);
      osc.connect(gain).connect(this.master);
      osc.start();
      lfo.start();
      this.hum = { osc, lfo, gain };
    } catch { /* never fatal */ }
  }

  stopHum() {
    if (!this.hum) return;
    try {
      const { osc, lfo, gain } = this.hum;
      const t = this.ctx.currentTime;
      gain.gain.cancelScheduledValues(t);
      gain.gain.setValueAtTime(Math.max(0.0001, gain.gain.value), t);
      gain.gain.exponentialRampToValueAtTime(0.0001, t + 0.4);
      osc.stop(t + 0.45);
      lfo.stop(t + 0.45);
    } catch { /* already gone */ }
    this.hum = null;
  }
}

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
};

export class Sound {
  constructor() {
    this.ctx = null;
    this.master = null;
    this.enabled = false;
    this.volume = 0.5;
    this.hum = null;
    this.noiseBuffer = null;
  }

  set({ enabled, volume }) {
    if (enabled !== undefined) this.enabled = !!enabled;
    if (volume !== undefined) this.volume = clamp01(Number(volume) || 0);
    if (this.master) this.master.gain.value = this.volume * 0.55;
    if (!this.enabled) this.stopHum();
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

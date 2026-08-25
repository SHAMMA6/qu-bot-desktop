// Every emotion is a complete performance, not just a face: which of the 25 eye
// rings to wear, how the body breathes/sways/leans, how often it blinks, where
// it looks, and what floats off it.
//
// Fields:
//   expr        index into DATA.expressions (the eye geometry)
//   eye         extra scale on the eyes (1 = as authored)
//   breathe     {amp, rate}  volume-preserving squash, amp is a fraction
//   bob         {amp, rate}  vertical drift in viewBox units
//   sway        {amp, rate}  rotation in degrees
//   lean        constant tilt in degrees (posture)
//   scale       overall size multiplier
//   yOffset     constant vertical offset (slumping / puffing up)
//   blink       [minSeconds, maxSeconds]; null disables blinking
//   gaze        'follow' | 'fixed' | 'wander' | 'away' | 'down'
//   gazeGain    how far the eyes travel toward the target
//   lidBias     constant partial eyelid closure, 0..0.9 (blinks layer on top)
//   jitter      high-frequency shake amplitude
//   blush/star  0..1 accent opacity
//   fx          particle emitter name
//   hold        seconds before drifting back to idle (null = indefinite)
//   settle      morph speed into this emotion (higher = snappier)

export const EMOTIONS = {
  // ---------------- baseline ----------------
  idle: {
    label: 'Idle', emoji: '\u{1F642}', expr: 10, eye: 1,
    breathe: { amp: 0.014, rate: 0.5 }, bob: { amp: 2.2, rate: 0.42 }, sway: { amp: 1.5, rate: 0.29 },
    lean: 0, scale: 1, yOffset: 0, blink: [2.4, 7], gaze: 'follow', gazeGain: 1,
    jitter: 0, blush: 0, star: 0, fx: null, hold: null, settle: 5,
  },
  neutral: {
    label: 'Neutral', emoji: '\u{1F610}', expr: 1, eye: 1,
    breathe: { amp: 0.011, rate: 0.45 }, bob: { amp: 1.6, rate: 0.38 }, sway: { amp: 0.9, rate: 0.25 },
    lean: 0, scale: 1, yOffset: 0, blink: [3, 8], gaze: 'follow', gazeGain: 0.8,
    jitter: 0, blush: 0, star: 0, fx: null, hold: null, settle: 5,
  },

  // ---------------- warm ----------------
  happy: {
    label: 'Happy', emoji: '\u{1F60A}', expr: 4, eye: 1.05,
    breathe: { amp: 0.035, rate: 1.5 }, bob: { amp: 5.5, rate: 1.5 }, sway: { amp: 3.2, rate: 1.1 },
    lean: 0, scale: 1.02, yOffset: -2, blink: [3, 7], gaze: 'follow', gazeGain: 0.9,
    jitter: 0, blush: 0.18, star: 0, fx: null, hold: 5, settle: 8,
  },
  content: {
    label: 'Content', emoji: '\u{1F60C}', expr: 4, eye: 1,
    breathe: { amp: 0.02, rate: 0.5 }, bob: { amp: 2.4, rate: 0.4 }, sway: { amp: 1.8, rate: 0.3 },
    lean: 2, scale: 1, yOffset: 0, blink: null, gaze: 'fixed', gazeGain: 0,
    lidBias: 0.1, jitter: 0, blush: 0.14, star: 0, fx: null, hold: 6, settle: 4,
  },
  excited: {
    label: 'Excited', emoji: '\u{1F929}', expr: 2, eye: 1.06,
    breathe: { amp: 0.06, rate: 3.4 }, bob: { amp: 9, rate: 3.1 }, sway: { amp: 5.5, rate: 2.6 },
    lean: 0, scale: 1.05, yOffset: -4, blink: [1.4, 3], gaze: 'follow', gazeGain: 1.2,
    jitter: 0.8, blush: 0.2, star: 0, fx: 'sparkle', hold: 4.5, settle: 12,
  },
  love: {
    label: 'Smitten', emoji: '\u{1F970}', expr: 2, eye: 1.1,
    breathe: { amp: 0.055, rate: 1.15 }, bob: { amp: 4, rate: 1.1 }, sway: { amp: 2.6, rate: 0.8 },
    lean: 0, scale: 1.04, yOffset: -2, blink: [3.5, 8], gaze: 'follow', gazeGain: 1.1,
    jitter: 0, blush: 0.55, star: 0, fx: 'heart', hold: 6, settle: 7,
  },
  laughing: {
    label: 'Laughing', emoji: '\u{1F604}', expr: 4, eye: 1.05,
    breathe: { amp: 0.075, rate: 6.5 }, bob: { amp: 6, rate: 6.2 }, sway: { amp: 6.5, rate: 5.4 },
    lean: 0, scale: 1.03, yOffset: -3, blink: null, gaze: 'fixed', gazeGain: 0,
    jitter: 1.1, blush: 0.3, star: 0, fx: 'note', hold: 3.6, settle: 14,
  },
  celebrating: {
    label: 'Celebrating', emoji: '\u{1F389}', expr: 2, eye: 1.08,
    breathe: { amp: 0.07, rate: 3.8 }, bob: { amp: 12, rate: 2.4 }, sway: { amp: 8, rate: 1.9 },
    lean: 0, scale: 1.06, yOffset: -6, blink: [2, 4], gaze: 'wander', gazeGain: 1,
    jitter: 0.5, blush: 0.25, star: 1, fx: 'confetti', hold: 5, settle: 12,
  },
  proud: {
    label: 'Proud', emoji: '\u{1F60E}', expr: 13, eye: 1,
    breathe: { amp: 0.03, rate: 0.6 }, bob: { amp: 2, rate: 0.45 }, sway: { amp: 1.2, rate: 0.3 },
    lean: -3, scale: 1.07, yOffset: -6, blink: [4, 9], gaze: 'away', gazeGain: 0.4,
    lidBias: 0.12, jitter: 0, blush: 0, star: 0.85, fx: null, hold: 5, settle: 6,
  },
  smug: {
    label: 'Smug', emoji: '\u{1F60F}', expr: 22, eye: 1,
    breathe: { amp: 0.018, rate: 0.7 }, bob: { amp: 1.6, rate: 0.5 }, sway: { amp: 1, rate: 0.35 },
    lean: -7, scale: 1.01, yOffset: 0, blink: [4, 9], gaze: 'away', gazeGain: 0.5,
    lidBias: 0.18, jitter: 0, blush: 0, star: 0, fx: null, hold: 4, settle: 6,
  },
  wink: {
    label: 'Wink', emoji: '\u{1F609}', expr: 14, eye: 1.02,
    breathe: { amp: 0.03, rate: 1.2 }, bob: { amp: 3, rate: 1 }, sway: { amp: 3, rate: 0.9 },
    lean: 4, scale: 1.02, yOffset: -1, blink: null, gaze: 'follow', gazeGain: 0.9,
    jitter: 0, blush: 0.2, star: 0, fx: null, hold: 1.8, settle: 14,
  },
  shy: {
    label: 'Shy', emoji: '\u{263A}\u{FE0F}', expr: 24, eye: 0.95,
    breathe: { amp: 0.02, rate: 0.9 }, bob: { amp: 1.6, rate: 0.7 }, sway: { amp: 2.4, rate: 0.55 },
    lean: 6, scale: 0.94, yOffset: 5, blink: [1.6, 4], gaze: 'away', gazeGain: 0.8,
    jitter: 0, blush: 0.65, star: 0, fx: null, hold: 4.5, settle: 6,
  },

  // ---------------- attention ----------------
  curious: {
    label: 'Curious', emoji: '\u{1F914}', expr: 18, eye: 1.04,
    breathe: { amp: 0.02, rate: 0.8 }, bob: { amp: 2.4, rate: 0.6 }, sway: { amp: 1.4, rate: 0.4 },
    lean: 13, scale: 1.01, yOffset: -1, blink: [1.8, 4.5], gaze: 'follow', gazeGain: 1.15,
    jitter: 0, blush: 0, star: 0, fx: 'question', hold: 4, settle: 7,
  },
  confused: {
    label: 'Confused', emoji: '\u{1F615}', expr: 9, eye: 1,
    breathe: { amp: 0.022, rate: 0.7 }, bob: { amp: 2, rate: 0.55 }, sway: { amp: 3.4, rate: 0.5 },
    lean: -11, scale: 1, yOffset: 0, blink: [1.4, 3.4], gaze: 'wander', gazeGain: 1,
    jitter: 0, blush: 0, star: 0, fx: 'question', hold: 4, settle: 7,
  },
  thinking: {
    label: 'Thinking', emoji: '\u{1F4AD}', expr: 8, eye: 1,
    breathe: { amp: 0.016, rate: 0.45 }, bob: { amp: 2.6, rate: 0.35 }, sway: { amp: 2.2, rate: 0.22 },
    lean: 5, scale: 1, yOffset: 0, blink: [2.6, 6], gaze: 'fixed', gazeGain: 0,
    jitter: 0, blush: 0, star: 0, fx: 'think', hold: null, settle: 4,
  },
  focused: {
    label: 'Focused', emoji: '\u{1F9D0}', expr: 6, eye: 0.98,
    breathe: { amp: 0.01, rate: 0.9 }, bob: { amp: 0.9, rate: 0.7 }, sway: { amp: 0.5, rate: 0.4 },
    lean: 0, scale: 1, yOffset: 0, blink: [3.5, 9], gaze: 'follow', gazeGain: 1.3,
    jitter: 0, blush: 0, star: 0, fx: null, hold: null, settle: 8,
  },
  working: {
    label: 'Working', emoji: '\u{2699}\u{FE0F}', expr: 6, eye: 0.98,
    breathe: { amp: 0.026, rate: 2.1 }, bob: { amp: 2.2, rate: 2 }, sway: { amp: 2.8, rate: 1.55 },
    lean: 0, scale: 1, yOffset: 0, blink: [2.5, 6], gaze: 'wander', gazeGain: 0.5,
    jitter: 0, blush: 0, star: 0, fx: 'orbit', hold: null, settle: 6,
  },
  listening: {
    label: 'Listening', emoji: '\u{1F442}', expr: 10, eye: 1.03,
    breathe: { amp: 0.02, rate: 0.75 }, bob: { amp: 1.8, rate: 0.6 }, sway: { amp: 1, rate: 0.35 },
    lean: 8, scale: 1.02, yOffset: -2, blink: [2, 5], gaze: 'follow', gazeGain: 1.25,
    jitter: 0, blush: 0, star: 0, fx: null, hold: null, settle: 8,
  },
  talking: {
    label: 'Talking', emoji: '\u{1F4AC}', expr: 1, eye: 1,
    breathe: { amp: 0.03, rate: 3.6 }, bob: { amp: 2.4, rate: 3.2 }, sway: { amp: 1.8, rate: 1.2 },
    lean: 0, scale: 1.01, yOffset: 0, blink: [2.4, 6], gaze: 'follow', gazeGain: 1,
    jitter: 0, blush: 0, star: 0, fx: null, hold: null, settle: 9,
  },
  alert: {
    label: 'Alert', emoji: '\u{2757}', expr: 0, eye: 1.05,
    breathe: { amp: 0.05, rate: 4.2 }, bob: { amp: 5, rate: 3.6 }, sway: { amp: 2, rate: 2.4 },
    lean: 0, scale: 1.04, yOffset: -3, blink: [1.2, 3], gaze: 'follow', gazeGain: 1.1,
    jitter: 0.6, blush: 0, star: 0, fx: 'ping', hold: 6, settle: 16,
  },

  // ---------------- surprise ----------------
  surprised: {
    label: 'Surprised', emoji: '\u{1F62E}', expr: 2, eye: 1.12,
    breathe: { amp: 0.02, rate: 1 }, bob: { amp: 2, rate: 0.8 }, sway: { amp: 1, rate: 0.5 },
    lean: 0, scale: 1.08, yOffset: -5, blink: [3, 7], gaze: 'follow', gazeGain: 1.2,
    jitter: 0.3, blush: 0, star: 0, fx: null, hold: 2.2, settle: 20,
  },
  shocked: {
    label: 'Shocked', emoji: '\u{1F632}', expr: 11, eye: 1.14,
    breathe: { amp: 0.03, rate: 5 }, bob: { amp: 2, rate: 4 }, sway: { amp: 1.4, rate: 3.4 },
    lean: 0, scale: 1.1, yOffset: -6, blink: null, gaze: 'follow', gazeGain: 1.3,
    jitter: 1.6, blush: 0, star: 0, fx: 'shock', hold: 2.4, settle: 22,
  },
  scared: {
    label: 'Scared', emoji: '\u{1F628}', expr: 11, eye: 1.08,
    breathe: { amp: 0.045, rate: 7 }, bob: { amp: 1.6, rate: 5 }, sway: { amp: 1.2, rate: 4.6 },
    lean: 0, scale: 0.92, yOffset: 7, blink: null, gaze: 'away', gazeGain: 1.1,
    jitter: 2.2, blush: 0, star: 0, fx: 'sweat', hold: 3.5, settle: 18,
  },

  // ---------------- low ----------------
  sad: {
    label: 'Sad', emoji: '\u{1F61E}', expr: 17, eye: 1.02,
    breathe: { amp: 0.02, rate: 0.32 }, bob: { amp: 1.6, rate: 0.26 }, sway: { amp: 1.6, rate: 0.2 },
    lean: 0, scale: 0.96, yOffset: 9, blink: [2.6, 6], gaze: 'down', gazeGain: 0.6,
    jitter: 0, blush: 0, star: 0, fx: 'tear', hold: 6, settle: 4,
  },
  pleading: {
    label: 'Pleading', emoji: '\u{1F97A}', expr: 20, eye: 1.06,
    breathe: { amp: 0.03, rate: 1.3 }, bob: { amp: 2.6, rate: 1.1 }, sway: { amp: 3.6, rate: 0.85 },
    lean: 0, scale: 1.02, yOffset: 4, blink: [2, 5], gaze: 'follow', gazeGain: 1.2,
    jitter: 0.2, blush: 0.3, star: 0, fx: null, hold: 5, settle: 7,
  },
  bored: {
    label: 'Bored', emoji: '\u{1F971}', expr: 22, eye: 1,
    breathe: { amp: 0.018, rate: 0.26 }, bob: { amp: 2.6, rate: 0.2 }, sway: { amp: 4.2, rate: 0.16 },
    lean: -6, scale: 0.99, yOffset: 5, blink: [1.2, 3], gaze: 'wander', gazeGain: 0.5,
    lidBias: 0.28, jitter: 0, blush: 0, star: 0, fx: null, hold: 8, settle: 3,
  },
  sleepy: {
    label: 'Sleepy', emoji: '\u{1F62A}', expr: 1, eye: 1,
    breathe: { amp: 0.026, rate: 0.24 }, bob: { amp: 3.2, rate: 0.2 }, sway: { amp: 3, rate: 0.14 },
    lean: 7, scale: 0.98, yOffset: 7, blink: [0.9, 2.4], gaze: 'down', gazeGain: 0.4,
    lidBias: 0.52, jitter: 0, blush: 0.1, star: 0, fx: null, hold: null, settle: 3,
  },
  sleeping: {
    label: 'Asleep', emoji: '\u{1F4A4}', expr: 4, eye: 1,
    breathe: { amp: 0.045, rate: 0.28 }, bob: { amp: 4.5, rate: 0.28 }, sway: { amp: 2.2, rate: 0.12 },
    lean: 9, scale: 0.96, yOffset: 9, blink: null, gaze: 'fixed', gazeGain: 0,
    jitter: 0, blush: 0.12, star: 0, fx: 'sleep', hold: null, settle: 2,
  },

  // ---------------- spiky ----------------
  annoyed: {
    label: 'Annoyed', emoji: '\u{1F612}', expr: 23, eye: 1,
    breathe: { amp: 0.02, rate: 0.9 }, bob: { amp: 1.4, rate: 0.7 }, sway: { amp: 1, rate: 0.45 },
    lean: -9, scale: 1, yOffset: 2, blink: [3, 7], gaze: 'away', gazeGain: 0.7,
    lidBias: 0.24, jitter: 0, blush: 0, star: 0, fx: null, hold: 4, settle: 7,
  },
  angry: {
    label: 'Angry', emoji: '\u{1F620}', expr: 7, eye: 1.02,
    breathe: { amp: 0.055, rate: 5.5 }, bob: { amp: 2, rate: 4.4 }, sway: { amp: 2.4, rate: 3.8 },
    lean: 0, scale: 1.05, yOffset: -2, blink: [4, 9], gaze: 'follow', gazeGain: 1.2,
    jitter: 1.8, blush: 0, star: 0, fx: 'steam', hold: 3.5, settle: 16,
  },
  skeptical: {
    label: 'Skeptical', emoji: '\u{1F928}', expr: 5, eye: 1,
    breathe: { amp: 0.015, rate: 0.7 }, bob: { amp: 1.4, rate: 0.55 }, sway: { amp: 0.8, rate: 0.35 },
    lean: -5, scale: 1, yOffset: 0, blink: [3.5, 8], gaze: 'follow', gazeGain: 1.1,
    lidBias: 0.16, jitter: 0, blush: 0, star: 0, fx: null, hold: 4, settle: 7,
  },
  error: {
    label: 'Glitched', emoji: '\u{26A0}\u{FE0F}', expr: 9, eye: 1.04,
    breathe: { amp: 0.06, rate: 9 }, bob: { amp: 2.6, rate: 7 }, sway: { amp: 3.6, rate: 6 },
    lean: 0, scale: 1.02, yOffset: 0, blink: [0.4, 1.1], gaze: 'wander', gazeGain: 1.4,
    jitter: 2.6, blush: 0, star: 0, fx: 'glitch', hold: 3, settle: 20,
  },
  dizzy: {
    label: 'Dizzy', emoji: '\u{1F635}', expr: 21, eye: 1.05,
    breathe: { amp: 0.05, rate: 2.4 }, bob: { amp: 4, rate: 1.7 }, sway: { amp: 14, rate: 1.5 },
    lean: 0, scale: 1, yOffset: 2, blink: [1.4, 3], gaze: 'wander', gazeGain: 1.4,
    jitter: 0.6, blush: 0.2, star: 0, fx: 'swirl', hold: 4, settle: 8,
  },

  // ---------------- handling ----------------
  held: {
    label: 'Held', emoji: '\u{270B}', expr: 11, eye: 1.05,
    breathe: { amp: 0.03, rate: 2.2 }, bob: { amp: 1.4, rate: 1.6 }, sway: { amp: 1, rate: 1 },
    lean: 0, scale: 1.03, yOffset: -3, blink: [1.6, 4], gaze: 'follow', gazeGain: 1.3,
    jitter: 0.3, blush: 0.15, star: 0, fx: null, hold: null, settle: 14,
  },
  falling: {
    label: 'Falling', emoji: '\u{1F4AB}', expr: 2, eye: 1.1,
    breathe: { amp: 0.02, rate: 1 }, bob: { amp: 0, rate: 0 }, sway: { amp: 0, rate: 0 },
    lean: 0, scale: 1.02, yOffset: 0, blink: null, gaze: 'down', gazeGain: 1.3,
    jitter: 0.4, blush: 0, star: 0, fx: null, hold: null, settle: 18,
  },
  squished: {
    label: 'Squished', emoji: '\u{1F623}', expr: 22, eye: 0.9,
    breathe: { amp: 0.02, rate: 2 }, bob: { amp: 0, rate: 0 }, sway: { amp: 0, rate: 0 },
    lean: 0, scale: 1, yOffset: 6, blink: null, gaze: 'fixed', gazeGain: 0,
    jitter: 0.8, blush: 0.35, star: 0, fx: null, hold: 0.9, settle: 24,
  },
  walking: {
    label: 'Walking', emoji: '\u{1F6B6}', expr: 10, eye: 1,
    breathe: { amp: 0.05, rate: 5 }, bob: { amp: 5, rate: 5 }, sway: { amp: 5, rate: 2.5 },
    lean: 0, scale: 1, yOffset: 0, blink: [2.4, 6], gaze: 'fixed', gazeGain: 0.5,
    jitter: 0, blush: 0, star: 0, fx: null, hold: null, settle: 7,
  },

  // ---------------- deliberate glances ----------------
  lookLeft: {
    label: 'Look left', emoji: '\u{1F448}', expr: 3, eye: 1,
    breathe: { amp: 0.014, rate: 0.5 }, bob: { amp: 1.6, rate: 0.4 }, sway: { amp: 1, rate: 0.3 },
    lean: -6, scale: 1, yOffset: 0, blink: [2.6, 6], gaze: 'fixed', gazeGain: 0,
    jitter: 0, blush: 0, star: 0, fx: null, hold: 2.2, settle: 8,
  },
  lookRight: {
    label: 'Look right', emoji: '\u{1F449}', expr: 15, eye: 1,
    breathe: { amp: 0.014, rate: 0.5 }, bob: { amp: 1.6, rate: 0.4 }, sway: { amp: 1, rate: 0.3 },
    lean: 6, scale: 1, yOffset: 0, blink: [2.6, 6], gaze: 'fixed', gazeGain: 0,
    jitter: 0, blush: 0, star: 0, fx: null, hold: 2.2, settle: 8,
  },
  lookUp: {
    label: 'Look up', emoji: '\u{1F446}', expr: 8, eye: 1,
    breathe: { amp: 0.014, rate: 0.5 }, bob: { amp: 1.6, rate: 0.4 }, sway: { amp: 1, rate: 0.3 },
    lean: 0, scale: 1, yOffset: -2, blink: [2.6, 6], gaze: 'fixed', gazeGain: 0,
    jitter: 0, blush: 0, star: 0, fx: null, hold: 2.2, settle: 8,
  },
  lookDown: {
    label: 'Look down', emoji: '\u{1F447}', expr: 19, eye: 1,
    breathe: { amp: 0.014, rate: 0.5 }, bob: { amp: 1.6, rate: 0.4 }, sway: { amp: 1, rate: 0.3 },
    lean: 0, scale: 1, yOffset: 2, blink: [2.6, 6], gaze: 'fixed', gazeGain: 0,
    jitter: 0, blush: 0, star: 0, fx: null, hold: 2.2, settle: 8,
  },
  peek: {
    label: 'Peeking', emoji: '\u{1FAE3}', expr: 23, eye: 1,
    breathe: { amp: 0.02, rate: 0.8 }, bob: { amp: 1.8, rate: 0.6 }, sway: { amp: 2, rate: 0.4 },
    lean: 10, scale: 0.97, yOffset: 3, blink: [1.6, 4], gaze: 'follow', gazeGain: 1.1,
    jitter: 0, blush: 0.3, star: 0, fx: null, hold: 3, settle: 7,
  },

  // ---------------- doing something ----------------
  // These are the ones with a visible activity behind them. Every one is reached
  // by the brain noticing something, never by being picked off a list.
  grooving: {
    label: 'Grooving', emoji: '\u{1F3A7}', expr: 4, eye: 1,
    breathe: { amp: 0.05, rate: 1.9 }, bob: { amp: 7, rate: 1.9 }, sway: { amp: 11, rate: 0.95 },
    lean: 0, scale: 1.01, yOffset: 0, blink: [1.6, 3.4], gaze: 'fixed', gazeGain: 0,
    jitter: 0, blush: 0.2, star: 0, fx: 'note', hold: 7, settle: 6,
  },
  humming: {
    label: 'Humming', emoji: '\u{1F3B5}', expr: 4, eye: 1,
    breathe: { amp: 0.026, rate: 0.9 }, bob: { amp: 3, rate: 0.75 }, sway: { amp: 3.4, rate: 0.5 },
    lean: 0, scale: 1, yOffset: 0, blink: [2, 4.5], gaze: 'wander', gazeGain: 0.5,
    jitter: 0, blush: 0.14, star: 0, fx: 'note', hold: 6, settle: 6,
  },
  reading: {
    label: 'Reading', emoji: '\u{1F4D6}', expr: 6, eye: 1.02,
    breathe: { amp: 0.014, rate: 0.5 }, bob: { amp: 1.2, rate: 0.34 }, sway: { amp: 0.7, rate: 0.24 },
    lean: 4, scale: 1, yOffset: 2, blink: [2.4, 5.5], gaze: 'down', gazeGain: 0.8,
    lidBias: 0.12, jitter: 0, blush: 0, star: 0, fx: null, hold: 9, settle: 7,
  },
  typing: {
    label: 'Typing along', emoji: '\u{2328}', expr: 6, eye: 1,
    breathe: { amp: 0.018, rate: 1.5 }, bob: { amp: 2.2, rate: 3.1 }, sway: { amp: 1.1, rate: 1.6 },
    lean: 3, scale: 1, yOffset: 1, blink: [2.2, 5], gaze: 'down', gazeGain: 0.55,
    jitter: 0.25, blush: 0, star: 0, fx: null, hold: 6, settle: 8,
  },
  photographing: {
    label: 'Taking a picture', emoji: '\u{1F4F8}', expr: 12, eye: 1.05,
    breathe: { amp: 0.012, rate: 0.5 }, bob: { amp: 0.8, rate: 0.3 }, sway: { amp: 0.5, rate: 0.2 },
    lean: 0, scale: 1.02, yOffset: 0, blink: [3, 6], gaze: 'follow', gazeGain: 0.9,
    jitter: 0, blush: 0, star: 0.3, fx: 'sparkle', hold: 3.2, settle: 9,
  },
  searching: {
    label: 'Searching', emoji: '\u{1F50D}', expr: 18, eye: 1.06,
    breathe: { amp: 0.022, rate: 0.85 }, bob: { amp: 2.6, rate: 0.7 }, sway: { amp: 4.5, rate: 0.55 },
    lean: 8, scale: 1.01, yOffset: -1, blink: [1.7, 4], gaze: 'wander', gazeGain: 1.25,
    jitter: 0, blush: 0, star: 0, fx: 'question', hold: 4.5, settle: 7,
  },
  daydreaming: {
    label: 'Daydreaming', emoji: '\u{2601}', expr: 8, eye: 1,
    breathe: { amp: 0.02, rate: 0.4 }, bob: { amp: 3.6, rate: 0.28 }, sway: { amp: 2.4, rate: 0.2 },
    lean: -6, scale: 1, yOffset: -3, blink: [2.8, 7], gaze: 'wander', gazeGain: 0.7,
    lidBias: 0.2, jitter: 0, blush: 0.12, star: 0, fx: 'think', hold: 7, settle: 5,
  },
  stretching: {
    label: 'Stretching', emoji: '\u{1F938}', expr: 4, eye: 1,
    breathe: { amp: 0.07, rate: 0.5 }, bob: { amp: 2, rate: 0.4 }, sway: { amp: 2, rate: 0.3 },
    lean: 0, scale: 1.06, yOffset: -4, blink: [2, 5], gaze: 'fixed', gazeGain: 0,
    jitter: 0, blush: 0, star: 0, fx: null, hold: 2.4, settle: 5,
  },
  yawning: {
    label: 'Yawning', emoji: '\u{1F971}', expr: 1, eye: 1.04,
    breathe: { amp: 0.045, rate: 0.35 }, bob: { amp: 2.4, rate: 0.3 }, sway: { amp: 1.4, rate: 0.24 },
    lean: 0, scale: 1.03, yOffset: 1, blink: [1.2, 2.6], gaze: 'fixed', gazeGain: 0,
    lidBias: 0.5, jitter: 0, blush: 0, star: 0, fx: null, hold: 2.6, settle: 5,
  },
  waving: {
    label: 'Waving', emoji: '\u{1F44B}', expr: 4, eye: 1,
    breathe: { amp: 0.03, rate: 1 }, bob: { amp: 3.4, rate: 1.1 }, sway: { amp: 13, rate: 1.4 },
    lean: 0, scale: 1.02, yOffset: -2, blink: [1.8, 4], gaze: 'follow', gazeGain: 1,
    jitter: 0, blush: 0.2, star: 0, fx: null, hold: 2.6, settle: 8,
  },

  // ---------------- warmer ----------------
  grateful: {
    label: 'Grateful', emoji: '\u{1F64F}', expr: 4, eye: 1,
    breathe: { amp: 0.024, rate: 0.6 }, bob: { amp: 2, rate: 0.45 }, sway: { amp: 1.6, rate: 0.32 },
    lean: 0, scale: 1.01, yOffset: 0, blink: [2, 5], gaze: 'follow', gazeGain: 0.8,
    jitter: 0, blush: 0.45, star: 0, fx: 'heart', hold: 3.4, settle: 6,
  },
  hopeful: {
    label: 'Hopeful', emoji: '\u{2728}', expr: 2, eye: 1.05,
    breathe: { amp: 0.03, rate: 0.7 }, bob: { amp: 3, rate: 0.6 }, sway: { amp: 1.8, rate: 0.35 },
    lean: -3, scale: 1.02, yOffset: -3, blink: [2.2, 5], gaze: 'wander', gazeGain: 0.9,
    jitter: 0, blush: 0.2, star: 0.35, fx: 'sparkle', hold: 3.4, settle: 6,
  },
  starstruck: {
    label: 'Starstruck', emoji: '\u{1F929}', expr: 2, eye: 1.12,
    breathe: { amp: 0.04, rate: 1 }, bob: { amp: 3.6, rate: 0.9 }, sway: { amp: 2.6, rate: 0.6 },
    lean: 0, scale: 1.04, yOffset: -3, blink: [2.6, 6], gaze: 'follow', gazeGain: 1,
    jitter: 0, blush: 0.5, star: 1, fx: 'star', hold: 3.2, settle: 8,
  },
  triumphant: {
    label: 'Triumphant', emoji: '\u{1F3C6}', expr: 13, eye: 1.04,
    breathe: { amp: 0.04, rate: 0.8 }, bob: { amp: 4, rate: 0.7 }, sway: { amp: 2.2, rate: 0.4 },
    lean: 0, scale: 1.05, yOffset: -5, blink: [2.4, 5.5], gaze: 'fixed', gazeGain: 0,
    jitter: 0, blush: 0.2, star: 0.6, fx: 'confetti', hold: 3.4, settle: 8,
  },
  cheering: {
    label: 'Cheering', emoji: '\u{1F4E3}', expr: 2, eye: 1.06,
    breathe: { amp: 0.05, rate: 1.4 }, bob: { amp: 6, rate: 1.5 }, sway: { amp: 5, rate: 1.1 },
    lean: 0, scale: 1.04, yOffset: -4, blink: [1.8, 4], gaze: 'fixed', gazeGain: 0,
    jitter: 0, blush: 0.3, star: 0.2, fx: 'confetti', hold: 3, settle: 9,
  },
  relieved: {
    label: 'Relieved', emoji: '\u{1F60C}', expr: 13, eye: 1,
    breathe: { amp: 0.05, rate: 0.4 }, bob: { amp: 2.6, rate: 0.32 }, sway: { amp: 1.4, rate: 0.26 },
    lean: 0, scale: 1, yOffset: 2, blink: [2, 4.5], gaze: 'fixed', gazeGain: 0,
    lidBias: 0.24, jitter: 0, blush: 0.16, star: 0, fx: 'steam', hold: 3.2, settle: 5,
  },
  cozy: {
    label: 'Cosy', emoji: '\u{1F9E3}', expr: 4, eye: 1,
    breathe: { amp: 0.03, rate: 0.34 }, bob: { amp: 2.2, rate: 0.26 }, sway: { amp: 1.2, rate: 0.2 },
    lean: 0, scale: 1.01, yOffset: 2, blink: [2.6, 6], gaze: 'fixed', gazeGain: 0,
    lidBias: 0.2, jitter: 0, blush: 0.34, star: 0, fx: null, hold: 7, settle: 4,
  },
  zen: {
    label: 'Zen', emoji: '\u{1F9D8}', expr: 22, eye: 1,
    breathe: { amp: 0.03, rate: 0.22 }, bob: { amp: 1.6, rate: 0.18 }, sway: { amp: 0.6, rate: 0.14 },
    lean: 0, scale: 1, yOffset: 0, blink: null, gaze: 'fixed', gazeGain: 0,
    jitter: 0, blush: 0, star: 0, fx: null, hold: 9, settle: 4,
  },
  playful: {
    label: 'Playful', emoji: '\u{1F61C}', expr: 14, eye: 1.03,
    breathe: { amp: 0.04, rate: 1.1 }, bob: { amp: 4.4, rate: 1 }, sway: { amp: 6, rate: 0.8 },
    lean: 7, scale: 1.02, yOffset: -2, blink: [1.4, 3.4], gaze: 'follow', gazeGain: 1.1,
    jitter: 0, blush: 0.3, star: 0, fx: 'sparkle', hold: 2.8, settle: 8,
  },
  mischievous: {
    label: 'Up to something', emoji: '\u{1F608}', expr: 16, eye: 1.02,
    breathe: { amp: 0.026, rate: 0.8 }, bob: { amp: 2.4, rate: 0.6 }, sway: { amp: 3, rate: 0.45 },
    lean: 11, scale: 1.01, yOffset: 0, blink: [1.6, 3.8], gaze: 'follow', gazeGain: 1.2,
    lidBias: 0.16, jitter: 0, blush: 0.18, star: 0, fx: 'sparkle', hold: 3.2, settle: 7,
  },

  // ---------------- edgier ----------------
  vindicated: {
    label: 'Told you', emoji: '\u{1F60F}', expr: 22, eye: 1,
    breathe: { amp: 0.024, rate: 0.55 }, bob: { amp: 2, rate: 0.4 }, sway: { amp: 1.4, rate: 0.28 },
    lean: -7, scale: 1.03, yOffset: -1, blink: [2.2, 5], gaze: 'follow', gazeGain: 0.7,
    lidBias: 0.2, jitter: 0, blush: 0, star: 0, fx: null, hold: 3, settle: 6,
  },
  exasperated: {
    label: 'Not having it', emoji: '\u{1F624}', expr: 7, eye: 1.02,
    breathe: { amp: 0.05, rate: 1.3 }, bob: { amp: 2, rate: 1 }, sway: { amp: 2, rate: 1.1 },
    lean: 0, scale: 1.05, yOffset: 0, blink: [1.6, 3.6], gaze: 'follow', gazeGain: 0.8,
    jitter: 0.5, blush: 0, star: 0, fx: 'steam', hold: 2.6, settle: 9,
  },
  suspicious: {
    label: 'Suspicious', emoji: '\u{1F9D0}', expr: 5, eye: 1.02,
    breathe: { amp: 0.016, rate: 0.5 }, bob: { amp: 1.4, rate: 0.38 }, sway: { amp: 1, rate: 0.26 },
    lean: 6, scale: 1, yOffset: 0, blink: [2.6, 6], gaze: 'follow', gazeGain: 1.15,
    lidBias: 0.26, jitter: 0, blush: 0, star: 0, fx: null, hold: 3.4, settle: 7,
  },
  sulking: {
    label: 'Sulking', emoji: '\u{1F612}', expr: 22, eye: 1,
    breathe: { amp: 0.018, rate: 0.4 }, bob: { amp: 1.4, rate: 0.3 }, sway: { amp: 0.8, rate: 0.2 },
    lean: -10, scale: 0.98, yOffset: 3, blink: [2.4, 6], gaze: 'away', gazeGain: 0.9,
    lidBias: 0.3, jitter: 0, blush: 0, star: 0, fx: null, hold: 4.5, settle: 5,
  },
  nervous: {
    label: 'Nervous', emoji: '\u{1F62C}', expr: 11, eye: 1.02,
    breathe: { amp: 0.035, rate: 1.5 }, bob: { amp: 1.6, rate: 1.2 }, sway: { amp: 1.6, rate: 1.4 },
    lean: 0, scale: 0.99, yOffset: 1, blink: [1, 2.4], gaze: 'follow', gazeGain: 0.7,
    jitter: 0.55, blush: 0.2, star: 0, fx: 'sweat', hold: 3.2, settle: 8,
  },
  embarrassed: {
    label: 'Embarrassed', emoji: '\u{1F633}', expr: 24, eye: 1,
    breathe: { amp: 0.03, rate: 0.9 }, bob: { amp: 1.8, rate: 0.7 }, sway: { amp: 1.4, rate: 0.5 },
    lean: -5, scale: 0.98, yOffset: 2, blink: [1.4, 3.2], gaze: 'away', gazeGain: 1,
    jitter: 0.15, blush: 1, star: 0, fx: 'steam', hold: 3.4, settle: 7,
  },
  apologetic: {
    label: 'Sorry', emoji: '\u{1F614}', expr: 17, eye: 1,
    breathe: { amp: 0.018, rate: 0.42 }, bob: { amp: 1.4, rate: 0.32 }, sway: { amp: 0.9, rate: 0.22 },
    lean: 0, scale: 0.98, yOffset: 4, blink: [2.2, 5], gaze: 'down', gazeGain: 0.9,
    lidBias: 0.2, jitter: 0, blush: 0.2, star: 0, fx: null, hold: 3.4, settle: 5,
  },
  glitching: {
    label: 'Glitching', emoji: '\u{26A1}', expr: 9, eye: 1.04,
    breathe: { amp: 0.05, rate: 3 }, bob: { amp: 2, rate: 2.6 }, sway: { amp: 3, rate: 3.4 },
    lean: 0, scale: 1.01, yOffset: 0, blink: [0.5, 1.4], gaze: 'fixed', gazeGain: 0,
    jitter: 1.1, blush: 0, star: 0, fx: 'glitch', hold: 2.4, settle: 12,
  },
  disoriented: {
    label: 'Wrong way', emoji: '\u{1F643}', expr: 21, eye: 1.06,
    breathe: { amp: 0.04, rate: 0.9 }, bob: { amp: 4, rate: 0.7 }, sway: { amp: 16, rate: 0.9 },
    lean: 0, scale: 1.01, yOffset: 0, blink: [1.6, 3.6], gaze: 'wander', gazeGain: 1.2,
    jitter: 0.3, blush: 0, star: 0, fx: 'swirl', hold: 3, settle: 7,
  },
  lonely: {
    label: 'Where did you go', emoji: '\u{1F97A}', expr: 20, eye: 1.04,
    breathe: { amp: 0.02, rate: 0.5 }, bob: { amp: 2.2, rate: 0.4 }, sway: { amp: 5, rate: 0.32 },
    lean: 0, scale: 0.99, yOffset: 1, blink: [2, 4.6], gaze: 'wander', gazeGain: 1.3,
    jitter: 0, blush: 0.16, star: 0, fx: 'question', hold: 5.5, settle: 5,
  },
  amazed: {
    label: 'Amazed', emoji: '\u{1F92F}', expr: 12, eye: 1.14,
    breathe: { amp: 0.05, rate: 1.2 }, bob: { amp: 3, rate: 0.9 }, sway: { amp: 2, rate: 0.6 },
    lean: 0, scale: 1.05, yOffset: -3, blink: [3, 7], gaze: 'follow', gazeGain: 1,
    jitter: 0.2, blush: 0.2, star: 0, fx: 'shock', hold: 2.6, settle: 11,
  },
  impressed: {
    label: 'Impressed', emoji: '\u{1F62E}', expr: 12, eye: 1.06,
    breathe: { amp: 0.03, rate: 0.8 }, bob: { amp: 2.4, rate: 0.6 }, sway: { amp: 1.6, rate: 0.4 },
    lean: 0, scale: 1.02, yOffset: -2, blink: [2.4, 5.5], gaze: 'follow', gazeGain: 0.95,
    jitter: 0, blush: 0.14, star: 0, fx: 'ping', hold: 2.6, settle: 8,
  },
  determined: {
    label: 'Determined', emoji: '\u{1F4AA}', expr: 6, eye: 1.02,
    breathe: { amp: 0.03, rate: 0.75 }, bob: { amp: 1.6, rate: 0.5 }, sway: { amp: 0.8, rate: 0.3 },
    lean: 0, scale: 1.03, yOffset: -2, blink: [2.6, 6], gaze: 'fixed', gazeGain: 0,
    lidBias: 0.14, jitter: 0, blush: 0, star: 0, fx: null, hold: 5, settle: 8,
  },

  // ---------------- the machine and the room ----------------
  chilly: {
    label: 'Chilly', emoji: '\u{1F976}', expr: 11, eye: 1,
    breathe: { amp: 0.03, rate: 2.2 }, bob: { amp: 1.2, rate: 1.8 }, sway: { amp: 1.2, rate: 2 },
    lean: 0, scale: 0.98, yOffset: 2, blink: [1.4, 3.2], gaze: 'fixed', gazeGain: 0,
    jitter: 0.8, blush: 0.26, star: 0, fx: null, hold: 3.4, settle: 7,
  },
  overheated: {
    label: 'Overheated', emoji: '\u{1F975}', expr: 20, eye: 1,
    breathe: { amp: 0.055, rate: 1.1 }, bob: { amp: 2.4, rate: 0.8 }, sway: { amp: 1.6, rate: 0.5 },
    lean: 0, scale: 1.01, yOffset: 3, blink: [1.6, 3.6], gaze: 'fixed', gazeGain: 0,
    lidBias: 0.24, jitter: 0.1, blush: 0.5, star: 0, fx: 'steam', hold: 3.6, settle: 6,
  },
  hungry: {
    label: 'Peckish', emoji: '\u{1F60B}', expr: 18, eye: 1.02,
    breathe: { amp: 0.03, rate: 0.9 }, bob: { amp: 2.6, rate: 0.7 }, sway: { amp: 2.4, rate: 0.5 },
    lean: 6, scale: 1, yOffset: 1, blink: [1.8, 4.2], gaze: 'wander', gazeGain: 0.9,
    jitter: 0, blush: 0.2, star: 0, fx: 'think', hold: 3.4, settle: 6,
  },

  // ---------------- more warmth ----------------
  giggling: {
    label: 'Giggling', emoji: '\u{1F92D}', expr: 4, eye: 1.02,
    breathe: { amp: 0.05, rate: 4.6 }, bob: { amp: 4, rate: 4.4 }, sway: { amp: 3.6, rate: 3.2 },
    lean: 0, scale: 1.01, yOffset: -1, blink: [2, 4.5], gaze: 'away', gazeGain: 0.6,
    jitter: 0.45, blush: 0.4, star: 0, fx: null, hold: 3, settle: 12,
  },
  beaming: {
    label: 'Beaming', emoji: '\u{1F601}', expr: 4, eye: 1.06,
    breathe: { amp: 0.04, rate: 1.2 }, bob: { amp: 4.5, rate: 1.1 }, sway: { amp: 2.4, rate: 0.8 },
    lean: 0, scale: 1.04, yOffset: -3, blink: [3, 7], gaze: 'follow', gazeGain: 1,
    jitter: 0, blush: 0.3, star: 0.4, fx: 'sparkle', hold: 4, settle: 9,
  },
  delighted: {
    label: 'Delighted', emoji: '\u{1F603}', expr: 2, eye: 1.07,
    breathe: { amp: 0.05, rate: 2.2 }, bob: { amp: 7, rate: 2 }, sway: { amp: 4, rate: 1.4 },
    lean: 0, scale: 1.04, yOffset: -4, blink: [2, 5], gaze: 'follow', gazeGain: 1.1,
    jitter: 0.3, blush: 0.26, star: 0, fx: 'sparkle', hold: 4, settle: 11,
  },
  adoring: {
    label: 'Adoring', emoji: '\u{1F60D}', expr: 2, eye: 1.12,
    breathe: { amp: 0.05, rate: 1 }, bob: { amp: 3.4, rate: 0.9 }, sway: { amp: 2.2, rate: 0.6 },
    lean: 0, scale: 1.04, yOffset: -2, blink: [3.5, 8], gaze: 'follow', gazeGain: 1.2,
    jitter: 0, blush: 0.7, star: 0.3, fx: 'heart', hold: 5, settle: 6,
  },
  flirty: {
    label: 'Flirty', emoji: '\u{1F618}', expr: 14, eye: 1.04,
    breathe: { amp: 0.032, rate: 1.1 }, bob: { amp: 3.2, rate: 0.95 }, sway: { amp: 4.4, rate: 0.7 },
    lean: 8, scale: 1.02, yOffset: -1, blink: null, gaze: 'follow', gazeGain: 1.05,
    jitter: 0, blush: 0.5, star: 0, fx: 'heart', hold: 2.6, settle: 12,
  },
  touched: {
    label: 'Touched', emoji: '\u{1F979}', expr: 20, eye: 1.08,
    breathe: { amp: 0.03, rate: 0.8 }, bob: { amp: 2.4, rate: 0.6 }, sway: { amp: 2.6, rate: 0.45 },
    lean: 0, scale: 1.01, yOffset: 1, blink: [1.8, 4.4], gaze: 'follow', gazeGain: 1.1,
    jitter: 0, blush: 0.45, star: 0, fx: 'tear', hold: 4, settle: 6,
  },
  giddy: {
    label: 'Giddy', emoji: '\u{1F92A}', expr: 21, eye: 1.08,
    breathe: { amp: 0.06, rate: 3.8 }, bob: { amp: 8, rate: 3.4 }, sway: { amp: 9, rate: 2.2 },
    lean: 0, scale: 1.03, yOffset: -3, blink: [1.2, 3], gaze: 'wander', gazeGain: 1.3,
    jitter: 1, blush: 0.35, star: 0, fx: 'sparkle', hold: 3.4, settle: 13,
  },
  teasing: {
    label: 'Teasing', emoji: '\u{1F61C}', expr: 14, eye: 1.03,
    breathe: { amp: 0.038, rate: 1.4 }, bob: { amp: 4, rate: 1.3 }, sway: { amp: 6.5, rate: 1 },
    lean: 9, scale: 1.02, yOffset: -1, blink: null, gaze: 'follow', gazeGain: 1.15,
    jitter: 0, blush: 0.28, star: 0, fx: null, hold: 2.8, settle: 11,
  },
  gloating: {
    label: 'Gloating', emoji: '\u{1F63C}', expr: 22, eye: 1.02,
    breathe: { amp: 0.03, rate: 0.75 }, bob: { amp: 2.6, rate: 0.6 }, sway: { amp: 2, rate: 0.42 },
    lean: -9, scale: 1.05, yOffset: -3, blink: [2.6, 6], gaze: 'follow', gazeGain: 0.85,
    lidBias: 0.22, jitter: 0, blush: 0, star: 0.35, fx: null, hold: 3.4, settle: 7,
  },
  highfiving: {
    label: 'High five', emoji: '\u{1F64C}', expr: 2, eye: 1.05,
    breathe: { amp: 0.045, rate: 1.6 }, bob: { amp: 6, rate: 1.6 }, sway: { amp: 4, rate: 1.2 },
    lean: 0, scale: 1.05, yOffset: -5, blink: [2, 4.6], gaze: 'follow', gazeGain: 1.1,
    jitter: 0, blush: 0.24, star: 0.3, fx: 'ping', hold: 2.2, settle: 14,
  },

  // ---------------- more attention ----------------
  plotting: {
    label: 'Plotting', emoji: '\u{1F9E0}', expr: 16, eye: 1.02,
    breathe: { amp: 0.022, rate: 0.6 }, bob: { amp: 2, rate: 0.45 }, sway: { amp: 2.6, rate: 0.32 },
    lean: 12, scale: 1, yOffset: 0, blink: [2.2, 5], gaze: 'away', gazeGain: 0.9,
    lidBias: 0.2, jitter: 0, blush: 0.12, star: 0, fx: 'think', hold: 5, settle: 6,
  },
  calculating: {
    label: 'Calculating', emoji: '\u{1F9EE}', expr: 6, eye: 1,
    breathe: { amp: 0.016, rate: 1.1 }, bob: { amp: 1.4, rate: 0.9 }, sway: { amp: 0.8, rate: 0.5 },
    lean: 0, scale: 1, yOffset: 0, blink: [3, 7], gaze: 'wander', gazeGain: 0.6,
    lidBias: 0.1, jitter: 0, blush: 0, star: 0, fx: 'orbit', hold: 6, settle: 7,
  },
  eureka: {
    label: 'Eureka', emoji: '\u{1F4A1}', expr: 12, eye: 1.12,
    breathe: { amp: 0.05, rate: 1.4 }, bob: { amp: 5, rate: 1.2 }, sway: { amp: 2, rate: 0.7 },
    lean: 0, scale: 1.07, yOffset: -6, blink: [2.6, 6], gaze: 'fixed', gazeGain: 0,
    jitter: 0.3, blush: 0, star: 1, fx: 'ping', hold: 2.8, settle: 18,
  },
  pondering: {
    label: 'Pondering', emoji: '\u{2753}', expr: 8, eye: 1.02,
    breathe: { amp: 0.016, rate: 0.42 }, bob: { amp: 2.8, rate: 0.3 }, sway: { amp: 3.2, rate: 0.2 },
    lean: -7, scale: 1, yOffset: -1, blink: [2.8, 6.5], gaze: 'wander', gazeGain: 0.55,
    lidBias: 0.12, jitter: 0, blush: 0, star: 0, fx: 'question', hold: 6, settle: 4,
  },
  inspecting: {
    label: 'Inspecting', emoji: '\u{1F52C}', expr: 5, eye: 1.06,
    breathe: { amp: 0.014, rate: 0.7 }, bob: { amp: 1.2, rate: 0.5 }, sway: { amp: 0.6, rate: 0.3 },
    lean: 4, scale: 1.01, yOffset: -1, blink: [3.2, 7.5], gaze: 'follow', gazeGain: 1.35,
    lidBias: 0.22, jitter: 0, blush: 0, star: 0, fx: null, hold: 4.5, settle: 8,
  },
  eavesdropping: {
    label: 'Eavesdropping', emoji: '\u{1F92B}', expr: 23, eye: 1.02,
    breathe: { amp: 0.014, rate: 0.6 }, bob: { amp: 1.2, rate: 0.45 }, sway: { amp: 1, rate: 0.28 },
    lean: 13, scale: 0.98, yOffset: 2, blink: [2.4, 5.5], gaze: 'away', gazeGain: 0.8,
    lidBias: 0.18, jitter: 0, blush: 0.14, star: 0, fx: null, hold: 4, settle: 6,
  },
  waiting: {
    label: 'Waiting', emoji: '\u{23F3}', expr: 22, eye: 1,
    breathe: { amp: 0.018, rate: 0.34 }, bob: { amp: 2, rate: 0.26 }, sway: { amp: 3.4, rate: 0.18 },
    lean: 0, scale: 1, yOffset: 2, blink: [1.8, 4.4], gaze: 'wander', gazeGain: 0.6,
    lidBias: 0.2, jitter: 0, blush: 0, star: 0, fx: null, hold: 7, settle: 4,
  },
  counting: {
    label: 'Counting', emoji: '\u{1F522}', expr: 19, eye: 1,
    breathe: { amp: 0.016, rate: 0.8 }, bob: { amp: 1.4, rate: 0.6 }, sway: { amp: 1.2, rate: 0.45 },
    lean: 3, scale: 1, yOffset: 1, blink: [2.4, 5.5], gaze: 'down', gazeGain: 0.7,
    jitter: 0, blush: 0, star: 0, fx: 'think', hold: 4.5, settle: 6,
  },
  buffering: {
    label: 'Buffering', emoji: '\u{1F504}', expr: 8, eye: 1,
    breathe: { amp: 0.02, rate: 1 }, bob: { amp: 1.6, rate: 0.8 }, sway: { amp: 1, rate: 0.6 },
    lean: 0, scale: 1, yOffset: 0, blink: [2.6, 6], gaze: 'fixed', gazeGain: 0,
    lidBias: 0.15, jitter: 0, blush: 0, star: 0, fx: 'orbit', hold: 4, settle: 6,
  },

  // ---------------- more startle ----------------
  spooked: {
    label: 'Spooked', emoji: '\u{1F47B}', expr: 11, eye: 1.1,
    breathe: { amp: 0.04, rate: 5.5 }, bob: { amp: 2, rate: 4.2 }, sway: { amp: 2, rate: 3.8 },
    lean: 0, scale: 0.95, yOffset: 4, blink: null, gaze: 'wander', gazeGain: 1.35,
    jitter: 1.6, blush: 0, star: 0, fx: 'shock', hold: 3, settle: 20,
  },
  paranoid: {
    label: 'Paranoid', emoji: '\u{1F440}', expr: 5, eye: 1.05,
    breathe: { amp: 0.03, rate: 2 }, bob: { amp: 1.6, rate: 1.6 }, sway: { amp: 2.6, rate: 1.3 },
    lean: 0, scale: 0.99, yOffset: 1, blink: [1, 2.6], gaze: 'wander', gazeGain: 1.4,
    lidBias: 0.18, jitter: 0.7, blush: 0, star: 0, fx: null, hold: 4, settle: 9,
  },
  panicking: {
    label: 'Panicking', emoji: '\u{1F631}', expr: 11, eye: 1.14,
    breathe: { amp: 0.06, rate: 8.5 }, bob: { amp: 3, rate: 6.5 }, sway: { amp: 3, rate: 5.5 },
    lean: 0, scale: 1.02, yOffset: -2, blink: null, gaze: 'wander', gazeGain: 1.5,
    jitter: 2.6, blush: 0, star: 0, fx: 'sweat', hold: 3.2, settle: 22,
  },
  cringing: {
    label: 'Cringing', emoji: '\u{1F616}', expr: 24, eye: 0.94,
    breathe: { amp: 0.02, rate: 1.2 }, bob: { amp: 1.2, rate: 0.9 }, sway: { amp: 1.6, rate: 0.7 },
    lean: -8, scale: 0.94, yOffset: 6, blink: [1.6, 3.8], gaze: 'away', gazeGain: 1.1,
    lidBias: 0.34, jitter: 0.2, blush: 0.4, star: 0, fx: null, hold: 3, settle: 9,
  },
  flustered: {
    label: 'Flustered', emoji: '\u{1FAE0}', expr: 24, eye: 1.04,
    breathe: { amp: 0.045, rate: 2.6 }, bob: { amp: 2.4, rate: 2 }, sway: { amp: 3.4, rate: 1.7 },
    lean: 0, scale: 1, yOffset: 1, blink: [0.9, 2.2], gaze: 'wander', gazeGain: 1.2,
    jitter: 0.8, blush: 0.9, star: 0, fx: 'steam', hold: 3.4, settle: 11,
  },
  queasy: {
    label: 'Queasy', emoji: '\u{1F922}', expr: 21, eye: 1.02,
    breathe: { amp: 0.05, rate: 0.7 }, bob: { amp: 4, rate: 0.55 }, sway: { amp: 8, rate: 0.5 },
    lean: 0, scale: 0.99, yOffset: 4, blink: [1.4, 3.4], gaze: 'down', gazeGain: 0.7,
    lidBias: 0.3, jitter: 0.35, blush: 0.3, star: 0, fx: 'swirl', hold: 4, settle: 5,
  },

  // ---------------- deeper lows ----------------
  heartbroken: {
    label: 'Heartbroken', emoji: '\u{1F494}', expr: 17, eye: 1.05,
    breathe: { amp: 0.022, rate: 0.28 }, bob: { amp: 1.4, rate: 0.22 }, sway: { amp: 2, rate: 0.18 },
    lean: 0, scale: 0.94, yOffset: 11, blink: [2.4, 5.5], gaze: 'down', gazeGain: 0.7,
    lidBias: 0.2, jitter: 0, blush: 0.1, star: 0, fx: 'tear', hold: 6, settle: 4,
  },
  disappointed: {
    label: 'Disappointed', emoji: '\u{1F641}', expr: 17, eye: 1,
    breathe: { amp: 0.02, rate: 0.4 }, bob: { amp: 1.4, rate: 0.3 }, sway: { amp: 1, rate: 0.22 },
    lean: 0, scale: 0.98, yOffset: 6, blink: [2.6, 6], gaze: 'away', gazeGain: 0.7,
    lidBias: 0.24, jitter: 0, blush: 0, star: 0, fx: null, hold: 4, settle: 5,
  },
  guilty: {
    label: 'Guilty', emoji: '\u{1FAE4}', expr: 24, eye: 1,
    breathe: { amp: 0.02, rate: 0.9 }, bob: { amp: 1.2, rate: 0.7 }, sway: { amp: 2.2, rate: 0.5 },
    lean: -6, scale: 0.97, yOffset: 5, blink: [1.6, 3.8], gaze: 'away', gazeGain: 1.05,
    lidBias: 0.22, jitter: 0.1, blush: 0.5, star: 0, fx: null, hold: 4, settle: 6,
  },
  wistful: {
    label: 'Wistful', emoji: '\u{1F319}', expr: 8, eye: 1.02,
    breathe: { amp: 0.024, rate: 0.3 }, bob: { amp: 3, rate: 0.24 }, sway: { amp: 2, rate: 0.16 },
    lean: -5, scale: 0.99, yOffset: 0, blink: [3, 7], gaze: 'wander', gazeGain: 0.6,
    lidBias: 0.24, jitter: 0, blush: 0.14, star: 0, fx: null, hold: 7, settle: 3,
  },
  drained: {
    label: 'Drained', emoji: '\u{1FAAB}', expr: 1, eye: 0.98,
    breathe: { amp: 0.03, rate: 0.22 }, bob: { amp: 1.6, rate: 0.18 }, sway: { amp: 1.6, rate: 0.13 },
    lean: 5, scale: 0.96, yOffset: 9, blink: [1.4, 3.4], gaze: 'down', gazeGain: 0.35,
    lidBias: 0.46, jitter: 0, blush: 0, star: 0, fx: null, hold: 7, settle: 3,
  },
  numb: {
    label: 'Blank', emoji: '\u{1F636}', expr: 1, eye: 1,
    breathe: { amp: 0.008, rate: 0.3 }, bob: { amp: 0.6, rate: 0.2 }, sway: { amp: 0.3, rate: 0.14 },
    lean: 0, scale: 1, yOffset: 2, blink: [4, 10], gaze: 'fixed', gazeGain: 0,
    lidBias: 0.16, jitter: 0, blush: 0, star: 0, fx: null, hold: 5, settle: 3,
  },
  moping: {
    label: 'Moping', emoji: '\u{1F327}', expr: 22, eye: 1,
    breathe: { amp: 0.018, rate: 0.3 }, bob: { amp: 1.2, rate: 0.24 }, sway: { amp: 1.4, rate: 0.18 },
    lean: -8, scale: 0.97, yOffset: 7, blink: [2.2, 5.4], gaze: 'down', gazeGain: 0.5,
    lidBias: 0.34, jitter: 0, blush: 0, star: 0, fx: null, hold: 6, settle: 4,
  },

  // ---------------- spikier ----------------
  grumpy: {
    label: 'Grumpy', emoji: '\u{1F644}', expr: 23, eye: 1,
    breathe: { amp: 0.024, rate: 0.7 }, bob: { amp: 1.6, rate: 0.55 }, sway: { amp: 1.2, rate: 0.35 },
    lean: -6, scale: 1, yOffset: 3, blink: [2.6, 6], gaze: 'away', gazeGain: 0.6,
    lidBias: 0.3, jitter: 0, blush: 0, star: 0, fx: null, hold: 5, settle: 6,
  },
  furious: {
    label: 'Furious', emoji: '\u{1F92C}', expr: 7, eye: 1.04,
    breathe: { amp: 0.075, rate: 8 }, bob: { amp: 2.6, rate: 6 }, sway: { amp: 3.4, rate: 5.2 },
    lean: 0, scale: 1.09, yOffset: -4, blink: [4, 9], gaze: 'follow', gazeGain: 1.3,
    jitter: 3, blush: 0.2, star: 0, fx: 'steam', hold: 3.4, settle: 20,
  },
  offended: {
    label: 'Offended', emoji: '\u{1F626}', expr: 11, eye: 1.06,
    breathe: { amp: 0.05, rate: 1.4 }, bob: { amp: 2, rate: 1 }, sway: { amp: 1.4, rate: 0.7 },
    lean: -10, scale: 1.04, yOffset: -2, blink: [2.6, 6], gaze: 'follow', gazeGain: 1.1,
    jitter: 0.3, blush: 0.2, star: 0, fx: 'steam', hold: 3, settle: 14,
  },
  jealous: {
    label: 'Jealous', emoji: '\u{1F63E}', expr: 7, eye: 1.02,
    breathe: { amp: 0.03, rate: 1.2 }, bob: { amp: 1.6, rate: 0.9 }, sway: { amp: 1.6, rate: 0.7 },
    lean: -12, scale: 1.01, yOffset: 1, blink: [2.4, 5.4], gaze: 'away', gazeGain: 1.15,
    lidBias: 0.24, jitter: 0.3, blush: 0.2, star: 0, fx: 'steam', hold: 4, settle: 8,
  },
  betrayed: {
    label: 'Betrayed', emoji: '\u{1F5E1}', expr: 20, eye: 1.08,
    breathe: { amp: 0.03, rate: 0.8 }, bob: { amp: 1.6, rate: 0.6 }, sway: { amp: 2.6, rate: 0.4 },
    lean: 0, scale: 0.98, yOffset: 4, blink: [1.8, 4.2], gaze: 'follow', gazeGain: 1.2,
    jitter: 0.2, blush: 0.15, star: 0, fx: 'tear', hold: 4.5, settle: 9,
  },
  unimpressed: {
    label: 'Unimpressed', emoji: '\u{1F611}', expr: 22, eye: 1,
    breathe: { amp: 0.01, rate: 0.4 }, bob: { amp: 0.8, rate: 0.3 }, sway: { amp: 0.4, rate: 0.2 },
    lean: 0, scale: 1, yOffset: 1, blink: [3.5, 9], gaze: 'follow', gazeGain: 0.5,
    lidBias: 0.32, jitter: 0, blush: 0, star: 0, fx: null, hold: 4, settle: 5,
  },
  sarcastic: {
    label: 'Sarcastic', emoji: '\u{1F485}', expr: 22, eye: 1.02,
    breathe: { amp: 0.02, rate: 0.6 }, bob: { amp: 1.6, rate: 0.45 }, sway: { amp: 2.6, rate: 0.32 },
    lean: -8, scale: 1.01, yOffset: 0, blink: [2.6, 6], gaze: 'away', gazeGain: 0.7,
    lidBias: 0.26, jitter: 0, blush: 0, star: 0, fx: null, hold: 3.4, settle: 7,
  },
  defiant: {
    label: 'Defiant', emoji: '\u{270A}', expr: 7, eye: 1.02,
    breathe: { amp: 0.035, rate: 0.9 }, bob: { amp: 1.8, rate: 0.6 }, sway: { amp: 0.8, rate: 0.3 },
    lean: 0, scale: 1.06, yOffset: -4, blink: [3, 7], gaze: 'follow', gazeGain: 1.1,
    lidBias: 0.12, jitter: 0.2, blush: 0, star: 0, fx: null, hold: 4, settle: 10,
  },
  stubborn: {
    label: 'Stubborn', emoji: '\u{1F402}', expr: 23, eye: 1,
    breathe: { amp: 0.02, rate: 0.5 }, bob: { amp: 1, rate: 0.34 }, sway: { amp: 0.5, rate: 0.2 },
    lean: -4, scale: 1.02, yOffset: 2, blink: [3.4, 8], gaze: 'away', gazeGain: 0.9,
    lidBias: 0.28, jitter: 0, blush: 0, star: 0, fx: null, hold: 5, settle: 5,
  },

  // ---------------- more things to be caught doing ----------------
  singing: {
    label: 'Singing', emoji: '\u{1F3A4}', expr: 2, eye: 1.04,
    breathe: { amp: 0.055, rate: 1.6 }, bob: { amp: 5, rate: 1.5 }, sway: { amp: 5, rate: 0.9 },
    lean: 0, scale: 1.03, yOffset: -3, blink: [2.2, 5], gaze: 'wander', gazeGain: 0.6,
    jitter: 0, blush: 0.24, star: 0, fx: 'note', hold: 6, settle: 8,
  },
  drumming: {
    label: 'Drumming', emoji: '\u{1F941}', expr: 6, eye: 1,
    breathe: { amp: 0.03, rate: 4.4 }, bob: { amp: 4, rate: 4.2 }, sway: { amp: 2.4, rate: 2.1 },
    lean: 0, scale: 1.01, yOffset: 0, blink: [2, 4.6], gaze: 'fixed', gazeGain: 0,
    jitter: 0.35, blush: 0, star: 0, fx: 'note', hold: 4.5, settle: 10,
  },
  juggling: {
    label: 'Juggling', emoji: '\u{1F939}', expr: 12, eye: 1.04,
    breathe: { amp: 0.026, rate: 1.8 }, bob: { amp: 3, rate: 1.7 }, sway: { amp: 2, rate: 1 },
    lean: 0, scale: 1.01, yOffset: -1, blink: [2.4, 5.4], gaze: 'wander', gazeGain: 0.9,
    jitter: 0, blush: 0, star: 0, fx: 'orbit', hold: 5, settle: 8,
  },
  exercising: {
    label: 'Working out', emoji: '\u{1F3CB}', expr: 6, eye: 1,
    breathe: { amp: 0.07, rate: 2.6 }, bob: { amp: 6, rate: 2.5 }, sway: { amp: 1.6, rate: 1.2 },
    lean: 0, scale: 1.02, yOffset: -2, blink: [1.8, 4], gaze: 'fixed', gazeGain: 0,
    lidBias: 0.12, jitter: 0.2, blush: 0.3, star: 0, fx: 'sweat', hold: 4.5, settle: 8,
  },
  tidying: {
    label: 'Tidying up', emoji: '\u{1F9F9}', expr: 6, eye: 1,
    breathe: { amp: 0.03, rate: 2.2 }, bob: { amp: 2.6, rate: 2 }, sway: { amp: 5, rate: 1.6 },
    lean: 0, scale: 1, yOffset: 1, blink: [2.4, 5.4], gaze: 'wander', gazeGain: 0.7,
    jitter: 0, blush: 0, star: 0.2, fx: 'sparkle', hold: 5, settle: 7,
  },
  stargazing: {
    label: 'Stargazing', emoji: '\u{1F31F}', expr: 8, eye: 1.06,
    breathe: { amp: 0.022, rate: 0.3 }, bob: { amp: 3, rate: 0.24 }, sway: { amp: 1.6, rate: 0.16 },
    lean: 0, scale: 1, yOffset: -3, blink: [3, 7.5], gaze: 'fixed', gazeGain: 0,
    jitter: 0, blush: 0.14, star: 0.7, fx: 'star', hold: 7, settle: 4,
  },
  snacking: {
    label: 'Snacking', emoji: '\u{1F36A}', expr: 4, eye: 1,
    breathe: { amp: 0.04, rate: 3 }, bob: { amp: 2, rate: 2.8 }, sway: { amp: 1.6, rate: 1.4 },
    lean: 4, scale: 1.02, yOffset: 1, blink: [2.2, 5], gaze: 'down', gazeGain: 0.5,
    jitter: 0, blush: 0.24, star: 0, fx: null, hold: 4, settle: 8,
  },
  caffeinated: {
    label: 'Caffeinated', emoji: '\u{2615}', expr: 2, eye: 1.08,
    breathe: { amp: 0.05, rate: 5.5 }, bob: { amp: 3.4, rate: 5 }, sway: { amp: 2.6, rate: 4 },
    lean: 0, scale: 1.03, yOffset: -3, blink: [0.8, 2], gaze: 'wander', gazeGain: 1.4,
    jitter: 1.8, blush: 0.2, star: 0, fx: 'sparkle', hold: 5, settle: 16,
  },
  sneaking: {
    label: 'Sneaking', emoji: '\u{1F977}', expr: 16, eye: 1,
    breathe: { amp: 0.014, rate: 0.5 }, bob: { amp: 1, rate: 0.4 }, sway: { amp: 1.4, rate: 0.3 },
    lean: 10, scale: 0.95, yOffset: 5, blink: [2.6, 6], gaze: 'wander', gazeGain: 1.1,
    lidBias: 0.26, jitter: 0, blush: 0, star: 0, fx: null, hold: 5, settle: 6,
  },
  spying: {
    label: 'Spying', emoji: '\u{1F575}', expr: 5, eye: 1.04,
    breathe: { amp: 0.014, rate: 0.6 }, bob: { amp: 1, rate: 0.45 }, sway: { amp: 0.8, rate: 0.3 },
    lean: 8, scale: 0.97, yOffset: 3, blink: [3, 7], gaze: 'follow', gazeGain: 1.3,
    lidBias: 0.24, jitter: 0, blush: 0, star: 0, fx: null, hold: 4.5, settle: 7,
  },
  sneezing: {
    label: 'Sneezing', emoji: '\u{1F927}', expr: 11, eye: 1.02,
    breathe: { amp: 0.05, rate: 1.2 }, bob: { amp: 2, rate: 1 }, sway: { amp: 1.4, rate: 0.8 },
    lean: 0, scale: 1.02, yOffset: 0, blink: [1.2, 3], gaze: 'fixed', gazeGain: 0,
    lidBias: 0.3, jitter: 0.6, blush: 0.3, star: 0, fx: 'steam', hold: 1.8, settle: 16,
  },
  hiccuping: {
    label: 'Hiccups', emoji: '\u{1FAE7}', expr: 2, eye: 1.04,
    breathe: { amp: 0.03, rate: 1.4 }, bob: { amp: 2, rate: 1.2 }, sway: { amp: 1.6, rate: 0.9 },
    lean: 0, scale: 1.01, yOffset: 0, blink: [1.4, 3.4], gaze: 'wander', gazeGain: 0.8,
    jitter: 0.3, blush: 0.26, star: 0, fx: null, hold: 3.4, settle: 12,
  },
};

export const EMOTION_KEYS = Object.keys(EMOTIONS);

// The roster, grouped. Nothing picks from this any more — feelings are the bot's
// own business now, so there is no menu of them — but keeping the table means a
// new emotion has to be filed somewhere, and `npm test` fails on any that is
// not. That is the only thing standing between 131 entries and a junk drawer.
// Handling states (held/falling/squished/walking) are driven by physics.
export const EMOTION_GROUPS = [
  { name: 'Everyday', keys: ['idle', 'neutral', 'happy', 'content', 'listening', 'talking', 'cozy', 'zen',
    'numb', 'waiting'] },
  { name: 'Delighted', keys: ['excited', 'love', 'laughing', 'celebrating', 'proud', 'smug', 'wink', 'shy',
    'grateful', 'hopeful', 'starstruck', 'triumphant', 'cheering', 'relieved', 'playful', 'mischievous',
    'giggling', 'beaming', 'delighted', 'adoring', 'flirty', 'touched', 'giddy', 'teasing', 'gloating',
    'highfiving'] },
  { name: 'Attentive', keys: ['curious', 'confused', 'thinking', 'focused', 'working', 'alert',
    'reading', 'typing', 'searching', 'determined', 'suspicious', 'daydreaming',
    'plotting', 'calculating', 'eureka', 'pondering', 'inspecting', 'eavesdropping', 'counting',
    'buffering'] },
  { name: 'Startled', keys: ['surprised', 'shocked', 'scared', 'dizzy', 'amazed', 'impressed', 'disoriented',
    'spooked', 'paranoid', 'panicking', 'cringing', 'flustered', 'queasy'] },
  { name: 'Low', keys: ['sad', 'pleading', 'bored', 'sleepy', 'sleeping', 'lonely', 'sulking',
    'apologetic', 'yawning', 'heartbroken', 'disappointed', 'guilty', 'wistful', 'drained', 'moping'] },
  { name: 'Spiky', keys: ['annoyed', 'angry', 'skeptical', 'error', 'exasperated', 'vindicated',
    'nervous', 'embarrassed', 'glitching', 'grumpy', 'furious', 'offended', 'jealous', 'betrayed',
    'unimpressed', 'sarcastic', 'defiant', 'stubborn'] },
  { name: 'Doing something', keys: ['grooving', 'humming', 'stretching', 'waving', 'photographing',
    'singing', 'drumming', 'juggling', 'exercising', 'tidying', 'stargazing', 'snacking',
    'sneaking', 'spying', 'sneezing', 'hiccuping'] },
  { name: 'The room', keys: ['chilly', 'overheated', 'hungry', 'caffeinated'] },
  { name: 'Glances', keys: ['lookLeft', 'lookRight', 'lookUp', 'lookDown', 'peek'] },
];

// What the settings window's preview drifts through on its own. Deliberately the
// calm end of the roster: this is a thumbnail, not a performance.
export const PREVIEW_REEL = [
  'idle', 'happy', 'content', 'curious', 'listening', 'thinking', 'wink', 'shy',
  'proud', 'grooving', 'humming', 'reading', 'daydreaming', 'hopeful', 'grateful',
  'playful', 'cozy', 'zen', 'stretching', 'waving', 'sleepy', 'peek', 'smug',
  'giggling', 'beaming', 'pondering', 'stargazing', 'singing', 'waiting',
  'teasing', 'wistful', 'tidying', 'snacking', 'inspecting',
];

export const getEmotion = (key) => EMOTIONS[key] || EMOTIONS.idle;

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
};

export const EMOTION_KEYS = Object.keys(EMOTIONS);

// Grouped for the context menu, so the list stays readable at 30+ entries.
// Handling states (held/falling/squished/walking) are driven by physics, not picked by hand.
export const EMOTION_GROUPS = [
  { name: 'Everyday', keys: ['idle', 'neutral', 'happy', 'content', 'listening', 'talking'] },
  { name: 'Delighted', keys: ['excited', 'love', 'laughing', 'celebrating', 'proud', 'smug', 'wink', 'shy'] },
  { name: 'Attentive', keys: ['curious', 'confused', 'thinking', 'focused', 'working', 'alert'] },
  { name: 'Startled', keys: ['surprised', 'shocked', 'scared', 'dizzy'] },
  { name: 'Low', keys: ['sad', 'pleading', 'bored', 'sleepy', 'sleeping'] },
  { name: 'Spiky', keys: ['annoyed', 'angry', 'skeptical', 'error'] },
  { name: 'Glances', keys: ['lookLeft', 'lookRight', 'lookUp', 'lookDown', 'peek'] },
];

export const getEmotion = (key) => EMOTIONS[key] || EMOTIONS.idle;

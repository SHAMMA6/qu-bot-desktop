// Choreography: named, timed gestures that play ON TOP of whatever emotion the
// bot is currently wearing.
//
// An emotion is a steady state — a face plus a breathing rhythm it can hold all
// day. A move is a beat: a nod, a backflip, a sneeze, a lap of the monitor. The
// two are deliberately separate layers, because "annoyed" and "stomping" are not
// the same kind of thing, and forcing them into one table would mean a copy of
// every emotion for every gesture.
//
// A move may have either or both of:
//   pose(u, t)   body-space delta, layered over the emotion's own transform.
//                { x, y, rot, sx, sy, lid, gazeX, gazeY } — all optional.
//                x/y are viewBox units (the body is ~230 across), rot degrees,
//                sx/sy multipliers around 1.
//   path(u, t)   desktop-space offset from wherever the move started, in body
//                widths. Only runs while the bot is flying under its own power;
//                a grounded (gravity-on) bot skips it and keeps the pose.
//
// Everything else is presentation: `fx` fires a particle burst at the start,
// `sound` names a cue on Sound, `tags` are how the brain picks one at random.

import { TAU, clamp, pick, rand } from './geom.js';

// ---------------------------------------------------------------- shorthands
// u is always 0..1 across the move, so these read as "shape of the beat".
const bell = (u) => Math.sin(u * Math.PI);                  // 0 -> 1 -> 0
const wave = (u, n = 1, ph = 0) => Math.sin(u * TAU * n + ph);
const decay = (u, k = 4) => Math.exp(-k * u);
// A struck spring: big first swing, settling. The workhorse of physical comedy.
const twang = (u, n = 3, k = 5) => Math.sin(u * TAU * n) * Math.exp(-k * u);
// Volume-preserving squash: what one axis loses the other gains, so the body
// never looks like it changed mass.
const squash = (amount) => ({ sx: 1 + amount, sy: 1 - amount });

// The squash profile of a flip: crouch, stretch through the air, absorb the
// landing. Shared by both flips because they differ only in which way they turn.
const flipSquash = (u) => {
  const crouch = Math.max(0, 1 - u / 0.1);
  const land = Math.max(0, (u - 0.92) / 0.08);
  return crouch * 0.18 + land * 0.2 - 0.06 * (1 - crouch) * (1 - land);
};

export const MOVES = {
  // ---------------------------------------------------------------- answers
  // The small conversational beats. These are the ones that get used most, so
  // they are short, quiet and never move the body off its spot.
  nod: {
    dur: 0.85, tags: ['talk', 'yes', 'calm'],
    pose: (u) => ({ y: wave(u, 2) * 7, rot: wave(u, 2) * 2 }),
  },
  nodSlow: {
    dur: 1.6, tags: ['talk', 'yes', 'calm'],
    pose: (u) => ({ y: wave(u, 1.5) * 9, rot: wave(u, 1.5) * 3, lid: bell(u) * 0.2 }),
  },
  shakeHead: {
    dur: 0.9, tags: ['talk', 'no'],
    pose: (u) => ({ x: wave(u, 2.5) * 9, rot: wave(u, 2.5) * -5 }),
  },
  tilt: {
    dur: 1.4, tags: ['talk', 'curious', 'calm'],
    pose: (u) => ({ rot: bell(u) * 14, x: bell(u) * 4 }),
  },
  doubleTake: {
    dur: 1.1, tags: ['surprise', 'curious'],
    // Look away, register it, snap back. The snap is the joke.
    pose: (u) => (u < 0.45
      ? { rot: -18 * (u / 0.45), gazeX: -14 * (u / 0.45) }
      : { rot: -18 + 26 * Math.min(1, (u - 0.45) / 0.18), x: bell((u - 0.45) / 0.55) * -6, gazeX: 12 }),
    sound: 'blip',
  },
  lean: {
    dur: 1.8, tags: ['curious', 'peek'],
    pose: (u) => ({ rot: bell(u) * 11, x: bell(u) * 12, sy: 1 - bell(u) * 0.03 }),
  },
  peer: {
    dur: 2.2, tags: ['curious', 'peek'],
    pose: (u) => ({ x: bell(u) * 14, rot: bell(u) * 8, lid: bell(u) * 0.3, sx: 1 + bell(u) * 0.05 }),
  },
  bow: {
    dur: 1.5, tags: ['polite', 'proud'],
    pose: (u) => {
      const d = u < 0.35 ? u / 0.35 : u < 0.65 ? 1 : 1 - (u - 0.65) / 0.35;
      return { rot: d * 22, y: d * 10, ...squash(d * 0.08) };
    },
  },
  wave: {
    dur: 1.9, tags: ['greet', 'happy'],
    // No arms, so the whole body does the waving — it tips side to side from a
    // fixed foot, which is what a hand wave looks like at this scale.
    pose: (u) => ({ rot: wave(u, 3.5) * 15 * bell(u) * 1.6, x: wave(u, 3.5) * 5 * bell(u) }),
    sound: 'blip',
  },
  shrug: {
    dur: 1.3, tags: ['talk', 'no'],
    pose: (u) => ({ y: -bell(u) * 9, ...squash(-bell(u) * 0.06), rot: bell(u) * 5 }),
  },
  pointAt: {
    dur: 1.2, tags: ['talk', 'curious'],
    pose: (u) => ({ x: bell(u) * 18, rot: bell(u) * 12, gazeX: bell(u) * 12 }),
  },

  // ---------------------------------------------------------------- delight
  bounce: {
    dur: 1.1, tags: ['happy', 'play'],
    pose: (u) => {
      const h = Math.abs(wave(u, 3)) * (1 - u * 0.5);
      // Squashed on the ground, stretched at the apex, and the crossover is a
      // blend rather than a threshold — a step here reads as a dropped frame.
      return { y: -h * 20, ...squash(0.06 - h * 0.18) };
    },
    sound: 'boing',
  },
  hopUp: {
    dur: 0.75, tags: ['happy', 'play'],
    pose: (u) => {
      const crouch = Math.max(0, 1 - u / 0.12);
      return { y: -bell(u) * 30, ...squash(crouch * 0.16 - bell(u) * 0.1) };
    },
    sound: 'boing',
  },
  wiggle: {
    dur: 1.2, tags: ['happy', 'play'],
    pose: (u) => ({ x: twang(u, 4, 2.2) * 12, rot: twang(u, 4, 2.2) * -7 }),
  },
  shimmy: {
    dur: 2, tags: ['happy', 'dance'],
    pose: (u) => ({ x: wave(u, 4) * 13, rot: wave(u, 4, Math.PI / 2) * 6, y: Math.abs(wave(u, 8)) * -4 }),
  },
  groove: {
    dur: 3.2, tags: ['dance', 'happy'],
    pose: (u) => ({
      x: wave(u, 2) * 10, y: -Math.abs(wave(u, 4)) * 8,
      rot: wave(u, 2) * 9, ...squash(Math.abs(wave(u, 4)) * -0.06),
    }),
    fx: 'note',
  },
  headbang: {
    dur: 2.4, tags: ['dance', 'hyper'],
    pose: (u) => ({ y: Math.abs(wave(u, 5)) * 12, rot: wave(u, 5) * 4, ...squash(Math.abs(wave(u, 5)) * 0.07) }),
    fx: 'note',
  },
  twirl: {
    dur: 2.2, tags: ['dance', 'happy', 'show'],
    pose: (u) => ({ rot: u * 360, y: -bell(u) * 16, sx: 1 - bell(u) * 0.06 }),
    fx: 'sparkle',
  },
  spin: {
    dur: 0.9, tags: ['show', 'play'],
    pose: (u) => ({ rot: u * 360, ...squash(bell(u) * -0.05) }),
    sound: 'whistleUp',
  },
  barrelRoll: {
    dur: 1.1, tags: ['show', 'play', 'hyper'],
    pose: (u) => ({ rot: u * 720, x: wave(u, 1) * 14 }),
    sound: 'whistleUp',
  },
  // Crouch, stretch through the air, absorb the landing. Each phase fades into
  // the next; the version with thresholds instead of blends popped twice.
  backflip: {
    dur: 1.15, tags: ['show', 'play', 'hyper'],
    pose: (u) => ({ rot: -u * 360, y: -bell(u) * 46, ...squash(flipSquash(u)) }),
    sound: 'whoosh', fx: 'sparkle',
  },
  frontflip: {
    dur: 1.15, tags: ['show', 'play', 'hyper'],
    pose: (u) => ({ rot: u * 360, y: -bell(u) * 46, ...squash(flipSquash(u)) }),
    sound: 'whoosh', fx: 'sparkle',
  },
  cartwheel: {
    dur: 1.4, tags: ['show', 'play'], path: (u) => ({ x: Math.sin(u * Math.PI) * 1.6, y: 0 }),
    pose: (u) => ({ rot: u * 360, y: -Math.abs(wave(u, 2)) * 10 }),
    sound: 'whoosh',
  },
  coinFlip: {
    dur: 1, tags: ['show', 'play'],
    // Mirroring sx through zero reads as flipping about the vertical axis. Two
    // whole flips, not one and a half: an odd number would leave it facing
    // backwards, which nothing downstream can undo.
    pose: (u) => ({ sx: Math.cos(u * TAU * 2), y: -bell(u) * 22 }),
    sound: 'blip',
  },
  breakdance: {
    dur: 2.6, tags: ['dance', 'show', 'hyper'],
    // Two whole turns. Anything that is not a multiple of 360 finishes upside
    // down and has to be rotated back out, which reads as a stumble.
    pose: (u) => ({
      rot: u * 720, y: 8 + wave(u, 3) * 6,
      ...squash(0.12 + wave(u, 3) * 0.06),
    }),
    fx: 'dust', sound: 'whoosh',
  },
  moonwalk: {
    dur: 2.4, tags: ['dance', 'show'], path: (u) => ({ x: -u * 1.5, y: 0 }),
    pose: (u) => ({ rot: -10 + wave(u, 6) * 5, y: Math.abs(wave(u, 6)) * -5 }),
    fx: 'note',
  },
  celebrate: {
    dur: 1.8, tags: ['happy', 'win'],
    pose: (u) => ({ y: -Math.abs(wave(u, 2.5)) * 34, rot: wave(u, 5) * 10, ...squash(-bell(u) * 0.08) }),
    fx: 'confetti', sound: 'fanfare',
  },
  applaud: {
    dur: 1.6, tags: ['happy', 'win'],
    pose: (u) => ({ x: wave(u, 7) * 6, ...squash(Math.abs(wave(u, 7)) * 0.1), y: -bell(u) * 8 }),
    sound: 'applause',
  },
  heartbeat: {
    dur: 1.4, tags: ['love', 'calm'],
    pose: (u) => {
      const p = Math.max(0, wave(u, 2)) ** 3 + Math.max(0, wave(u, 2, -0.9)) ** 3 * 0.6;
      return { ...squash(-p * 0.1), y: -p * 5 };
    },
    fx: 'heart', sound: 'thump',
  },
  nuzzle: {
    dur: 1.9, tags: ['love', 'calm'],
    pose: (u) => ({ x: wave(u, 3) * 8 * bell(u) * 1.4, rot: wave(u, 3) * 6 * bell(u), lid: bell(u) * 0.45 }),
    fx: 'heart', sound: 'purr',
  },
  blushHide: {
    dur: 1.6, tags: ['shy', 'love'],
    pose: (u) => ({ y: bell(u) * 10, rot: -bell(u) * 14, ...squash(bell(u) * 0.08), lid: bell(u) * 0.4 }),
  },
  showOff: {
    dur: 2, tags: ['proud', 'show'],
    pose: (u) => ({ y: -bell(u) * 14, rot: wave(u, 1.5) * 12, ...squash(-bell(u) * 0.07) }),
    fx: 'star', sound: 'sparkleUp',
  },

  // ---------------------------------------------------------------- startle
  flinch: {
    dur: 0.65, tags: ['startle', 'scared'],
    pose: (u) => ({ x: -decay(u, 6) * 20, y: decay(u, 6) * 8, ...squash(decay(u, 6) * 0.14) }),
    sound: 'blip',
  },
  jolt: {
    dur: 0.7, tags: ['startle'],
    pose: (u) => ({ y: -bell(u) * 26, ...squash(-bell(u) * 0.14), rot: twang(u, 3, 6) * 6 }),
    fx: 'shock', sound: 'zap',
  },
  recoil: {
    dur: 0.9, tags: ['startle', 'scared'], path: (u) => ({ x: -bell(u) * 0.5, y: 0 }),
    pose: (u) => ({ rot: -bell(u) * 16, ...squash(bell(u) * 0.1) }),
  },
  jumpScare: {
    dur: 1.1, tags: ['startle', 'scared'],
    pose: (u) => ({ y: -bell(u) * 40, ...squash(-bell(u) * 0.18), x: twang(u, 5, 4) * 8 }),
    fx: 'shock', sound: 'zap',
  },
  shiver: {
    dur: 2.2, tags: ['cold', 'scared'],
    pose: (u) => ({ x: wave(u * 22, 1) * 3.2, y: wave(u * 19, 1) * 2, rot: wave(u * 25, 1) * 2 }),
    sound: 'brr',
  },
  vibrate: {
    dur: 1.2, tags: ['hyper', 'glitch'],
    pose: (u) => ({ x: rand(-3, 3), y: rand(-3, 3), rot: rand(-2, 2), ...squash(wave(u, 12) * 0.04) }),
    sound: 'buzz',
  },
  glitchJump: {
    dur: 0.9, tags: ['glitch'],
    pose: (u) => (Math.random() < 0.3
      ? { x: rand(-18, 18), y: rand(-10, 10), sx: rand(0.85, 1.2), sy: rand(0.85, 1.2) }
      : { x: 0, y: 0 }),
    fx: 'glitch', sound: 'glitch',
  },

  // ---------------------------------------------------------------- spiky
  stomp: {
    dur: 1.1, tags: ['angry'],
    pose: (u) => {
      const beat = Math.max(0, -wave(u, 2));
      return { y: -Math.max(0, wave(u, 2)) * 18 + beat * 6, ...squash(beat * 0.18), rot: wave(u, 2) * 4 };
    },
    fx: 'dust', sound: 'thump',
  },
  fume: {
    dur: 2.2, tags: ['angry'],
    pose: (u) => ({ x: wave(u * 16, 1) * 4, ...squash(Math.abs(wave(u, 3)) * 0.09), y: -bell(u) * 6 }),
    fx: 'steam', sound: 'grumble',
  },
  huff: {
    dur: 1.3, tags: ['angry', 'annoyed'],
    pose: (u) => ({ ...squash(-bell(u) * 0.11), y: -bell(u) * 7, rot: -bell(u) * 9 }),
    fx: 'steam', sound: 'huff',
  },
  turnAway: {
    dur: 2.4, tags: ['annoyed', 'sulk'],
    pose: (u) => {
      const d = u < 0.25 ? u / 0.25 : u < 0.8 ? 1 : 1 - (u - 0.8) / 0.2;
      return { rot: -d * 20, x: -d * 10, gazeX: -d * 15 };
    },
    sound: 'hmph',
  },
  sulkDrop: {
    dur: 2.6, tags: ['sulk', 'sad'],
    pose: (u) => {
      const d = u < 0.3 ? u / 0.3 : 1;
      return { y: d * 12, rot: -d * 8, lid: d * 0.35, ...squash(d * 0.06) };
    },
  },
  facepalm: {
    dur: 2, tags: ['annoyed', 'tired'],
    pose: (u) => {
      const d = u < 0.2 ? u / 0.2 : u < 0.75 ? 1 : 1 - (u - 0.75) / 0.25;
      return { rot: d * 26, y: d * 14, lid: d * 0.6 };
    },
    sound: 'sigh',
  },
  eyeRoll: {
    dur: 1.4, tags: ['annoyed', 'sassy'],
    pose: (u) => ({
      gazeX: Math.cos(u * TAU - Math.PI / 2) * 13, gazeY: -Math.abs(Math.sin(u * TAU)) * 13,
      rot: bell(u) * -5,
    }),
    sound: 'hmph',
  },
  dodgeStep: {
    dur: 0.8, tags: ['dodge', 'play'], path: (u) => ({ x: bell(u) * 0.7, y: 0 }),
    pose: (u) => ({ rot: bell(u) * -14, ...squash(bell(u) * -0.05) }),
    sound: 'whoosh',
  },

  // ---------------------------------------------------------------- body
  stretchTall: {
    dur: 2, tags: ['tired', 'calm'],
    pose: (u) => ({ ...squash(-bell(u) * 0.16), y: -bell(u) * 12 }),
    sound: 'yawn',
  },
  pancake: {
    dur: 1.3, tags: ['play', 'silly'],
    pose: (u) => {
      const d = u < 0.25 ? u / 0.25 : u < 0.6 ? 1 : 1 - (u - 0.6) / 0.4;
      return { ...squash(d * 0.3), y: d * 14 };
    },
    fx: 'dust', sound: 'squish',
  },
  inflate: {
    dur: 1.8, tags: ['play', 'silly'],
    pose: (u) => {
      const d = u < 0.6 ? u / 0.6 : 1 - (u - 0.6) / 0.4;
      return { sx: 1 + d * 0.22, sy: 1 + d * 0.22, y: -d * 6 };
    },
    sound: 'inflate',
  },
  jelly: {
    dur: 1.6, tags: ['play', 'silly'],
    pose: (u) => {
      const w = twang(u, 3.5, 3);
      return { ...squash(w * 0.16), x: w * 6 };
    },
    sound: 'wobble',
  },
  popIn: {
    dur: 0.6, tags: ['show', 'play'],
    pose: (u) => {
      const s = 1 + twang(u, 1.2, 4) * 0.28;
      return { sx: s, sy: s };
    },
    sound: 'pop',
  },
  drill: {
    dur: 1.5, tags: ['hyper', 'show'],
    pose: (u) => ({ rot: u * 1440, ...squash(-0.1), y: -bell(u) * 10 }),
    sound: 'buzz',
  },
  tumble: {
    dur: 2, tags: ['show', 'silly'],
    pose: (u) => ({
      rot: u * 720, x: wave(u, 1.5) * 16, y: -Math.abs(wave(u, 3)) * 14,
      ...squash(wave(u, 6) * 0.08),
    }),
    sound: 'whoosh',
  },
  pendulum: {
    dur: 2.6, tags: ['calm', 'idle'],
    pose: (u) => ({ rot: twang(u, 2, 1.1) * 18, x: twang(u, 2, 1.1) * 10 }),
  },
  bobble: {
    dur: 2.4, tags: ['calm', 'idle'],
    pose: (u) => ({ y: wave(u, 2) * 9, rot: wave(u, 2, 1) * 5 }),
  },
  sneeze: {
    dur: 1.5, tags: ['silly', 'sick'],
    // Wind up leaning back, then everything fires forward at once. The release
    // continues from the wound-up pose rather than restarting from neutral, or
    // the body flicks upright for a frame before the sneeze arrives.
    pose: (u) => {
      if (u < 0.55) {
        const w = u / 0.55;
        return { y: -w * 12, rot: -w * 14, ...squash(-w * 0.1) };
      }
      const v = (u - 0.55) / 0.45;
      const back = Math.max(0, 1 - v * 4);
      const blast = bell(v);
      return {
        y: -back * 12 + blast * 10,
        rot: -back * 14 + blast * 20,
        ...squash(-back * 0.1 + blast * 0.2),
      };
    },
    fx: 'steam', sound: 'sneeze',
  },
  hiccup: {
    dur: 1.6, tags: ['silly'],
    pose: (u) => {
      const k = Math.max(0, wave(u, 3)) ** 6;
      return { y: -k * 22, ...squash(-k * 0.14) };
    },
    sound: 'hiccup',
  },
  nodOff: {
    dur: 2.8, tags: ['tired'],
    // The head sinks, then catches itself. Twice.
    pose: (u) => {
      const f = (u % 0.5) / 0.5;
      const sink = f < 0.75 ? f / 0.75 : 1 - (f - 0.75) / 0.25;
      return { y: sink * 14, rot: sink * 10, lid: 0.3 + sink * 0.5 };
    },
    fx: 'sleep',
  },
  yawnBig: {
    dur: 2.2, tags: ['tired'],
    pose: (u) => {
      const d = bell(u);
      return { sy: 1 + d * 0.14, sx: 1 - d * 0.05, y: -d * 8, lid: d * 0.75 };
    },
    sound: 'yawn',
  },
  meltDown: {
    dur: 2.6, tags: ['tired', 'sad'],
    pose: (u) => {
      const d = u < 0.7 ? u / 0.7 : 1;
      return { ...squash(d * 0.24), y: d * 18, lid: d * 0.5 };
    },
    sound: 'deflate',
  },
  hypnotised: {
    dur: 2.8, tags: ['dizzy', 'silly'],
    pose: (u) => ({
      rot: wave(u, 1.5) * 22, x: wave(u, 1.5) * 14, y: wave(u, 3) * 6,
      gazeX: Math.cos(u * TAU * 2) * 12, gazeY: Math.sin(u * TAU * 2) * 12,
    }),
    fx: 'swirl', sound: 'wobble',
  },

  // ---------------------------------------------------------------- travel
  // These need room to move, so they only run when the bot is flying. A
  // grounded bot plays the pose and stays where it is.
  circleAround: {
    dur: 3.4, tags: ['travel', 'play'],
    path: (u) => ({ x: Math.sin(u * TAU) * 1.5, y: -(1 - Math.cos(u * TAU)) * 0.75 }),
    pose: (u) => ({ rot: Math.sin(u * TAU) * 12 }),
  },
  figureEight: {
    dur: 4.6, tags: ['travel', 'show'],
    path: (u) => ({ x: Math.sin(u * TAU) * 1.8, y: Math.sin(u * TAU * 2) * 0.7 }),
    pose: (u) => ({ rot: Math.cos(u * TAU) * 14 }),
    fx: 'sparkle',
  },
  zigzag: {
    dur: 2.6, tags: ['travel', 'hyper'],
    path: (u) => ({ x: (u - 0.5) * 2.6, y: Math.sin(u * TAU * 3) * 0.5 }),
    pose: (u) => ({ rot: Math.cos(u * TAU * 3) * 16 }),
    sound: 'whoosh',
  },
  swoop: {
    dur: 2.2, tags: ['travel', 'show'],
    path: (u) => ({ x: Math.sin(u * Math.PI) * 1.9, y: -Math.sin(u * TAU) * 1.1 }),
    pose: (u) => ({ rot: Math.cos(u * TAU) * 20, sx: 1 + Math.abs(Math.sin(u * TAU)) * 0.06 }),
    sound: 'whoosh',
  },
  spiralUp: {
    dur: 3, tags: ['travel', 'show'],
    path: (u) => ({ x: Math.sin(u * TAU * 2) * 0.9 * (1 - u), y: -u * 1.4 }),
    pose: (u) => ({ rot: u * 360 }),
    fx: 'sparkle', sound: 'whistleUp',
  },
  pounce: {
    dur: 1.3, tags: ['travel', 'play'],
    // Crouch, then everything at once. Anticipation is the whole gag, and the
    // launch has to grow out of the crouch rather than replace it.
    path: (u) => ({ x: u < 0.35 ? -(u / 0.35) * 0.25 : (u - 0.35) / 0.65 * 1.5, y: 0 }),
    pose: (u) => {
      if (u < 0.35) {
        const w = u / 0.35;
        return { ...squash(w * 0.16), y: w * 8 };
      }
      const v = (u - 0.35) / 0.65;
      const crouch = Math.max(0, 1 - v * 3);
      return {
        ...squash(crouch * 0.16 - (1 - crouch) * 0.1),
        y: crouch * 8 - bell(v) * 16,
        rot: bell(v) * 10,
      };
    },
    sound: 'whoosh',
  },
  scurry: {
    dur: 2.2, tags: ['travel', 'hyper'],
    path: (u) => ({ x: u * 2.2, y: 0 }),
    pose: (u) => ({ y: -Math.abs(wave(u, 9)) * 7, rot: wave(u, 9) * 6 }),
    sound: 'scurry',
  },
  retreat: {
    dur: 1.6, tags: ['travel', 'scared'],
    path: (u) => ({ x: -u * 1.8, y: -u * 0.5 }),
    pose: (u) => ({ rot: -u * 22, ...squash(-0.05) }),
    sound: 'whoosh',
  },
  lapOfHonour: {
    dur: 5, tags: ['travel', 'show', 'win'],
    path: (u) => ({ x: Math.sin(u * TAU) * 2.6, y: -(1 - Math.cos(u * TAU)) * 1 }),
    pose: (u) => ({ rot: Math.sin(u * TAU) * 16 }),
    fx: 'confetti', sound: 'fanfare',
  },
  tiptoe: {
    dur: 2.8, tags: ['travel', 'sneaky'],
    path: (u) => ({ x: u * 1.2, y: 0 }),
    pose: (u) => ({ y: -Math.abs(wave(u, 5)) * 9 - 4, rot: wave(u, 5) * 5, lid: 0.25 }),
    sound: 'tiptoe',
  },
  peekaboo: {
    dur: 2.4, tags: ['play', 'peek'],
    // Shrink away to nothing, wait, then burst back at full size.
    pose: (u) => {
      if (u < 0.3) { const d = u / 0.3; return { sx: 1 - d * 0.75, sy: 1 - d * 0.75, y: d * 20 }; }
      if (u < 0.6) return { sx: 0.25, sy: 0.25, y: 20 };
      const d = (u - 0.6) / 0.4;
      const s = 0.25 + (1 - 0.25) * Math.min(1, d * 2.2);
      return { sx: s + twang(d, 1.5, 4) * 0.15, sy: s + twang(d, 1.5, 4) * 0.15, y: 20 * (1 - Math.min(1, d * 2)) };
    },
    sound: 'pop', fx: 'sparkle',
  },
};

export const MOVE_KEYS = Object.keys(MOVES);

// Moves grouped by tag, so the brain can ask for "something happy" rather than
// naming one. Built once from the table — a new move joins its groups for free.
export const MOVES_BY_TAG = MOVE_KEYS.reduce((acc, key) => {
  for (const tag of MOVES[key].tags || []) (acc[tag] ||= []).push(key);
  return acc;
}, {});

export const moveFor = (tag) => {
  const pool = MOVES_BY_TAG[tag];
  return pool ? pick(pool) : null;
};

// Which gestures suit which feeling. Setting an emotion occasionally plays one
// of these, which is what stops the roster reading as a slideshow of faces:
// getting angry *does* something, it does not merely look like something.
export const EMOTION_MOVES = {
  happy: ['bounce', 'wiggle', 'nod'],
  excited: ['bounce', 'spin', 'shimmy', 'barrelRoll'],
  celebrating: ['celebrate', 'twirl', 'applaud'],
  triumphant: ['showOff', 'celebrate', 'bow'],
  cheering: ['applaud', 'bounce', 'celebrate'],
  laughing: ['jelly', 'wiggle', 'headbang'],
  love: ['heartbeat', 'nuzzle'],
  grateful: ['bow', 'nodSlow'],
  proud: ['showOff', 'bow'],
  smug: ['eyeRoll', 'turnAway'],
  shy: ['blushHide'],
  embarrassed: ['blushHide', 'facepalm'],
  playful: ['wiggle', 'jelly', 'peekaboo', 'coinFlip'],
  mischievous: ['tiptoe', 'peekaboo', 'eyeRoll'],
  grooving: ['groove', 'shimmy', 'headbang'],
  humming: ['bobble', 'shimmy'],
  curious: ['tilt', 'lean', 'doubleTake'],
  confused: ['shakeHead', 'tilt', 'shrug'],
  suspicious: ['peer', 'lean'],
  surprised: ['jolt', 'doubleTake'],
  shocked: ['jumpScare', 'jolt'],
  amazed: ['popIn', 'jolt'],
  scared: ['flinch', 'recoil', 'shiver'],
  nervous: ['shiver', 'vibrate'],
  annoyed: ['huff', 'turnAway', 'eyeRoll'],
  angry: ['stomp', 'fume', 'huff'],
  exasperated: ['facepalm', 'huff', 'eyeRoll'],
  sulking: ['sulkDrop', 'turnAway'],
  vindicated: ['eyeRoll', 'showOff'],
  sad: ['sulkDrop'],
  apologetic: ['bow', 'sulkDrop'],
  lonely: ['pendulum', 'bobble'],
  bored: ['pendulum', 'eyeRoll', 'bobble'],
  sleepy: ['nodOff', 'yawnBig'],
  yawning: ['yawnBig'],
  stretching: ['stretchTall'],
  waving: ['wave'],
  dizzy: ['hypnotised', 'tumble'],
  disoriented: ['hypnotised'],
  glitching: ['glitchJump', 'vibrate'],
  error: ['glitchJump', 'vibrate'],
  chilly: ['shiver'],
  overheated: ['meltDown', 'huff'],
  hungry: ['jelly', 'bobble'],
  determined: ['nod', 'stomp'],
  zen: ['bobble', 'nodSlow'],
  cozy: ['nodSlow', 'bobble'],
  peek: ['peer', 'lean'],
  squished: ['pancake'],
  talking: ['nod', 'tilt', 'shrug'],
  listening: ['nod', 'tilt'],
  alert: ['jolt', 'doubleTake'],
  starstruck: ['popIn', 'showOff'],
  impressed: ['nod', 'applaud'],
  hopeful: ['bobble', 'popIn'],
  relieved: ['stretchTall', 'meltDown'],
};

// Neutral in every field, so a caller can read the runner's output every frame
// without checking whether anything is playing.
const REST = { x: 0, y: 0, rot: 0, sx: 1, sy: 1, lid: 0, gazeX: null, gazeY: null };

// How long the body takes to give up whatever pose a gesture left it holding.
const RELEASE = 0.28;

// The equivalent rotation in (-180, 180]. A move that ends on 720 degrees is
// visually identical to one that ends on 0, and unwinding it would show the
// body spinning backwards for no reason.
const shortestTurn = (deg) => deg - Math.round(deg / 360) * 360;

// ---------------------------------------------------------------- the runner
// One move at a time, with a short queue so gestures can be chained into a
// combo ("crouch, leap, land") without any of them knowing about the others.
export class Choreo {
  constructor() {
    this.cur = null;        // { key, def, t, dur, scale }
    this.queue = [];
    this.out = { ...REST };
    this.path = null;       // { x, y } desktop offset in body widths, or null
    this.release = null;    // what the last gesture left the body holding
    this.onStart = null;    // (key, def) => void — for sound and particles
    this.enabled = true;
  }

  get active() { return !!this.cur; }
  get key() { return this.cur?.key || null; }

  // `scale` stretches or shrinks the whole gesture — a small nod and an
  // emphatic one are the same curve at different amplitudes.
  play(key, { scale = 1, queue = false, speed = 1 } = {}) {
    const def = MOVES[key];
    if (!def || !this.enabled) return false;
    if (queue && this.cur) {
      if (this.queue.length < 4) this.queue.push({ key, scale, speed });
      return true;
    }
    this.cur = { key, def, t: 0, dur: def.dur / Math.max(0.2, speed), scale };
    this.release = null;
    this.onStart?.(key, def);
    return true;
  }

  // A combo: the first plays now, the rest follow as each finishes.
  chain(keys, opts) {
    if (!keys.length) return false;
    const ok = this.play(keys[0], opts);
    for (const k of keys.slice(1)) this.play(k, { ...opts, queue: true });
    return ok;
  }

  stop() {
    this.cur = null;
    this.queue.length = 0;
    this.release = null;
    this.out = { ...REST };
    this.path = null;
  }

  // A gesture is free to end mid-pose — slumped, tilted, still squashed — and
  // most of the good ones do. Dropping that to neutral on one frame is a visible
  // snap, so whatever it was holding is let go over a fifth of a second instead.
  // This is why no move has to be authored to finish tidily.
  _beginRelease() {
    const o = this.out;
    const turn = shortestTurn(o.rot);
    // A mirrored body cannot be eased back through zero without flipping
    // through nothing, so that one case is dropped rather than blended.
    const sx = o.sx > 0.05 ? o.sx : 1;
    const held = Math.abs(o.x) + Math.abs(o.y) + Math.abs(turn) + Math.abs(o.lid)
      + Math.abs(sx - 1) + Math.abs(o.sy - 1);
    this.release = held > 0.01
      ? { x: o.x, y: o.y, rot: turn, sx, sy: o.sy, lid: o.lid, gazeX: o.gazeX, gazeY: o.gazeY, t: RELEASE }
      : null;
    this.out = this.release ? { ...this.release } : REST;
    this.path = null;
  }

  update(dt) {
    if (!this.cur) {
      if (this.queue.length) {
        const next = this.queue.shift();
        this.play(next.key, { scale: next.scale, speed: next.speed });
      } else if (this.release) {
        this.release.t -= dt;
        if (this.release.t <= 0) {
          this.release = null;
          this.out = REST;
          return this.out;
        }
        const r = this.release;
        const e = (r.t / RELEASE) ** 2;        // ease out, and land flat
        this.out = {
          x: r.x * e, y: r.y * e, rot: r.rot * e,
          sx: 1 + (r.sx - 1) * e, sy: 1 + (r.sy - 1) * e, lid: r.lid * e,
          gazeX: r.gazeX === null ? null : r.gazeX * e,
          gazeY: r.gazeY === null ? null : r.gazeY * e,
        };
        return this.out;
      } else {
        this.out = REST;
        this.path = null;
        return this.out;
      }
    }

    const m = this.cur;
    m.t += dt;
    const u = clamp(m.t / m.dur, 0, 1);
    const k = m.scale;

    const p = m.def.pose ? m.def.pose(u, m.t) || {} : {};
    // Amplitude scaling has to be about the rest value, not about zero, or a
    // half-strength squash would read as half a body.
    this.out = {
      x: (p.x || 0) * k,
      y: (p.y || 0) * k,
      rot: (p.rot || 0) * k,
      sx: 1 + ((p.sx ?? 1) - 1) * k,
      sy: 1 + ((p.sy ?? 1) - 1) * k,
      lid: (p.lid || 0) * k,
      gazeX: p.gazeX === undefined ? null : p.gazeX * k,
      gazeY: p.gazeY === undefined ? null : p.gazeY * k,
    };

    if (m.def.path) {
      const q = m.def.path(u, m.t) || { x: 0, y: 0 };
      this.path = { x: (q.x || 0) * k, y: (q.y || 0) * k };
    } else {
      this.path = null;
    }

    if (u >= 1) {
      this.cur = null;
      // Ending on the queue's next move rather than on rest keeps a chain
      // continuous — no one-frame snap back to neutral between beats.
      if (this.queue.length) {
        const next = this.queue.shift();
        this.play(next.key, { scale: next.scale, speed: next.speed });
      } else {
        this._beginRelease();
      }
    }
    return this.out;
  }
}

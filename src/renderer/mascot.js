// The mascot loop.
//
// The window is one transparent, click-through overlay spanning every display, so
// the bot moves by CSS transform rather than by dragging an OS window around —
// that is what lets it roam, arc through a throw, and cross monitors smoothly.
// Physics works in absolute desktop coordinates; `origin` converts to window-local.

import DATA from '../shared/mascot-data.js';
import { Mark, SHAPE_KEYS, seasonalAccessory } from './lib/mark.js';
import { EMOTIONS, getEmotion } from './lib/emotions.js';
import { Particles } from './lib/particles.js';
import { Bubble } from './lib/bubble.js';
import { Physics, MODE } from './lib/physics.js';
import { Brain } from './lib/behavior.js';
import { Attention, STANCE } from './lib/attention.js';
import { Gestures } from './lib/gestures.js';
import { Focus } from './lib/focus.js';
import { Sound } from './lib/sound.js';
import { Choreo, MOVES, EMOTION_MOVES, moveFor } from './lib/moves.js';
import { say, side, LINES, setVoice, setLanguage } from './lib/dialogue.js';
import { resolveCoat, rgba } from '../shared/themes.js';
import { clamp, rand, pick, chance, approach, ease, lerpExpression, makeNoise, TAU } from './lib/geom.js';

const api = window.emoo;

const stage = document.getElementById('stage');
const botEl = document.getElementById('bot');
const markHost = document.getElementById('markHost');
const shadowEl = document.getElementById('shadow');
const glowEl = document.getElementById('glow');
const fxCanvas = document.getElementById('fx');
const bubbleEl = document.getElementById('bubble');
const bubbleTextEl = document.getElementById('bubbleText');
const hintEl = document.getElementById('grabHint');

const mark = new Mark(markHost);
const fx = new Particles(fxCanvas);
const bubble = new Bubble(bubbleEl, bubbleTextEl);
const physics = new Physics();

const noise = { bob: makeNoise(7), sway: makeNoise(19) };

// The particle canvas is a bounded box that follows the body, so per-frame canvas
// work stays constant no matter how large the overlay is.
const FX_SIZE = 720;
const FX_HALF = FX_SIZE / 2;

const S = {
  settings: null,
  origin: { x: 0, y: 0 },     // window's top-left in desktop coordinates
  win: { w: 0, h: 0 },

  emotion: 'idle',
  emotionDef: EMOTIONS.idle,
  sticky: false,
  holdLeft: 0,

  rings: DATA.expressions[EMOTIONS.idle.expr].map((r) => r.map((p) => p.slice())),
  fromRings: null,
  toRings: DATA.expressions[EMOTIONS.idle.expr],
  morphT: 1,
  morphSpeed: 6,

  lid: 0,
  droop: 0,
  blinkAmount: 0,
  blinkPhase: 0,
  nextBlink: rand(2, 5),

  gaze: { x: 0, y: 0 },
  wanderTarget: { x: 0, y: 0 },
  wanderTimer: 0,

  squash: 0,
  squashVel: 0,
  spin: 0,
  spinVel: 0,
  blush: 0,
  star: 0,

  cursor: { x: 0, y: 0, has: false },
  hovering: false,       // over the body OR its bubble: the window must take clicks
  onBody: false,         // over the body itself
  interactive: false,
  dragging: false,
  dragOffset: { x: 0, y: 0 },
  dragMoved: 0,
  dragStart: 0,

  petTime: 0,
  petCooldown: 0,
  tickleReversals: 0,
  tickleWindow: 0,
  lastCursorDir: 0,

  flinchAt: -99,
  moveCooldown: 0,       // keeps spontaneous choreography from stacking up

  walkLeft: 0,
  idleSeconds: 0,
  typingBeat: 0,        // seconds until the next beat of the typing act
  typingFor: 0,         // how long this typing stretch has run
  activity: null,        // { kind, label } of the app in front
  reactCooldown: 0,      // throttles reactions to what you are doing
  hostId: null,          // display the body is currently on
  dpr: window.devicePixelRatio || 1,
  clock: 0,
  lastFrame: performance.now(),
  queued: [],
  savedAt: 0,
  local: { x: 0, y: 0 },
  fxOrigin: { cx: FX_HALF, cy: FX_HALF, r: 64 },

  glow: 0,               // colour glow strength, 0..1
  bondSaveIn: 30,        // seconds until the meters are written back
  humming: false,
  shelf: [],             // files the user has parked on it
  machine: { battery: null, charging: true, online: true, cpu: 0 },
  machineFlags: { low: false, critical: false, offline: false, busy: false },
};

// 'auto' follows the calendar; 'none' is bare; anything else is worn all year.
const resolveAccessory = (choice) => {
  if (!choice || choice === 'none') return null;
  if (choice === 'auto') return seasonalAccessory();
  return choice;
};

// Which pack it speaks from. The interface language and the bot's voice are two
// different choices: 'eg' — Egyptian Arabic mixed with English — is a way of
// talking, not a locale, so it exists here and nowhere in the menus. 'auto'
// means "whatever the interface is in", which is what most people want.
let uiLang = 'en';
function applyVoicePack() {
  const choice = S.settings?.voice || 'auto';
  setLanguage(choice === 'auto' ? uiLang : choice);
}

const brain = new Brain(handleIntent);
const attention = new Attention();
const gestures = new Gestures();
const focus = new Focus();
const sound = new Sound();
const choreo = new Choreo();

// A gesture brings its own sound and its own particles, so the move table stays
// the one place a gesture is described and call sites only name it.
choreo.onStart = (key, def) => {
  if (def.sound) sound.cue(def.sound);
  if (def.fx) fx.burst(def.fx, S.fxOrigin, def.fx === 'confetti' ? 22 : 8);
};

// ---------------------------------------------------------------- gestures
// Where a move actually starts from, in desktop coordinates. Path moves are
// authored as an offset from here, so a lap of the monitor is the same curve
// wherever it is performed.
const moveAnchor = { x: 0, y: 0 };

// `play` is the single door into the choreography layer. It refuses when the
// body is not free — mid-drag, mid-throw or asleep — so a gesture can never
// fight the physics for control of the same pixels.
function play(name, opts = {}) {
  if (!name || !MOVES[name]) return false;
  if (S.dragging || brain.asleep) return false;
  if (!opts.force && (S.moveCooldown > 0 || choreo.active)) return false;
  moveAnchor.x = physics.x;
  moveAnchor.y = physics.y;
  S.moveCooldown = opts.cooldown ?? 0.6;
  return choreo.play(name, opts);
}

// "Do something that reads as happy" — the brain and the reactions ask for a
// mood, not for a named gesture, so adding a move to moves.js puts it into
// rotation everywhere at once.
const playTagged = (tag, opts) => play(moveFor(tag), opts);

// ---------------------------------------------------------------- emotions
function setEmotion(key, opts = {}) {
  const def = getEmotion(key);
  if (!def) return;
  const changed = key !== S.emotion;
  S.emotion = key;
  S.emotionDef = def;
  S.sticky = !!opts.sticky;
  S.holdLeft = opts.hold ?? def.hold ?? 0;

  if (changed || opts.force) {
    S.fromRings = S.rings.map((r) => r.map((p) => p.slice()));
    S.toRings = DATA.expressions[def.expr];
    S.morphT = 0;
    S.morphSpeed = def.settle;
    fx.clearAccumulator();
    api?.emotionChanged?.(key);
    // Getting angry should DO something, not merely look like something. Not
    // every time, or the gestures stop being events — most feelings pass
    // quietly, and the ones that do not are the ones you remember. `play`
    // refuses on its own when gestures are switched off.
    const pool = opts.move === false ? null : EMOTION_MOVES[key];
    if (pool && chance(0.42)) play(pick(pool));
  }
  if (def.blink && S.nextBlink > def.blink[1]) S.nextBlink = rand(def.blink[0], def.blink[1]);
}

function handleIntent(intent) {
  switch (intent.type) {
    case 'emotion':
      setEmotion(intent.key, { sticky: intent.sticky, hold: intent.hold });
      break;
    case 'say':
      if (intent.delay) S.queued.push({ t: intent.delay, fn: () => speak(intent.text) });
      else speak(intent.text);
      break;
    case 'hop':
      physics.hop(intent.power ?? 1);
      setEmotion('happy');
      break;
    case 'walk':
      if (S.settings?.roam && physics.startWalk()) {
        S.walkLeft = intent.duration;
        setEmotion('walking', { sticky: true });
      }
      break;
    case 'travel':
      travelToNeighbour(intent.dir);
      break;
    case 'flourish':
      // A quick barrel roll. Only reads as playful in the air.
      S.spinVel += (chance(0.5) ? 1 : -1) * rand(22, 30);
      setEmotion(pick(['excited', 'happy', 'laughing']));
      break;
    case 'move':
      play(intent.key, { force: intent.force });
      break;
    case 'moveTag':
      playTagged(intent.tag);
      break;
  }
}

const speak = (text, opts) => { if (text) bubble.say(text, opts); };

// A side word: one or two syllables, on screen briefly. Deliberately a separate
// door from `speak` — these fire on beats far too small to justify a sentence,
// and they are gated on chatter the same way everything else it says is.
function blurt(kind, p = 0.7) {
  if (!S.settings?.chatter || S.settings.focusMode) return;
  if (bubble.state === 'typing' || !chance(p)) return;
  bubble.say(side(kind), { hold: 1.1, speed: 90 });
}

// Hop across to an adjacent monitor. Deliberately fast: at strolling pace the
// body would sit clipped by the screen edge for over a second, whereas at this
// speed the crossing reads as passing behind the bezel.
function travelToNeighbour(dir) {
  const want = dir ?? (chance(0.5) ? 1 : -1);
  const target = physics.neighbour(want) || physics.neighbour(-want) || physics.otherDisplay();
  if (!target) return false;
  S.walkLeft = 0;
  physics.travelTo(target);
  setEmotion('excited', { sticky: true });
  if (S.settings.chatter && chance(0.4)) speak(say('travel'));
  return true;
}

// ---------------------------------------------------------------- reactions
function react(kind) {
  // Every handled interaction is also a lifetime counter, which is what lets it
  // say "you have thrown me 200 times" months later.
  const COUNTER = { poke: 'pokes', pet: 'pets', tickle: 'tickles' };
  if (COUNTER[kind]) brain.count(COUNTER[kind]); else brain.interacted();

  switch (kind) {
    case 'poke': {
      // Poking escalates. The first is a surprise, the fourth is an intrusion,
      // and past that it is a bit. Each rung has its own face, gesture and line,
      // which is what makes leaning on the mouse button worth doing at all. The
      // ladder itself lives in gestures.js, with the rest of the thresholds.
      if (brain.asleep) { gestures.poke(brain.mood); reactWakePoke(); break; }
      const rung = gestures.poke(brain.mood);
      if (rung === 3) {
        setEmotion('furious');
        play('fume', { force: true });
        // Queued rather than forced, or storming off would cut the fuming short
        // and the whole point is that you see it lose its temper first. Storming
        // off is also the only reaction that costs the user anything: they now
        // have to go and find it again.
        if (!S.settings.gravity) choreo.play('retreat', { queue: true });
        if (S.settings.chatter) speak(say('clickStorm'));
        brain.displeased(0.14);
        sound.grumble();
      } else if (rung === 2) {
        setEmotion('exasperated');
        play('huff', { force: true });
        if (S.settings.chatter) speak(say('clickStorm'));
        brain.displeased(0.09);
      } else if (rung === 1) {
        setEmotion('annoyed');
        playTagged('annoyed');
        if (S.settings.chatter && chance(0.6)) speak(say('ignored'));
        brain.displeased(0.06);
      } else {
        setEmotion(pick(['surprised', 'happy', 'curious', 'wink', 'giggling', 'delighted']));
        playTagged(chance(0.5) ? 'startle' : 'happy');
        if (S.settings.chatter) {
          chance(0.45) ? speak(say('poke')) : blurt(pick(['ow', 'hey', 'huh']), 0.8);
        }
        brain.pleased(0.05);
      }
      physics.nudge(rand(-70, 70), -190);
      impact(0.22);
      sound.poke();
      break;
    }
    case 'pet':
      setEmotion(brain.affection > 0.6 ? 'adoring' : pick(['content', 'cozy', 'beaming']));
      brain.pleased(0.09);
      if (chance(0.35)) fx.burst('heart', S.fxOrigin, 2);
      if (chance(0.4)) play('nuzzle');
      if (S.settings.chatter) chance(0.3) ? speak(say('pet')) : blurt('aww', 0.5);
      sound.emote('happy');
      break;
    case 'tickle':
      setEmotion(chance(0.5) ? 'laughing' : 'giggling');
      play('jelly', { force: true });
      brain.pleased(0.14);
      if (S.settings.chatter) chance(0.6) ? speak(say('tickle')) : blurt('heh', 0.8);
      sound.emote('laughing');
      break;
    case 'talk':
      setEmotion(pick(['talking', 'happy', 'curious', 'thinking', 'pondering', 'teasing']));
      playTagged('talk');
      speak(say(pick(['idleMusing', 'compliment', 'hungry', 'poke'])));
      break;
  }
}

// ---- the newer gestures --------------------------------------------------
// Each of these is a pattern in the cursor feed rather than a click: holding
// still on the body, circling it, shaking it, staring at it. They cost nothing
// to perform and nobody has to be told they exist, which is the point.

function reactWakePoke() {
  brain.wake(false);
  setEmotion('grumpy');
  play('jolt', { force: true });
  brain.displeased(0.08);
  if (S.settings.chatter) speak(say('wakePoke'));
  sound.hmph();
}

function reactHug() {
  brain.count('pets', 1.2);
  brain.pleased(0.16);
  setEmotion(brain.affection > 0.5 ? 'adoring' : 'cozy', { hold: 5 });
  play('heartbeat', { force: true });
  fx.burst('heart', S.fxOrigin, 5);
  sound.startPurr();
  if (S.settings.chatter) speak(say('hug'));
}

function reactShaken() {
  sound.stopPurr();
  brain.interacted();
  brain.displeased(0.05);
  setEmotion('dizzy', { hold: 4.5 });
  if (S.settings.chatter) chance(0.7) ? speak(say('shaken')) : blurt('ugh', 0.9);
  sound.wobble();
}

function reactOrbited() {
  brain.interacted();
  setEmotion('dizzy', { hold: 4 });
  play('hypnotised', { force: true });
  if (S.settings.chatter) speak(say('spun'));
}

function reactHoverNear() {
  if (!canReact(8)) return;
  setEmotion(pick(['peek', 'curious', 'eavesdropping', 'spying']));
  play(chance(0.5) ? 'peer' : 'lean');
  if (S.settings.chatter && chance(0.4)) speak(say('hoverNear'));
}

function reactFlinch() {
  if (S.clock - S.flinchAt < 6) return;
  S.flinchAt = S.clock;
  setEmotion(pick(['spooked', 'scared', 'surprised']));
  play(pick(['flinch', 'recoil', 'jumpScare']), { force: true });
  impact(0.2);
  if (S.settings.chatter) chance(0.5) ? speak(say('flinchNear')) : blurt('hey', 0.9);
}

// Everything gestures.js noticed this frame. Same shape as onAttentionEvent:
// the detector decides that something happened, this decides what it means.
function onGestureEvent(ev) {
  switch (ev.type) {
    case 'hug': reactHug(); break;
    case 'shaken': reactShaken(); break;
    case 'orbited': reactOrbited(); break;
    case 'hoverNear': reactHoverNear(); break;
    case 'stare':
      setEmotion('inspecting', { sticky: true, hold: 0 });
      if (S.settings.chatter && chance(0.6)) speak(say('stare'));
      break;
    case 'stareLost':
      // It blinks first. Always. The only thing that varies is how long it
      // manages to hold out first.
      S.sticky = false;
      setEmotion('giggling', { hold: 3 });
      play('wiggle', { force: true });
      brain.pleased(0.08);
      if (S.settings.chatter) speak(say('stareLost'));
      sound.emote('laughing');
      break;
  }
}

const impact = (amount) => { S.squashVel += amount * 34; };

// Something changed about what the user is doing. Reactions are rate-limited so
// it stays a companion rather than a notification stream.
function canReact(cost = 1) {
  if (S.reactCooldown > 0 || brain.asleep || S.dragging) return false;
  S.reactCooldown = cost;
  return true;
}

function onActivity(info) {
  const change = attention.noteApp(info);
  if (!change || !S.settings?.watchActivity) return;
  S.activity = { kind: attention.app.kind, label: attention.app.label };
  focus.noteApp(attention.app.kind, attention.app.label);
  // Switching between windows of the same app is a much smaller event than
  // switching apps entirely.
  if (change !== 'app') return;
  if (!canReact(12)) return;
  setEmotion(pick(['curious', 'listening', 'alert']));
  if (S.settings.chatter && chance(0.5)) {
    speak(appLine(attention.app.kind, attention.app.label));
  }
}

function appLine(kind, label) {
  const lines = LINES[`app_${kind}`];
  const line = lines ? pick(lines) : null;
  return line || say('appOther').replace('{app}', label);
}

// While you are typing, the bot has something to do — a rolling performance for
// as long as your hands are on the keys, rather than one reaction at the start
// of a burst and then twenty seconds of nothing. Typing is most of what anyone
// does at a desk, so it is the state worth filling.
//
// Weighted rather than sequenced: the same keys give a different show each time,
// and the quiet entries outnumber the loud ones so it stays company rather than
// an interruption.
const TYPING_ACT = [
  { key: 'typing', w: 4.5 },
  { key: 'working', w: 3 },
  { key: 'focused', w: 3 },
  { key: 'reading', w: 2.2 },
  { key: 'determined', w: 1.6 },
  { key: 'zen', w: 1.2 },
  { key: 'grooving', w: 1.4, fx: 'note' },
  { key: 'humming', w: 1.2, fx: 'note' },
  { key: 'daydreaming', w: 1, fx: 'think' },
  { key: 'peek', w: 1 },
  { key: 'stretching', w: 0.8 },
  { key: 'yawning', w: 0.7 },
  { key: 'cozy', w: 0.7 },
];

function updateTypingAct(dt) {
  // Its own business while typing, but not while it is being handled, asleep,
  // or deliberately kept quiet.
  const on = attention.typing && attention.typingFor > 1
    && !S.dragging && !brain.asleep && !brain.suppressed && !S.settings.focusMode;
  if (!on) {
    S.typingBeat = 0;
    S.typingFor = 0;
    return;
  }

  S.typingFor += dt;
  S.typingBeat -= dt;
  if (S.typingBeat > 0) return;
  // Longer gaps as the stretch goes on: it settles in rather than fidgeting.
  S.typingBeat = rand(3.4, 6.5) + Math.min(4, S.typingFor * 0.06);

  const total = TYPING_ACT.reduce((s, a) => s + a.w, 0);
  let r = Math.random() * total;
  let act = TYPING_ACT[0];
  for (const a of TYPING_ACT) { r -= a.w; if (r <= 0) { act = a; break; } }

  setEmotion(act.key, { sticky: true, hold: 0 });
  if (act.fx) fx.burst(act.fx, S.fxOrigin, 3);
  // Chattier bots pipe up more often, but never more than about once a minute.
  const chatty = 0.06 + (S.settings.chatty ?? 0.5) * 0.14;
  if (S.settings.chatter && chance(chatty)) speak(say(chance(0.5) ? 'typing' : 'typingLong'));
}

function onAttentionEvent(ev) {
  switch (ev.type) {
    case 'typing':
      if (!canReact(20)) return;
      setEmotion(chance(0.5) ? 'focused' : 'working', { sticky: true, hold: 0 });
      if (S.settings.chatter && chance(0.22)) speak(say('typing'));
      break;
    case 'stoppedTyping':
      if (!canReact(14)) return;
      setEmotion('curious');
      if (S.settings.chatter && chance(0.3)) speak(say('stoppedTyping'));
      break;
    case 'stirred':
      if (!canReact(6)) return;
      if (!S.sticky) setEmotion(pick(['curious', 'listening', 'neutral', 'pondering', 'waiting']));
      break;
    case 'flick':
      if (!canReact(9)) return;
      setEmotion(pick(['surprised', 'alert', 'spooked']));
      play('doubleTake');
      break;
    case 'dodged':
      if (!canReact(4)) return;
      // A cursor coming straight at it at speed is the one moment it is
      // allowed to be genuinely startled rather than merely surprised.
      if (attention.speed > 2600) { reactFlinch(); break; }
      setEmotion(pick(['surprised', 'scared', 'spooked']));
      play('dodgeStep');
      impact(0.18);
      if (S.settings.chatter && chance(0.35)) speak(say('dodge'));
      break;
  }
}

// Patterns in how you are working, rather than which app is in front.
function onFocusEvent(ev) {
  if (!S.settings.chatter) return;
  switch (ev.type) {
    case 'focusLong':
      if (!canReact(30)) return;
      setEmotion(pick(['alert', 'curious', 'thinking']));
      speak(say('focusLong', { mins: ev.minutes, app: ev.app }), { hold: 6 });
      break;
    case 'thrash':
      if (!canReact(25)) return;
      setEmotion('confused');
      speak(say('thrash'), { hold: 5 });
      break;
    case 'lateNight':
      if (!canReact(30)) return;
      setEmotion(pick(['sleepy', 'skeptical']));
      speak(say('lateNight'), { hold: 6 });
      break;
  }
}

// ---------------------------------------------------------------- the machine
// Battery, network and load. Cheap signals that make it feel plugged into the
// actual computer rather than floating on top of it.
function onMachine(next = {}) {
  Object.assign(S.machine, next);
  if (!S.settings?.machineAware || brain.asleep) return;
  const m = S.machine;
  const f = S.machineFlags;

  const pct = m.battery === null ? null : Math.round(m.battery * 100);
  const critical = pct !== null && !m.charging && pct <= 7;
  const low = pct !== null && !m.charging && pct <= 18;

  if (critical && !f.critical) {
    f.critical = true;
    if (canReact(60)) { setEmotion('scared'); speak(say('batteryCritical', { pct }), { hold: 8 }); }
  } else if (low && !f.low) {
    f.low = true;
    if (canReact(60)) { setEmotion('pleading'); speak(say('batteryLow', { pct }), { hold: 7 }); }
  }
  if (m.charging && (f.low || f.critical)) {
    f.low = false; f.critical = false;
    if (canReact(30)) { setEmotion('content'); speak(say('charging')); }
  }

  if (!m.online && !f.offline) {
    f.offline = true;
    if (canReact(30)) { setEmotion('confused'); speak(say('offline')); }
  } else if (m.online && f.offline) {
    f.offline = false;
    if (canReact(20)) { setEmotion('happy'); speak(say('online')); }
  }

  // Sustained load, not a momentary spike.
  const busy = m.cpu > 0.85;
  if (busy && !f.busy) {
    f.busy = true;
    if (canReact(180)) { setEmotion(pick(['working', 'focused'])); speak(say('cpuHigh')); }
  } else if (!busy && m.cpu < 0.6) {
    f.busy = false;
  }
}

function watchMachine() {
  try {
    if (navigator.getBattery) {
      navigator.getBattery().then((b) => {
        const push = () => onMachine({ battery: b.level, charging: b.charging });
        b.addEventListener('levelchange', push);
        b.addEventListener('chargingchange', push);
        push();
      }).catch(() => { /* no battery on this machine */ });
    }
  } catch { /* not supported */ }
  window.addEventListener('online', () => onMachine({ online: true }));
  window.addEventListener('offline', () => onMachine({ online: false }));
  S.machine.online = navigator.onLine !== false;
}

// ---------------------------------------------------------------- hit testing
const overBot = (lx, ly) => {
  const dx = lx - S.local.x;
  const dy = ly - S.local.y;
  const r = S.settings.size * 0.52;
  return dx * dx + dy * dy <= r * r;
};

const overBubble = (lx, ly) => {
  const b = bubble.rect;
  return !!b && lx >= b.left && lx <= b.left + b.w && ly >= b.top && ly <= b.top + b.h;
};

function updateInteractivity() {
  const want = S.dragging || S.hovering;
  if (want !== S.interactive) {
    S.interactive = want;
    api.setInteractive(want);
  }
}

// ---------------------------------------------------------------- input
botEl.addEventListener('pointerdown', (e) => {
  // Middle click asks it to show off: a random gesture from the whole roster,
  // on demand. The one place in the app where you get to pick nothing and it
  // picks something.
  if (e.button === 1) {
    e.preventDefault();
    COMMANDS.trick();
    return;
  }
  if (e.button !== 0) return;
  e.preventDefault();
  try { botEl.setPointerCapture(e.pointerId); } catch { /* not fatal */ }
  S.dragging = true;
  S.dragMoved = 0;
  S.dragStart = performance.now();
  botEl.classList.add('is-held');
  S.dragOffset.x = physics.x - S.cursor.x;
  S.dragOffset.y = physics.y - S.cursor.y;
  physics.grab(physics.x, physics.y);
  gestures.grabbed();
  // A gesture and a hand cannot both own the body. The hand wins.
  choreo.stop();
  brain.suppressed = true;
  brain.interacted();
  setEmotion('held', { sticky: true });
  if (S.settings.chatter && chance(0.3)) speak(say('grab'));
  sound.pop();
});

function endDrag(e) {
  if (!S.dragging) return;
  S.dragging = false;
  botEl.classList.remove('is-held');
  try { botEl.releasePointerCapture(e.pointerId); } catch { /* pointer already released */ }
  brain.suppressed = false;
  if (gestures.released()) {
    sound.stopPurr();
    // Being put down after a hug is a small loss, and it is worth showing.
    if (chance(0.5)) { setEmotion(pick(['content', 'grateful', 'wistful']), { hold: 3 }); play('nodSlow'); }
  }

  const speed = physics.release();
  const heldFor = (performance.now() - S.dragStart) / 1000;

  if (S.dragMoved < 6 && heldFor < 0.35) {
    physics.stop();
    S.sticky = false;
    react('poke');
    return;
  }

  setEmotion('falling', { sticky: true });
  if (speed > 900) {
    S.spinVel += Math.sign(physics.vx || 1) * clamp(speed / 90, 6, 40);
    if (S.settings.chatter && chance(0.5)) speak(say('throw'));
    brain.displeased(0.04);
    brain.counters.throws += 1;
    sound.whoosh(speed);
  }
  savePosition(true);
}

botEl.addEventListener('pointerup', endDrag);
botEl.addEventListener('pointercancel', endDrag);
botEl.addEventListener('dblclick', (e) => { e.preventDefault(); react('talk'); });
botEl.addEventListener('contextmenu', (e) => {
  e.preventDefault();
  api.openMenu({ emotion: S.emotion, shelf: S.shelf });
});

botEl.addEventListener('wheel', (e) => {
  e.preventDefault();
  if (e.shiftKey) {
    const i = SHAPE_KEYS.indexOf(S.settings.shape);
    const dir = e.deltaY > 0 ? 1 : SHAPE_KEYS.length - 1;
    api.updateSettings({ shape: SHAPE_KEYS[(i + dir) % SHAPE_KEYS.length] });
  } else {
    const size = clamp(Math.round(S.settings.size - Math.sign(e.deltaY) * 8), 64, 260);
    api.updateSettings({ size });
    showHint(`${size}px`);
  }
}, { passive: false });

bubbleEl.addEventListener('pointerdown', () => bubble.hide());

// ---------------------------------------------------------------- the shelf
// Files dropped on the body are held until you take them back — a pet-shaped
// parking spot for the thing you are about to need. The overlay is normally
// click-through, but hovering it already makes it interactive, so by the time a
// dragged file is over the body the window is a real drop target.
const SHELF_MAX = 6;

const swallowDrag = (e) => { e.preventDefault(); e.stopPropagation(); };
stage.addEventListener('dragenter', swallowDrag);
stage.addEventListener('dragover', (e) => {
  swallowDrag(e);
  e.dataTransfer.dropEffect = 'copy';
  if (!S.sticky) setEmotion('curious');
});

stage.addEventListener('drop', (e) => {
  swallowDrag(e);
  // `File.path` was removed in Electron 32; the real path now comes from
  // webUtils, which only the preload can reach.
  const paths = [...(e.dataTransfer?.files || [])]
    .map((f) => api.pathForFile?.(f))
    .filter(Boolean);
  if (!paths.length) return;

  const room = SHELF_MAX - S.shelf.length;
  if (room <= 0) {
    setEmotion('annoyed');
    speak(say('shelfFull'));
    return;
  }
  const taken = paths.slice(0, room);
  S.shelf = [...S.shelf, ...taken];
  api.setShelf?.(S.shelf);
  brain.interacted();
  brain.pleased(0.05);
  setEmotion('held');
  impact(0.3);
  sound.pop();
  const base = taken[0].split(/[\\/]/).pop();
  speak(say('shelfTake', { name2: base }));
});

// ---------------------------------------------------------------- cursor feed
function onCursor(pt) {
  attention.noteCursor(pt);
  const prevX = S.cursor.x;
  const prevY = S.cursor.y;
  const moved = pt.x !== S.cursor.x || pt.y !== S.cursor.y;
  S.cursor.x = pt.x;
  S.cursor.y = pt.y;
  S.cursor.has = true;
  if (!S.settings) return;

  const lx = pt.x - S.origin.x;
  const ly = pt.y - S.origin.y;
  const on = overBot(lx, ly);

  if (on && !S.hovering && !S.dragging) {
    brain.interacted(0.4);
    if (brain.asleep || S.emotion === 'sleepy') brain.wake();
    else if (chance(0.3) && !S.sticky) setEmotion('curious');
  }
  // `hovering` covers the bubble too, because both must make the window
  // clickable. `onBody` is the stricter one — the cursor genuinely on the
  // character — which is what the staring contest means by eye contact.
  S.onBody = on;
  S.hovering = on || overBubble(lx, ly);
  updateInteractivity();

  // Everything that is a *pattern* in the cursor feed rather than a click —
  // hugging, shaking, circling, loitering, staring — is read in gestures.js and
  // arrives as an event from the frame loop.
  if (S.dragging) {
    S.dragMoved += Math.hypot(pt.x - prevX, pt.y - prevY);
    physics.dragTo(pt.x + S.dragOffset.x, pt.y + S.dragOffset.y, S.clock);
    return;
  }

  if (!on || !moved) {
    S.petTime = Math.max(0, S.petTime - 0.05);
    return;
  }

  // Rapid direction reversals on the body read as tickling; slower sustained
  // movement reads as petting.
  const dir = Math.sign(pt.x - prevX);
  if (dir !== 0 && S.lastCursorDir !== 0 && dir !== S.lastCursorDir) {
    S.tickleReversals++;
    S.tickleWindow = 1.1;
  }
  if (dir !== 0) S.lastCursorDir = dir;

  if (S.tickleReversals >= 5 && S.petCooldown <= 0) {
    S.tickleReversals = 0;
    S.petCooldown = 3;
    react('tickle');
  } else {
    S.petTime += 0.02;
    if (S.petTime > 0.9 && S.petCooldown <= 0) {
      S.petTime = 0;
      S.petCooldown = 4.5;
      react('pet');
    }
  }
}

// ---------------------------------------------------------------- settings
function applySettings(next) {
  const prev = S.settings;
  S.settings = next;

  const { coat, ink, gradient } = resolveCoat(next.coat, next.customCoat, next.gradient);
  const root = document.documentElement.style;
  root.setProperty('--coat', coat);
  root.setProperty('--ink', ink);
  root.setProperty('--size', `${next.size}px`);
  // The glow takes its colour from the coat, so it is always the bot shining
  // rather than a light source that happens to be behind it. A gradient shines
  // in two of its own colours, which is the whole reason it is worth having.
  const g = gradient ? gradient.colors : [coat, coat];
  root.setProperty('--glow-core', rgba(g[g.length - 1], 0.6));
  root.setProperty('--glow-mid', rgba(g[0], 0.26));
  S.glow = clamp(next.glow ?? 0, 0, 1);
  mark.setColors({ coat, ink, gradient });
  mark.setShape(next.shape);
  fx.setColors({ coat, ink });
  stage.style.opacity = String(next.opacity ?? 1);

  physics.radius = next.size * 0.5;
  physics.gravityEnabled = !!next.gravity;
  // Grab feel. Squared so the slider spends most of its travel in the range
  // people can actually feel — past a point, stiffer is just "glued to cursor".
  const grab = clamp(next.grabResponse ?? 0.8, 0, 1);
  physics.holdStiffness = 120 + grab * grab * 12000;

  attention.enabled = !!next.followCursor;
  attention.watchApps = !!next.watchActivity;
  attention.rideWindows = !!next.rideWindows;
  attention.home = next.home || null;
  attention.homeWhenBusy = !!next.homeWhenBusy;
  attention.focusMode = !!next.focusMode;
  document.body.classList.toggle('is-flying', !next.gravity);

  choreo.enabled = next.gestures !== false;
  if (!choreo.enabled) choreo.stop();

  applyVoicePack();

  brain.enabled.roam = !!next.roam;
  brain.enabled.chatter = !!next.chatter;
  brain.enabled.sleep = !!next.sleepWhenIdle;
  brain.enabled.nudges = !!next.nudges;
  brain.quiet = !!next.focusMode;
  brain.setPersonality({ chatty: next.chatty, clingy: next.clingy, sassy: next.sassy });

  setVoice({ name: next.name, sassy: next.sassy });
  sound.set({ enabled: next.soundEnabled, volume: next.volume });
  mark.setAccessory(resolveAccessory(next.accessory));

  if (!prev || !next.chatter) return;
  if (prev.shape !== next.shape && chance(0.6)) { setEmotion('curious'); speak(say('shapeChange')); }
  else if ((prev.coat !== next.coat || prev.customCoat !== next.customCoat) && chance(0.6)) {
    setEmotion('happy'); speak(say('colorChange'));
  }
}

function layout(win) {
  S.origin.x = win.x;
  S.origin.y = win.y;
  S.win.w = win.width;
  S.win.h = win.height;
  S.dpr = window.devicePixelRatio || 1;
  fx.resize(FX_SIZE, FX_SIZE, S.dpr);
}

// Moving between monitors of different scaling changes devicePixelRatio, and the
// effects canvas has to be re-backed at the new density or particles go soft.
function watchPixelRatio() {
  const check = () => {
    const dpr = window.devicePixelRatio || 1;
    if (Math.abs(dpr - S.dpr) > 0.001) {
      S.dpr = dpr;
      fx.resize(FX_SIZE, FX_SIZE, dpr);
    }
    // matchMedia only fires once per threshold, so re-arm against the new value.
    matchMedia(`(resolution: ${dpr}dppx)`).addEventListener('change', check, { once: true });
  };
  check();
}

function savePosition(force) {
  if (!force && S.clock - S.savedAt < 4) return;
  S.savedAt = S.clock;
  api.updateSettings({ position: { x: Math.round(physics.x), y: Math.round(physics.y) } });
}

// ---------------------------------------------------------------- frame
let fxWasEmpty = true;

function frame(now) {
  requestAnimationFrame(frame);
  let dt = (now - S.lastFrame) / 1000;
  if (dt > 0.1) dt = 0.1;              // a stall must not teleport the mascot
  if (dt <= 0 || !S.settings) { S.lastFrame = now; return; }

  // Nothing on screen needs 60fps while the mascot is asleep or the user has
  // stepped away and it is just breathing.
  const dozing = (brain.asleep || brain.userAway)
    && !S.dragging && !bubble.visible && fx.items.length === 0;
  if (dozing && dt < 1 / 30) return;
  S.lastFrame = now;
  S.clock += dt;

  for (let i = S.queued.length - 1; i >= 0; i--) {
    S.queued[i].t -= dt;
    if (S.queued[i].t <= 0) S.queued.splice(i, 1)[0].fn();
  }

  const def = S.emotionDef;

  // ---- physics
  for (const ev of physics.update(dt)) {
    if (ev.type === 'land') {
      impact(clamp(ev.speed / 900, 0.1, 0.7));
      fx.burst('dust', S.fxOrigin, ev.speed > 700 ? 10 : 5);
      sound.land(ev.speed);
      if (ev.speed > 950 && !S.dragging) {
        setEmotion(ev.speed > 1700 ? 'dizzy' : 'squished');
        if (S.settings.chatter && chance(0.4)) speak(say('drop'));
      }
    } else if (ev.type === 'bounce') {
      impact(clamp(ev.speed / 1200, 0.08, 0.45));
      S.spinVel += (ev.surface === 'left' ? 1 : -1) * clamp(ev.speed / 140, 2, 16);
      sound.bounce(ev.speed);
      if (ev.speed > 700 && S.settings.chatter && chance(0.3)) speak(say('bounce'));
    } else if (ev.type === 'settle') {
      if (S.emotion === 'falling' || S.emotion === 'held') { S.sticky = false; setEmotion('idle'); }
      savePosition(true);
    } else if (ev.type === 'arrived') {
      savePosition(false);
    } else if (ev.type === 'recover') {
      if (S.emotion === 'falling') { S.sticky = false; setEmotion('idle'); }
    } else if (ev.type === 'turn') {
      // Reaching the edge of a screen is a natural moment to consider the next one.
      if (S.settings.roam && chance(0.28) && travelToNeighbour(ev.at === 'right' ? 1 : -1)) {
        // handled: now airborne toward the neighbouring display
      } else if (chance(0.3)) {
        setEmotion('curious');
      }
    }
  }

  if (S.walkLeft > 0) {
    S.walkLeft -= dt;
    if (S.walkLeft <= 0 && physics.mode === MODE.WALKING) {
      physics.stop();
      S.sticky = false;
      setEmotion('idle');
      savePosition(true);
    }
  }

  // ---- attention: where it wants to be, and what just changed
  if (S.reactCooldown > 0) S.reactCooldown -= dt;
  const hostDisplay = physics.hostFor();
  for (const ev of attention.update(dt, {
    body: { x: physics.x, y: physics.y },
    radius: S.settings.size * 0.5,
    display: hostDisplay,
    displays: physics.displays,
    held: S.dragging,
  })) onAttentionEvent(ev);

  // Chasing a window the user is dragging needs a far tighter loop than drifting
  // to a spot that will still be there in a second. Eased rather than switched,
  // so letting go of a window does not snap the body to a halt.
  physics.trackTight = approach(physics.trackTight, attention.tracking ? 1 : 0, 6, dt);

  // ---- what it gets up to while you type
  updateTypingAct(dt);

  // ---- how long you have actually been at this
  for (const ev of focus.update(dt, {
    chatty: S.settings.focusReports && !S.settings.focusMode && !brain.asleep,
  })) onFocusEvent(ev);

  // Write the meters back periodically. A crash should cost minutes of a
  // relationship, not the whole thing.
  S.bondSaveIn -= dt;
  if (S.bondSaveIn <= 0) {
    S.bondSaveIn = 30;
    api.saveBond?.(brain.status);
  }

  // A continuous breathing tone while asleep, started and stopped rather than
  // retriggered so it is genuinely continuous.
  const shouldHum = brain.asleep && !!S.settings.soundEnabled;
  if (shouldHum !== S.humming) {
    S.humming = shouldHum;
    if (shouldHum) sound.startHum(); else sound.stopHum();
  }

  // Hand the flight system its target. Only while actually flying under its own
  // power — a throw, a drag or a nap all take precedence.
  // A home spot is reason enough to move even with following and roaming both
  // off — otherwise "park here while I work" would silently do nothing. So is
  // riding: "sit on the window I am using" is just as much a destination.
  const mayMove = S.settings.followCursor || S.settings.roam
    || (S.settings.rideWindows && S.settings.watchActivity)
    || (S.settings.home && (S.settings.homeWhenBusy || S.settings.focusMode));
  const flightFree = !S.dragging && !brain.asleep
    && physics.mode === MODE.FLOATING && !physics.gravityEnabled;
  // A travelling gesture owns the flight target for as long as it runs — a lap
  // of the monitor is not a suggestion the attention system gets a vote on.
  // Tightened tracking too, or the steering lag turns every figure-eight into a
  // vague oval.
  if (choreo.path && flightFree) {
    const size = S.settings.size;
    physics.trackTight = 1;
    physics.hoverTo(moveAnchor.x + choreo.path.x * size, moveAnchor.y + choreo.path.y * size);
  } else if (mayMove && flightFree) {
    physics.hoverTo(attention.target.x, attention.target.y);
  }

  // ---- brain
  brain.update(dt, {
    busy: S.dragging || bubble.state === 'typing',
    emotionKey: S.emotion,
    canMove: !S.dragging && physics.mode !== MODE.FLYING && S.settings.roam,
    screens: physics.displays.length,
    flying: !S.settings.gravity,
    stance: attention.stance,
  });

  if (!S.sticky && S.holdLeft > 0) {
    S.holdLeft -= dt;
    if (S.holdLeft <= 0 && !S.dragging) setEmotion(brain.asleep ? 'sleeping' : 'idle');
  }

  // ---- expression morph
  if (S.morphT < 1) {
    S.morphT = Math.min(1, S.morphT + S.morphSpeed * dt);
    S.rings = lerpExpression(S.fromRings, S.toRings, ease.outCubic(S.morphT));
  } else {
    S.rings = S.toRings;
  }

  // ---- eyelids: a constant droop per emotion, with blinks layered on top so a
  // blink from a half-closed state still closes all the way.
  if (S.blinkPhase > 0) {
    S.blinkPhase -= dt / 0.14;
    S.blinkAmount = Math.sin(clamp(1 - S.blinkPhase, 0, 1) * Math.PI);
    if (S.blinkPhase <= 0) S.blinkAmount = 0;
  } else {
    S.blinkAmount = 0;
    if (def.blink) {
      S.nextBlink -= dt;
      if (S.nextBlink <= 0) {
        S.blinkPhase = 1;
        S.nextBlink = rand(def.blink[0], def.blink[1]);
      }
    }
  }
  S.droop = approach(S.droop, def.lidBias || 0, 6, dt);
  S.lid = clamp(S.droop + S.blinkAmount * (1 - S.droop), 0, 0.97);

  updateGaze(dt, def);

  // ---- springs
  S.squashVel += (-S.squash * 300 - S.squashVel * 16) * dt;
  S.squash = clamp(S.squash + S.squashVel * dt, -0.45, 0.45);
  S.spinVel *= Math.exp(-2.2 * dt);
  S.spin += S.spinVel * dt;
  if (Math.abs(S.spinVel) < 0.4) { S.spinVel = 0; S.spin = approach(S.spin, 0, 5, dt); }

  if (S.petCooldown > 0) S.petCooldown -= dt;
  if (S.tickleWindow > 0) { S.tickleWindow -= dt; if (S.tickleWindow <= 0) S.tickleReversals = 0; }
  if (S.moveCooldown > 0) S.moveCooldown -= dt;

  // The gestures that are patterns in the cursor feed rather than clicks.
  for (const ev of gestures.update(dt, {
    cursor: S.cursor,
    body: { x: physics.x, y: physics.y },
    radius: S.settings.size * 0.5,
    dragging: S.dragging,
    onBody: S.onBody && !S.dragging,
    asleep: brain.asleep,
    speed: attention.speed,
    quiet: !!S.settings.focusMode,
  })) onGestureEvent(ev);

  // ---- body transform
  const t = S.clock;
  const bob = Math.sin(t * def.bob.rate * TAU) * def.bob.amp + noise.bob(t * 0.4) * 1.4;
  const sway = Math.sin(t * def.sway.rate * TAU + 1.1) * def.sway.amp + noise.sway(t * 0.3) * 0.8;
  const breathe = Math.sin(t * def.breathe.rate * TAU) * def.breathe.amp;
  const jx = def.jitter ? (Math.random() - 0.5) * def.jitter * 4 : 0;
  const jy = def.jitter ? (Math.random() - 0.5) * def.jitter * 4 : 0;

  const stretch = physics.velocityStretch;
  const flying = physics.mode === MODE.FLOATING;
  // Bank into the direction of travel. Powered flight leans; a thrown body
  // tumbles; a walking body just sways a little.
  const travelTilt = flying
    ? clamp(physics.vx / 26, -20, 20)
    : clamp(physics.vx / 55, -14, 14) * (physics.mode === MODE.FLYING ? 1 : 0.45);
  // Airborne bodies nose down slightly as they pick up speed.
  const noseDown = flying ? clamp(Math.abs(physics.vx) / 900, 0, 1) * 3 : 0;

  // Squash and stretch conserve area: height lost is width gained.
  const sq = S.squash;
  const sx = def.scale * (1 - breathe + sq * 0.85 + stretch.amount * Math.abs(Math.cos(stretch.angle)));
  const sy = def.scale * (1 + breathe - sq + stretch.amount * Math.abs(Math.sin(stretch.angle)));

  // ---- choreography, layered on top of the emotion's own pose
  const g = choreo.update(dt);

  mark.update({
    rings: S.rings,
    gaze: { x: S.gaze.x + (g.gazeX ?? 0), y: S.gaze.y + (g.gazeY ?? 0) },
    lid: clamp(S.lid + g.lid * (1 - S.lid), 0, 0.97),
    eyeScale: def.eye,
    body: {
      x: jx + g.x,
      y: bob + def.yOffset + jy + noseDown + g.y,
      rot: sway + def.lean + travelTilt + S.spin + g.rot,
      sx: sx * g.sx,
      sy: sy * g.sy,
    },
    blush: (S.blush = approach(S.blush, def.blush, 6, dt)),
    star: (S.star = approach(S.star, def.star, 5, dt)),
  });

  // ---- place everything in window-local space
  const lx = physics.x - S.origin.x;
  const ly = physics.y - S.origin.y;
  S.local.x = lx;
  S.local.y = ly;

  botEl.style.transform = `translate3d(${lx.toFixed(1)}px, ${ly.toFixed(1)}px, 0)`;

  const size = S.settings.size;
  // How far off the ground it is, 0..1. Flying is always fully airborne, so its
  // shadow sits lower, smaller and fainter — the cue that reads as "hovering".
  const air = physics.airborne;
  const drop = size * (0.52 + air * 0.28);
  shadowEl.style.transform =
    `translate3d(${lx.toFixed(1)}px, ${(ly + drop).toFixed(1)}px, 0) ` +
    `scale(${((size / 100) * (1 - air * 0.42)).toFixed(3)})`;
  shadowEl.style.opacity = ((1 - air * 0.62) * 0.9).toFixed(3);

  // The glow breathes on the same wave the body does, so it reads as the bot
  // shining rather than as a lamp pointed at it — and it swells when it is
  // excited, because `breathe.amp` is already the measure of how worked up it
  // is. Skipped entirely at zero, which is the default, so nobody pays for it.
  if (S.glow > 0.001) {
    const pulse = 0.72 + 0.28 * Math.sin(t * def.breathe.rate * TAU);
    glowEl.style.transform =
      `translate3d(${lx.toFixed(1)}px, ${ly.toFixed(1)}px, 0) scale(${(1 + breathe * 2).toFixed(3)})`;
    glowEl.style.opacity = (S.glow * pulse).toFixed(3);
  } else if (glowEl.style.opacity !== '0') {
    glowEl.style.opacity = '0';
  }

  // ---- particles (canvas rides along with the body)
  fxCanvas.style.transform = `translate3d(${(lx - FX_HALF).toFixed(1)}px, ${(ly - FX_HALF).toFixed(1)}px, 0)`;
  S.fxOrigin.r = size * 0.5;
  if (def.fx) fx.emit(def.fx, S.fxOrigin, dt);
  fx.update(dt);
  const empty = fx.items.length === 0;
  if (!empty || !fxWasEmpty) fx.draw(S.fxOrigin);
  fxWasEmpty = empty;

  // ---- bubble
  bubble.update(dt);
  bubble.layout({ x: lx, y: ly, r: size * 0.55 }, { w: S.win.w, h: S.win.h });

  if (physics.mode === MODE.WALKING) savePosition(false);

  // Window handoff. Detected here rather than in the main process so a fast
  // throw switches monitors on the same frame it crosses, not a round trip later.
  if (hostDisplay && hostDisplay.id !== S.hostId) {
    S.hostId = hostDisplay.id;
    api.setDisplay(hostDisplay.id);
  }
}

function updateGaze(dt, def) {
  let tx = 0, ty = 0;
  const max = 15 * (def.gazeGain || 0);

  if (def.gaze === 'follow' && S.cursor.has && S.settings.gazeFollowsCursor) {
    const dx = S.cursor.x - physics.x, dy = S.cursor.y - physics.y;
    const d = Math.hypot(dx, dy) || 1;
    // Full deflection once the cursor is a couple of body-widths away.
    const reach = clamp(d / (S.settings.size * 1.8), 0, 1);
    tx = (dx / d) * max * reach;
    ty = (dy / d) * max * reach;
  } else if (def.gaze === 'away' && S.cursor.has) {
    const dx = S.cursor.x - physics.x, dy = S.cursor.y - physics.y;
    const d = Math.hypot(dx, dy) || 1;
    tx = -(dx / d) * max * 0.7;
    ty = -(dy / d) * max * 0.7;
  } else if (def.gaze === 'wander') {
    S.wanderTimer -= dt;
    if (S.wanderTimer <= 0) {
      S.wanderTimer = rand(0.7, 2);
      const a = rand(TAU), m = rand(0.3, 1);
      S.wanderTarget.x = Math.cos(a) * max * m;
      S.wanderTarget.y = Math.sin(a) * max * m;
    }
    tx = S.wanderTarget.x;
    ty = S.wanderTarget.y;
  } else if (def.gaze === 'down') {
    ty = max * 0.8;
  }

  S.gaze.x = approach(S.gaze.x, tx, 7, dt);
  S.gaze.y = approach(S.gaze.y, ty, 7, dt);
}

function showHint(text) {
  hintEl.textContent = text;
  hintEl.style.transform =
    `translate3d(${S.local.x}px, ${S.local.y + S.settings.size * 0.72}px, 0) translateX(-50%)`;
  hintEl.classList.add('is-visible');
  clearTimeout(S._hintT);
  S._hintT = setTimeout(() => hintEl.classList.remove('is-visible'), 1600);
}

// ---------------------------------------------------------------- commands from main
const COMMANDS = {
  emotion: (p) => setEmotion(p.key, { hold: p.hold, force: true }),
  say: (p) => {
    if (p.emotion) setEmotion(p.emotion);
    speak(p.text || say(pick(['idleMusing', 'compliment', 'hungry', 'bored'])));
  },
  hop: () => { physics.hop(1); setEmotion('happy'); },

  // Asked to show off, from either menu or from a middle click. Picks from the
  // whole gesture roster rather than repeating one party piece.
  trick: () => {
    brain.interacted();
    brain.pleased(0.05);
    if (!playTagged(pick(['show', 'play', 'dance', 'travel']), { force: true })) return;
    setEmotion(pick(['playful', 'proud', 'mischievous', 'delighted', 'giddy']));
    if (S.settings.chatter && chance(0.6)) speak(say('trick'));
  },
  celebrate: () => {
    setEmotion('celebrating');
    fx.burst('confetti', S.fxOrigin, 42);
    speak(say('celebrate'));
  },
  wake: () => brain.wake(),
  sleep: () => brain.sleep(),
  greet: () => brain.greet(),
  place: (p) => { physics.place(p.x, p.y); physics.stop(); savePosition(true); },
  reset: () => {
    setEmotion('idle', { force: true });
    physics.stop();
    fx.clear();
    bubble.hide();
    S.sticky = false;
  },
  hint: (p) => showHint(p.text),

  // The user picked a parking spot: wherever the body is standing right now.
  setHome: () => {
    const home = { x: Math.round(physics.x), y: Math.round(physics.y) };
    api.updateSettings({ home, homeWhenBusy: true });
    setEmotion('proud');
    fx.burst('sparkle', S.fxOrigin, 8);
    speak(say('homeSet'));
    showHint('home set');
  },
  // Main picked the spot (cursor or a corner) — it owns screen geometry. All
  // that is left here is to go there and say so.
  homePlaced: (p) => {
    physics.hoverTo(p.x, p.y);
    setEmotion('proud');
    fx.burst('sparkle', S.fxOrigin, 8);
    speak(say('homeSet'));
    showHint('spot set');
  },
  clearHome: () => {
    api.updateSettings({ home: null });
    setEmotion('curious');
    speak(say('homeCleared'));
  },
  goHome: () => {
    if (!S.settings.home) return;
    physics.hoverTo(S.settings.home.x, S.settings.home.y);
    setEmotion('working');
  },
  focusToggle: (p) => {
    setEmotion(p.on ? 'focused' : 'happy');
    speak(say(p.on ? 'focusOn' : 'focusOff'));
  },

  // "How long have I been at this?"
  report: () => {
    const r = focus.report();
    setEmotion('thinking');
    if (!r.kind || r.minutes < 1) {
      speak(say('focusShort', { mins: Math.max(1, r.minutes) }), { hold: 6 });
      return;
    }
    speak(say('focusReport', { mins: r.minutes, app: r.app }), { hold: 7 });
  },

  // A timer, alarm or pomodoro phase came due.
  timer: (p) => {
    const urgent = p.kind === 'timer';
    sound.chime(urgent);
    if (p.kind === 'pomodoro-break') {
      setEmotion('celebrating');
      fx.burst('confetti', S.fxOrigin, 24);
      speak(say('pomodoroBreak', { mins: p.minutes }), { hold: 10 });
    } else if (p.kind === 'pomodoro-work') {
      setEmotion('focused');
      speak(say('pomodoroWork', { mins: p.minutes }), { hold: 8 });
    } else {
      setEmotion('alert');
      physics.hop(0.8);
      speak(say('timerDone', { label: p.label }), { hold: 12 });
    }
  },
  timerSet: (p) => {
    setEmotion('working');
    speak(say('timerSet', { mins: p.minutes }));
  },

  shelf: (p) => { S.shelf = Array.isArray(p.files) ? p.files : []; },

  menuOpen: () => {
    if (S.settings.chatter && chance(0.35)) speak(say('menuOpen'), { hold: 3 });
  },

  reclamp: () => {
    physics.settleOnScreen();
    S.hostId = physics.hostFor().id;
    savePosition(true);
  },
};

// ---------------------------------------------------------------- boot
api.onSettings(applySettings);
// The interface language, resolved by main because 'auto' means the OS locale.
// It only decides the voice when the voice setting is itself on 'auto'.
api.onLanguage?.((l) => { uiLang = l || 'en'; applyVoicePack(); });
api.onLayout(layout);
api.onCursor(onCursor);
api.onDisplays((list) => { physics.setDisplays(list); S.hostId = null; });
api.onIdle((seconds) => {
  S.idleSeconds = seconds;
  attention.noteIdle(seconds);
  focus.noteIdle(seconds);
  brain.setUserAway(seconds > 60);
});
api.onActivity((info) => onActivity(info));
api.onCommand((cmd, payload) => COMMANDS[cmd]?.(payload || {}));
api.onPlace((p) => { physics.place(p.x, p.y); physics.stop(); });
api.onMachine?.((info) => onMachine(info));

watchPixelRatio();
watchMachine();

// The bubble types itself out; this gives it a voice while it does. Pitched by
// whatever it is feeling, so the same sentence sounds different when it is
// sulking — which is the whole reason it is not just a keyboard click.
bubble.onType = () => { if (chance(0.4)) sound.voice(S.emotion); };

// Debug hook: lets a dev capture pose the character deterministically. Exposes
// only this page's own state — nothing privileged crosses the preload boundary.
window.__emoo = {
  state: S, physics, brain, attention, gestures, focus, sound, fx, bubble, mark, choreo,
  setEmotion, speak, play, playTagged, commands: COMMANDS,
  pose({ x, y, emotion, shape, text, burst, count, coat, ink }) {
    // Freeze the autonomous parts so a capture is deterministic.
    brain.suppressed = true;
    S.queued.length = 0;
    physics.gravityEnabled = false;
    physics.setDisplays([{ x: S.origin.x, y: S.origin.y, w: S.win.w, h: S.win.h, id: -1 }]);
    if (shape) mark.setShape(shape);
    if (coat) { mark.setColors({ coat, ink: ink || '#fff' }); fx.setColors({ coat, ink: ink || '#fff' }); }
    if (x !== undefined) { physics.place(x + S.origin.x, y + S.origin.y); physics.stop(); }
    if (emotion) setEmotion(emotion, { force: true, sticky: true });
    if (text) speak(text, { hold: 30 });
    if (burst) fx.burst(burst, S.fxOrigin, count || 18);
    S.cursor.has = false;
    return { local: S.local, origin: S.origin, win: S.win };
  },
};

api.ready().then((boot) => {
  layout(boot.window);
  // Seed the meters BEFORE settings, so personality is applied to a brain that
  // already remembers how it feels about you.
  uiLang = boot.lang || 'en';
  brain.loadBond(boot.bond);
  S.shelf = Array.isArray(boot.shelf) ? boot.shelf : [];
  applySettings(boot.settings);
  physics.setDisplays(boot.displays);
  physics.place(boot.position.x, boot.position.y);
  // The saved spot may be on a monitor that is no longer attached, or that has
  // changed resolution since. Pull it back onto real screen space first.
  physics.settleOnScreen();
  S.hostId = physics.hostFor().id;
  if (S.hostId !== boot.hostId) api.setDisplay(S.hostId);
  setEmotion('idle', { force: true });
  if (boot.settings.greetOnLaunch) {
    const awayDays = Math.floor((boot.bond?.awayHours || 0) / 24);
    S.queued.push({ t: 0.9, fn: () => brain.greet({ awayDays }) });
  }
  requestAnimationFrame(frame);
});

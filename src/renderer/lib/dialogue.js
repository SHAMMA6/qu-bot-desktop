// Voice: lowercase, dry, short. It is a colleague-ish little bot, not a puppy —
// it comments on things rather than begging for attention.

import { pick } from './geom.js';
import { AR, AR_SASSY } from './dialogue-ar.js';
import { EG, EG_SASSY } from './dialogue-eg.js';

// English is the canonical table: every other pack is checked against its keys
// and its {placeholders} by `npm test`, so a translation can never quietly
// render a sentence with a hole in it.
export const LINES = {
  greetMorning: [
    'morning. i kept the desktop warm.',
    'you are up. i was starting to wonder.',
    'morning. nothing broke overnight.',
    'coffee first. i can wait.',
  ],
  greetAfternoon: [
    'afternoon. how is it going out there?',
    'still here. still round.',
    'good afternoon. i have been thinking about nothing.',
    'halfway. keep going.',
  ],
  greetEvening: [
    'evening. the screen looks nice at this hour.',
    'evening. wrapping up, or pretending to?',
    'the light is better now.',
  ],
  greetNight: [
    'it is late. just saying.',
    'you and me and the taskbar.',
    'i will not tell anyone you are still up.',
    'night shift. respect.',
  ],

  poke: [
    'ow. rude.',
    'yes? i am right here.',
    'poked. noted.',
    'that is my whole body, you know.',
    'again? fine.',
    'i felt that.',
    'careful, i am mostly vector.',
  ],
  pet: [
    'oh. that is nice.',
    'keep doing that.',
    'i have no fur but i appreciate the gesture.',
    'ok this is my favourite interaction.',
    'you may continue.',
  ],
  tickle: [
    'stop — no — ok that is funny.',
    'i do not even have ribs.',
    'ha. ok. ok!',
    'you are shaking me.',
  ],
  grab: [
    'whoa.',
    'up we go.',
    'hello, hand.',
    'i am being relocated.',
    'careful with the merchandise.',
  ],
  drop: [
    'landed.',
    'that was a landing.',
    'nailed it.',
    'ground. good. solid.',
    'i meant to do that.',
  ],
  throw: [
    'wheeeee — ow.',
    'that was uncalled for.',
    'i am telling someone about this.',
    'physics. great.',
    'ok that was actually fun. again?',
  ],
  bounce: [
    'boing.',
    'wall.',
    'found the edge.',
  ],
  dizzy: [
    'everything is spinning. thanks.',
    'i need a second.',
    'too much. too much.',
    'which way is up.',
  ],

  // Reactions to the app in front. The mascot only ever names the *kind* of app,
  // never the window title.
  app_browser: [
    'browsing. classic.',
    'what are we reading?',
    'oh, the internet. bold choice.',
    'tab number what, exactly?',
  ],
  app_editor: [
    'code. nice.',
    'building something?',
    'i will keep quiet. mostly.',
    'do not forget to save.',
  ],
  app_terminal: [
    'ooh, the scary black window.',
    'typing at the computer directly. respect.',
    'careful in there.',
  ],
  app_chat: [
    'talking to humans. interesting.',
    'say hi from me.',
    'is it about me?',
  ],
  app_media: [
    'good pick.',
    'i cannot hear it, but i believe in it.',
    'this looks like a break to me.',
  ],
  app_games: [
    'oh, we are playing now.',
    'i will stay out of the way.',
    'good luck out there.',
  ],
  app_docs: [
    'documents. serious.',
    'words. lots of words.',
    'this looks important.',
  ],
  app_files: [
    'organising? ambitious.',
    'what are we looking for?',
  ],
  app_creative: [
    'ooh. making something.',
    'i want to see it when it is done.',
  ],
  app_ai: [
    'talking to another one, are we?',
    'i see how it is.',
    'ask it something hard.',
    'it cannot even float.',
  ],
  appOther: [
    'what is {app}, then?',
    'new one on me.',
    'huh. ok.',
  ],

  typing: [
    'do not mind me.',
    'i will hover quietly.',
    'you are on a roll.',
    'typing. i will get out of the way.',
  ],
  typingLong: [
    'still going. respect.',
    'this is a whole paragraph now.',
    'your hands are faster than mine.',
    'i will keep quiet over here.',
    'work appears to be happening.',
    'you are on a run.',
  ],
  stoppedTyping: [
    'done?',
    'that was a lot of keys.',
    'and... breathe.',
  ],
  dodge: [
    'whoa — watch it.',
    'nearly got me.',
    'hey!',
    'i am flying here.',
  ],
  watching: [
    'i am just watching.',
    'do not let me distract you.',
    'i see you.',
  ],

  travel: [
    'going to check the other screen.',
    'brb. other monitor.',
    'i heard something over there.',
    'this screen is getting stale.',
    'wheee — other side.',
  ],

  wake: [
    'i am up i am up.',
    'oh — hi. was i out?',
    'what did i miss?',
    'five more — no, fine, i am awake.',
  ],
  sleepy: [
    'getting heavy...',
    'i might just rest my eyes.',
    'long day, huh.',
  ],
  bored: [
    'nothing is happening.',
    'i have counted the pixels. twice.',
    'we could do something. or not.',
    'is this what desktops do all day?',
  ],
  idleMusing: [
    'the wallpaper is holding up well.',
    'i wonder what is behind the taskbar.',
    'you have a lot of windows open. no judgement.',
    'i have been thinking about circles.',
    'do you ever think about how small a pixel is?',
    'i am technically 25 expressions in a trench coat.',
    'if you drag me to a corner i will stay there. mostly.',
    'i like this desktop. good desktop.',
    'somewhere a fan is spinning for us.',
    'take a break at some point. just a thought.',
    'i have no idea what most of these icons do.',
    'the cursor never gets tired. i find that suspicious.',
    'if i had pockets, i would keep things in them.',
    'do you think the other windows talk about me?',
    'i have been practising standing still. i am very good at it.',
    'somewhere out there is a folder you have not opened since 2019.',
    'i could learn a language. i have the time.',
    'every so often i think about the recycle bin.',
    'this is a nice bit of screen. good screen.',
    'i am not procrastinating, i am idling. different thing.',
    'the scrollbar knows things.',
    'one day this will all be a screenshot.',
  ],

  compliment: [
    'you are doing fine.',
    'that looked deliberate. i respect it.',
    'good call.',
    'nice.',
  ],
  celebrate: [
    'we did it. mostly you.',
    'that deserves confetti and i have confetti.',
    'excellent. genuinely.',
  ],
  hungry: [
    'do bots eat? asking for me.',
    'i could go for some electricity.',
  ],
  ignored: [
    'still here.',
    'no rush.',
    'i will wait.',
  ],
  returned: [
    'welcome back.',
    'you were gone a while.',
    'oh good, you exist.',
    'i held the fort.',
  ],
  hourChime: [
    'it is the top of the hour, if that helps.',
    'another hour, gone.',
    'time keeps doing that.',
  ],
  breakNudge: [
    'you have been at this a while. stretch?',
    'blink. seriously. i do it constantly.',
    'water exists. just putting that out there.',
  ],
  shapeChange: [
    'new silhouette. how do i look?',
    'oh. this is different.',
    'i like this one.',
    'restructured.',
  ],
  colorChange: [
    'new coat.',
    'this colour suits me.',
    'ooh.',
  ],
  menuOpen: ['what do you need?', 'options.', 'go ahead.'],
// ---- long stretches in one app -----------------------------------------
  focusLong: [
    '{mins} minutes in {app}. just so you know.',
    'you have been in {app} for {mins} minutes straight.',
    '{mins} minutes on this. still going?',
    'that is {mins} minutes without looking up.',
  ],
  focusReport: [
    '{mins} minutes in {app} so far.',
    'you have had {app} up for {mins} minutes.',
    '{mins} minutes. i have been counting.',
  ],
  focusShort: [
    'about {mins} minutes here.',
    '{mins} minutes, give or take.',
  ],
  thrash: [
    'you have flipped between those twice now. stuck?',
    'back and forth. back and forth.',
    'whatever you are looking for, it is not in either of those.',
  ],
  lateNight: [
    'it is past two. i am not your mother, but.',
    'the sensible hours ended a while ago.',
    'still up. ok. i am up too, then.',
  ],
  longAway: [
    'you were gone {days} days. i counted.',
    '{days} days. the desktop got very quiet.',
    'oh good, you came back.',
  ],

  // ---- the relationship ----------------------------------------------------
  bond1: [
    'we are getting used to each other.',
    'you are around a lot. i like that.',
  ],
  bond2: [
    'day {days}. not that i am counting. i am counting.',
    'we have done {days} days of this.',
    'you have poked me {pokes} times, by the way.',
  ],
  bond3: [
    'day {days}. this is the longest job i have ever had.',
    '{hours} hours together. i checked.',
    'i would notice if you stopped opening me.',
  ],
  bond4: [
    'day {days}. i live here now.',
    '{hours} hours. you are stuck with me.',
    'i have been thrown {throws} times and i keep coming back. think about that.',
  ],
  anniversary: [
    'it has been a year. of this. of us.',
    'one year today. no card, i notice.',
  ],
  milestone: [
    'that is {count} pokes. a milestone, arguably.',
    '{count}. i keep count of these things.',
  ],

  // ---- timers and pomodoro -------------------------------------------------
  timerDone: [
    'that is your {label}.',
    '{label}. time.',
    'timer up: {label}.',
  ],
  timerSet: [
    '{mins} minutes. i will shout.',
    'noted. {mins} minutes.',
    'counting down from {mins}.',
  ],
  pomodoroWork: [
    'right. {mins} minutes of actual work.',
    'go. i will keep quiet.',
    'clock is running. {mins} minutes.',
  ],
  pomodoroBreak: [
    'stop. {mins} minute break.',
    'that is a block done. get up.',
    'break. {mins} minutes. properly.',
  ],

  // ---- the machine ---------------------------------------------------------
  batteryLow: [
    'battery is at {pct}%. just saying.',
    '{pct}% left. i am not going to nag. much.',
    'you have {pct}% of a computer left.',
  ],
  batteryCritical: [
    '{pct}%. plug something in.',
    'we are about to lose this argument with physics.',
  ],
  charging: [
    'ah. power.',
    'good. i was getting worried.',
  ],
  offline: [
    'the network went away.',
    'no internet. it is very quiet out there.',
  ],
  online: [
    'we are back online.',
    'the internet returned.',
  ],
  cpuHigh: [
    'something is really working the processor.',
    'the fans have opinions about whatever that is.',
    'this machine is busy. i can feel it.',
  ],

  // ---- the shelf -----------------------------------------------------------
  shelfTake: [
    'got it. i will hold this.',
    'fine. i am a shelf now.',
    'holding {name2}.',
  ],
  shelfFull: [
    'my arms are full. metaphorically.',
    'that is enough. i only have so much... whatever this is.',
  ],
  shelfGive: [
    'here. take it back.',
    'delivered.',
  ],

  // ---- home and focus ------------------------------------------------------
  homeSet: [
    'right. this is my spot now.',
    'noted. i will wait here.',
    'my corner. i like it.',
  ],
  homeCleared: [
    'free again.',
    'no spot. back to drifting.',
  ],
  focusOn: [
    'quiet mode. go do the thing.',
    'i will be over here, not bothering you.',
    'go on. i will wait.',
  ],
  focusOff: [
    'and we are back.',
    'done? good.',
  ],

  hidden: ['i will be in the tray.', 'call me back anytime.'],

  // ---- side words ----------------------------------------------------------
  // One or two words, never a sentence. `blurt()` fires these on the small beats
  // — a poke, a near miss, a landing — where a whole line would be too much
  // talking. They are what stops a companion from being either silent or a
  // monologue: most of what anyone says to a colleague all day is this short.
  sideOw: ['ow.', 'oof.', 'ouch!', 'hey!'],
  sideHey: ['hey!', 'oi.', 'excuse me.', 'hello?'],
  sideWow: ['whoa.', 'wow.', 'no way.', 'huh!'],
  sideYay: ['yes!', 'nice!', 'got it!', 'ha!'],
  sideUgh: ['ugh.', 'seriously.', 'great.', 'sure.'],
  sideHmm: ['hmm.', 'huh.', 'well.', 'so...'],
  sideHeh: ['heh.', 'ha.', 'ok that is funny.'],
  sideOops: ['oops.', 'my bad.', 'ignore that.'],
  sideYes: ['yep.', 'ok.', 'sure.', 'right.'],
  sideNo: ['nope.', 'no.', 'not that.'],
  sideHuh: ['huh?', 'sorry?', 'what?'],
  sideAww: ['aww.', 'oh.', 'that is nice.'],

  // ---- the newer ways you can bother it ------------------------------------
  hug: [
    'oh. a hug. ok.',
    'this is... genuinely fine.',
    'i will stay right here.',
    'your cursor is warm. odd.',
  ],
  clickStorm: [
    'stop. stop!',
    'i am not a button.',
    'enough! honestly.',
    'we talked about this.',
  ],
  stare: [
    'fine. eye contact.',
    'i am not blinking first.',
    'i do not blink. try me.',
  ],
  stareLost: [
    'fine, i blinked. congratulations.',
    'you win. happy?',
    'my eyes are dry. you win.',
  ],
  shaken: [
    'why are you shaking me?',
    'everything inside me just moved.',
    'stop! stop!',
    'i am not a cocktail.',
  ],
  spun: [
    'why are you circling me?',
    'you are making me dizzy on purpose.',
    'round and round. thanks.',
  ],
  flinchNear: [
    'whoa!',
    'that nearly got me.',
    'careful with that thing.',
  ],
  hoverNear: [
    'i can see you there.',
    'did you need something?',
    'come closer, i do not bite.',
    'yes? i am right here.',
  ],
  trick: [
    'watch this.',
    'check this out.',
    'observe.',
    'again? go on then.',
  ],
  wakePoke: [
    'i was asleep!',
    'what — i was mid-dream.',
    'why would you do that.',
  ],
  highfive: [
    'up top!',
    'there it is.',
    'nailed it.',
  ],
  peekaboo: [
    'boo!',
    'gone — no, back.',
    'did that work?',
  ],
  sneeze: [
    'ahh— sorry.',
    'hatchoo. there is no dust in here.',
    'that was a sneeze, not an error.',
  ],
  hiccup: [
    'hic — sorry.',
    'hiccups. i have no idea either.',
    'hold on. hic. moment.',
  ],
  dance: [
    'put something on, i am ready.',
    'i have got rhythm. somewhere.',
    'do not stop me now.',
  ],
  resize: [
    'roomier.',
    'this size works.',
    'fine. i am flexible.',
  ],
};

// Voice: the user's chosen name plus their personality sliders. Sassiness picks
// a spikier variant of a line where one exists, so two people's bots read
// differently without needing two whole scripts.
const VOICE = { name: 'EMoO BOT', sassy: 0.5 };

export function setVoice(next = {}) {
  if (typeof next.name === 'string' && next.name.trim()) VOICE.name = next.name.trim();
  if (Number.isFinite(next.sassy)) VOICE.sassy = Math.max(0, Math.min(1, next.sassy));
}

// Spikier alternatives, used more often the higher the sassy slider is.
export const SASSY = {
  poke: [
    'do that again and see what happens.',
    'i am not a button.',
    'wow. bold.',
    'incredible. groundbreaking.',
  ],
  pet: [
    'yes. obviously. continue.',
    'i allow this.',
  ],
  breakNudge: [
    'get up. you are becoming furniture.',
    'stand. stretch. i will wait.',
  ],
  bored: [
    'i could be doing anything else. i am not, but i could.',
    'riveting.',
  ],
  typing: [
    'lot of typing. some of it is probably right.',
    'go off i guess.',
  ],
};

// The packs it can speak in. English is the fallback for everything, so a pack
// that is missing a bucket falls back to a real line rather than to silence.
export const PACKS = {
  en: { lines: LINES, sassy: SASSY },
  ar: { lines: AR, sassy: AR_SASSY },
  eg: { lines: EG, sassy: EG_SASSY },
};

export const LANGUAGES = Object.keys(PACKS);

let pack = PACKS.en;

export function setLanguage(lang) {
  pack = PACKS[lang] || PACKS.en;
}

const fill = (line, vars) => {
  let out = String(line).split('{name}').join(VOICE.name);
  if (vars) {
    for (const k of Object.keys(vars)) out = out.split('{' + k + '}').join(String(vars[k]));
  }
  return out;
};

export const say = (key, vars) => {
  const spicy = pack.sassy[key];
  const pool = (spicy && Math.random() < VOICE.sassy * 0.75)
    ? spicy
    : (pack.lines[key] || LINES[key] || LINES.idleMusing);
  return fill(pick(pool), vars);
};

// The side-word buckets, named by the beat they suit rather than by bucket key,
// so a call site reads `side('ow')` instead of remembering the table. Kept as an
// explicit map rather than built from the string, because a typo in a computed
// key would silently fall through to English and nobody would notice.
export const SIDE = {
  ow: 'sideOw', hey: 'sideHey', wow: 'sideWow', yay: 'sideYay',
  ugh: 'sideUgh', hmm: 'sideHmm', heh: 'sideHeh', oops: 'sideOops',
  yes: 'sideYes', no: 'sideNo', huh: 'sideHuh', aww: 'sideAww',
};

export const SIDE_KINDS = Object.keys(SIDE);

// One or two words, in the current pack. Used for the beats too small to spend
// a sentence on.
export const side = (kind) => say(SIDE[kind] || SIDE.hmm);

// The bond line for a level, if that level has anything new to say.
export const bondLine = (level, vars) => {
  const pool = pack.lines['bond' + level] || LINES['bond' + level];
  return pool ? fill(pick(pool), vars) : null;
};

export function greeting(date = new Date()) {
  const h = date.getHours();
  if (h < 5) return say('greetNight');
  if (h < 12) return say('greetMorning');
  if (h < 18) return say('greetAfternoon');
  if (h < 22) return say('greetEvening');
  return say('greetNight');
}

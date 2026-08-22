// Voice: lowercase, dry, short. It is a colleague-ish little bot, not a puppy —
// it comments on things rather than begging for attention.

import { pick } from './geom.js';

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
  hidden: ['i will be in the tray.', 'call me back anytime.'],
};

export const say = (key) => pick(LINES[key] || LINES.idleMusing);

export function greeting(date = new Date()) {
  const h = date.getHours();
  if (h < 5) return say('greetNight');
  if (h < 12) return say('greetMorning');
  if (h < 18) return say('greetAfternoon');
  if (h < 22) return say('greetEvening');
  return say('greetNight');
}

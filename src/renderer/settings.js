// Settings window. Reuses the same Mark renderer as the mascot itself, so the
// preview and the shape chips are the real character, not illustrations of it.

import DATA from '../shared/mascot-data.js';
import { Mark, SHAPE_KEYS } from './lib/mark.js';
import { EMOTIONS, EMOTION_GROUPS } from './lib/emotions.js';
import { COATS, resolveCoat } from '../shared/themes.js';
import { centroid, ringPath, clamp, TAU, approach, rand } from './lib/geom.js';

const api = window.qubotSettings;
const $ = (id) => document.getElementById(id);

let settings = null;
let previewEmotion = 'idle';

// ---------------------------------------------------------------- live preview
const preview = new Mark($('preview'));
let pClock = 0;
let pLast = performance.now();
let pLid = 0;
let pNextBlink = 2;

function previewLoop(now) {
  requestAnimationFrame(previewLoop);
  const dt = Math.min(0.05, (now - pLast) / 1000);
  pLast = now;
  if (!settings) return;
  pClock += dt;

  const def = EMOTIONS[previewEmotion] || EMOTIONS.idle;
  const bob = Math.sin(pClock * def.bob.rate * TAU) * def.bob.amp;
  const sway = Math.sin(pClock * def.sway.rate * TAU + 1.1) * def.sway.amp;
  const breathe = Math.sin(pClock * def.breathe.rate * TAU) * def.breathe.amp;

  pNextBlink -= dt;
  if (pNextBlink <= 0 && def.blink) { pLid = 1; pNextBlink = rand(...def.blink); }
  pLid = approach(pLid, 0, 12, dt);
  const droop = def.lidBias || 0;

  preview.update({
    rings: DATA.expressions[def.expr],
    gaze: { x: 0, y: 0 },
    lid: clamp(droop + pLid * (1 - droop), 0, 0.97),
    eyeScale: def.eye,
    body: {
      x: 0, y: bob + def.yOffset, rot: sway + def.lean,
      sx: def.scale * (1 - breathe), sy: def.scale * (1 + breathe),
    },
    blush: def.blush,
    star: def.star,
  });
}

// ---------------------------------------------------------------- static thumbnails
// A tiny non-animated mark for the shape chips.
function shapeThumb(shapeKey) {
  const shape = DATA.shapes[shapeKey];
  const face = shape.face;
  const C = DATA.HEAD_C;
  const eyes = DATA.expressions[10].map((ring) => {
    const [cx, cy] = centroid(ring);
    const tx = C + face.x + (cx - C) * face.sx;
    const ty = C + face.y + (cy - C) * face.sy;
    return `<path class="mark__eye" d="${ringPath(ring)}" transform="translate(${tx.toFixed(2)} ${ty.toFixed(2)}) scale(${face.eye}) translate(${(-cx).toFixed(2)} ${(-cy).toFixed(2)})"/>`;
  }).join('');
  return `<svg class="mark" viewBox="${DATA.viewBox}" xmlns="http://www.w3.org/2000/svg">
    <path class="mark__head" d="${shape.path}"/>${eyes}</svg>`;
}

// ---------------------------------------------------------------- builders
function buildShapes() {
  $('shapeGrid').innerHTML = SHAPE_KEYS.map((key) => `
    <button class="chip" data-shape="${key}">
      ${shapeThumb(key)}
      <span>${DATA.shapes[key].label}</span>
    </button>`).join('');

  $('shapeGrid').addEventListener('click', (e) => {
    const btn = e.target.closest('[data-shape]');
    if (btn) api.update({ shape: btn.dataset.shape });
  });
}

function buildCoats() {
  $('coatGrid').innerHTML = COATS.map((c) => `
    <button class="swatch" data-coat="${c.key}" title="${c.label}"
            style="background:${c.coat}"></button>`).join('');

  $('coatGrid').addEventListener('click', (e) => {
    const btn = e.target.closest('[data-coat]');
    if (btn) api.update({ coat: btn.dataset.coat });
  });
}

const TOGGLES = [
  ['followCursor', 'Watch what you do', 'Floats near your cursor and the window you are working in'],
  ['watchActivity', 'Notice the app in front', 'Reacts when you switch apps, and perches beside that window. Read locally only, never stored or sent anywhere'],
  ['rideWindows', 'Sit on the window you are using', 'Perches on the title bar and rides along when you move the window'],
  ['homeWhenBusy', 'Wait on its spot while you work', 'Goes to the spot you picked instead of hovering near the cursor'],
  ['focusReports', 'Mention long stretches', 'Notices when you have been in one app for a long time'],
  ['machineAware', 'React to the machine', 'Notices low battery, the network dropping and heavy load'],
  ['autoUpdate', 'Automatic updates', 'Downloads new versions in the background'],
  ['roam', 'Wander around', 'Drifts around the screen on its own when you are idle'],
  ['gravity', 'Gravity', 'Off, it flies. On, it falls and sits on the ground like a desk pet'],
  ['chatter', 'Speech bubbles', 'Occasional remarks and reactions'],
  ['sleepWhenIdle', 'Sleep when idle', 'Dozes off when you step away'],
  ['nudges', 'Occasional nudges', 'Hourly notes and the odd reminder to take a break'],
  ['gazeFollowsCursor', 'Eyes follow cursor', 'Tracks your pointer around the screen'],
  ['soundEnabled', 'Sound', 'Small procedural blips on interaction'],
  ['alwaysOnTop', 'Always on top', 'Floats above other windows'],
  ['greetOnLaunch', 'Greet on launch', 'Says hello when it starts up'],
  ['launchOnLogin', 'Start with Windows', 'Launches quietly when you sign in'],
];

function buildToggles() {
  $('toggles').innerHTML = TOGGLES.map(([key, title, desc]) => `
    <label class="toggle">
      <span class="toggle__text"><strong>${title}</strong><span>${desc}</span></span>
      <input type="checkbox" data-key="${key}" />
    </label>`).join('');

  // Bound on the document rather than on the container: some switches (focus
  // mode) live in their own panel, and render() already updates every
  // [data-key] on the page regardless of where it sits.
  document.addEventListener('change', (e) => {
    const input = e.target.closest('input[type=checkbox][data-key]');
    if (input) api.update({ [input.dataset.key]: input.checked });
  });
}

function buildEmotions() {
  $('emotionGroups').innerHTML = EMOTION_GROUPS.map((g) => `
    <div class="group">
      <h3>${g.name}</h3>
      <div class="emotions">
        ${g.keys.map((k) => `
          <button class="emotion" data-emotion="${k}">
            <span>${EMOTIONS[k].emoji}</span>${EMOTIONS[k].label}
          </button>`).join('')}
      </div>
    </div>`).join('');

  $('emotionGroups').addEventListener('click', (e) => {
    const btn = e.target.closest('[data-emotion]');
    if (!btn) return;
    previewEmotion = btn.dataset.emotion;
    api.command('emotion', { key: previewEmotion });
    document.querySelectorAll('[data-emotion]').forEach((b) => b.classList.toggle('is-on', b === btn));
    $('heroSub').textContent = EMOTIONS[previewEmotion].label;
  });

  // Hovering previews without disturbing the mascot on screen.
  $('emotionGroups').addEventListener('pointerover', (e) => {
    const btn = e.target.closest('[data-emotion]');
    if (btn) previewEmotion = btn.dataset.emotion;
  });
}

function buildTabs() {
  document.querySelector('.tabs').addEventListener('click', (e) => {
    const tab = e.target.closest('.tab');
    if (!tab) return;
    document.querySelectorAll('.tab').forEach((t) => t.classList.toggle('is-active', t === tab));
    document.querySelectorAll('.panel').forEach((p) =>
      p.classList.toggle('is-active', p.dataset.panel === tab.dataset.tab));
  });
}

function buildActions() {
  // There is more than one action row now, so bind them all rather than the
  // first one the document happens to contain.
  document.querySelectorAll('.actions').forEach((row) => {
    row.addEventListener('click', (e) => {
      const btn = e.target.closest('[data-cmd]');
      if (btn) api.command(btn.dataset.cmd);
    });
  });
  $('resetAll').addEventListener('click', () => api.reset());
}

// ---------------------------------------------------------------- timers
const QUICK = [5, 10, 15, 25, 45, 60];

const mmss = (seconds) => {
  const m = Math.floor(seconds / 60);
  const s = seconds % 60;
  return `${m}:${String(s).padStart(2, '0')}`;
};

let timerState = { pomodoro: null, timers: [] };

function renderTimers(next) {
  if (next) timerState = next;
  const list = $('timerList');
  if (!timerState.timers.length) {
    list.innerHTML = '<li class="empty">Nothing running.</li>';
  } else {
    list.innerHTML = timerState.timers.map((t) => `
      <li>
        <span class="timers__label">${escapeText(t.label)}</span>
        <span class="timers__left">${mmss(t.remaining)}</span>
        <button class="link" data-cancel="${t.id}">cancel</button>
      </li>`).join('');
  }
  $('pomodoroToggle').textContent = timerState.pomodoro
    ? `Stop (${timerState.pomodoro})` : 'Start';
}

// Timer labels are user-entered, so they go in as text rather than as markup.
const escapeText = (s) => {
  const d = document.createElement('div');
  d.textContent = String(s ?? '');
  return d.innerHTML;
};

function buildTimers() {
  $('quickTimers').innerHTML = QUICK.map((m) =>
    `<button data-quick="${m}">${m} min</button>`).join('');

  $('quickTimers').addEventListener('click', async (e) => {
    const btn = e.target.closest('[data-quick]');
    if (btn) renderTimers(await api.addTimer(Number(btn.dataset.quick), `${btn.dataset.quick} minute timer`));
  });

  $('addTimer').addEventListener('click', async () => {
    const mins = Number($('timerMinutes').value);
    if (!mins || mins < 1) return;
    const label = $('timerLabel').value.trim() || `${mins} minute timer`;
    renderTimers(await api.addTimer(mins, label));
    $('timerMinutes').value = '';
    $('timerLabel').value = '';
  });

  $('timerList').addEventListener('click', async (e) => {
    const btn = e.target.closest('[data-cancel]');
    if (btn) renderTimers(await api.cancelTimer(btn.dataset.cancel));
  });

  $('pomodoroToggle').addEventListener('click', async () => {
    renderTimers(await api.pomodoro());
  });

  for (const key of ['pomodoroWork', 'pomodoroBreak']) {
    $(key).addEventListener('change', (e) => {
      const v = Number(e.target.value);
      if (v > 0) api.update({ [key]: v });
    });
  }

  // The remaining times are only meaningful if they actually tick.
  setInterval(async () => {
    if (!document.querySelector('[data-panel="focus"].is-active')) return;
    renderTimers(await api.timers());
  }, 1000);
}

// ---------------------------------------------------------------- accessory
const ACCESSORIES = [
  ['auto', 'Automatic'],
  ['none', 'Nothing'],
  ['santa', 'Santa hat'],
  ['witch', 'Witch hat'],
  ['party', 'Party hat'],
  ['shades', 'Sunglasses'],
];

// What 'auto' resolves to today, so the Automatic button can say what you will
// actually get rather than leaving you to guess.
function seasonalToday(date = new Date()) {
  const m = date.getMonth();
  const d = date.getDate();
  if (m === 0 && d <= 2) return 'a party hat';
  if (m === 11 || (m === 0 && d <= 5)) return 'a santa hat';
  if (m === 9 && d >= 24) return 'a witch hat';
  if (m === 6 || m === 7) return 'sunglasses';
  return 'nothing';
}

function buildAccessories() {
  $('accessoryPicker').innerHTML = ACCESSORIES
    .map(([key, label]) => `<button data-accessory="${key}">${label}</button>`).join('');
  $('accessoryPicker').addEventListener('click', (e) => {
    const btn = e.target.closest('[data-accessory]');
    if (btn) api.update({ accessory: btn.dataset.accessory });
  });
}

// ---------------------------------------------------------------- its spot
const CORNERS = [
  ['top-left', 'Top left'],
  ['top-right', 'Top right'],
  ['bottom-left', 'Bottom left'],
  ['bottom-right', 'Bottom right'],
];

function buildCorners() {
  $('cornerPicker').innerHTML = CORNERS
    .map(([key, label]) => `<button data-corner="${key}">${label}</button>`).join('');
  $('cornerPicker').addEventListener('click', (e) => {
    const btn = e.target.closest('[data-corner]');
    if (btn) api.command('__homeCorner', { corner: btn.dataset.corner });
  });
}

// ---------------------------------------------------------------- updates
function renderUpdate(u) {
  if (!u) return;
  const version = u.current ? `You are on ${u.current}. ` : '';
  $('updateState').textContent = version + (u.label || '');
  $('installUpdate').hidden = u.status !== 'ready';
  // A check already in flight, or a build that cannot update, has nothing for
  // the button to do.
  $('checkUpdate').disabled = u.status === 'checking'
    || u.status === 'downloading'
    || u.status === 'unsupported';
}

function buildUpdates() {
  $('checkUpdate').addEventListener('click', async () => {
    renderUpdate({ status: 'checking', label: 'Checking for updates…' });
    renderUpdate(await api.checkUpdate());
  });
  $('installUpdate').addEventListener('click', () => api.installUpdate());
  api.onUpdate(renderUpdate);
}

// ---------------------------------------------------------------- bond
function renderBond(b) {
  if (!b) return;
  const hours = Math.floor(b.seconds / 3600);
  const since = b.firstMet ? new Date(b.firstMet).toLocaleDateString() : '—';
  const rows = [
    ['Known each other', `${b.daysKnown} day${b.daysKnown === 1 ? '' : 's'}`],
    ['First met', since],
    ['Days seen', b.days],
    ['Times opened', b.sessions],
    ['Time together', hours >= 1 ? `${hours} hour${hours === 1 ? '' : 's'}` : '< 1 hour'],
    ['Pokes', b.pokes],
    ['Pets', b.pets],
    ['Tickles', b.tickles],
    ['Throws', b.throws],
    ['Fondness', `${Math.round(b.affection * 100)}%`],
    ['Mood', `${Math.round(b.mood * 100)}%`],
    ['Bond level', `${b.level} of 4`],
  ];
  $('bondStats').innerHTML = rows
    .map(([k, v]) => `<dt>${k}</dt><dd>${escapeText(v)}</dd>`).join('');
}

function buildBond() {
  $('forgetBond').addEventListener('click', async () => {
    renderBond(await api.forgetBond());
  });
  document.querySelector('.tabs').addEventListener('click', async (e) => {
    if (e.target.closest('[data-tab="bond"]')) renderBond(await api.bond());
  });
}

// ---------------------------------------------------------------- sync
function render(next) {
  settings = next;
  const { coat, ink } = resolveCoat(next.coat, next.customCoat);
  document.documentElement.style.setProperty('--coat', coat);
  document.documentElement.style.setProperty('--ink', ink);
  preview.setShape(next.shape);

  document.querySelectorAll('[data-shape]').forEach((b) =>
    b.classList.toggle('is-on', b.dataset.shape === next.shape));
  document.querySelectorAll('[data-coat]').forEach((b) =>
    b.classList.toggle('is-on', b.dataset.coat === next.coat));
  document.querySelectorAll('[data-key]').forEach((i) => { i.checked = !!next[i.dataset.key]; });

  $('customCoat').value = next.customCoat;
  // Same reason as the sliders below: a value echoed back mid-drag drops the
  // thumb wherever the last round trip finished, not where the finger is.
  if (document.activeElement !== $('size')) $('size').value = next.size;
  $('sizeOut').textContent = `${next.size}px`;
  if (document.activeElement !== $('opacity')) $('opacity').value = Math.round(next.opacity * 100);
  $('opacityOut').textContent = `${Math.round(next.opacity * 100)}%`;

  // Do not fight the user mid-word: every keystroke round-trips through the
  // store and comes back here, which would reset the caret to the end.
  if (document.activeElement !== $('botName')) $('botName').value = next.name || '';
  $('heroName').textContent = next.name || 'QU Bot';

  for (const key of PERCENT_SLIDERS) {
    const pct = Math.round((next[key] ?? 0) * 100);
    if (document.activeElement !== $(key)) $(key).value = pct;
    $(`${key}Out`).textContent = `${pct}%`;
  }

  for (const key of ['pomodoroWork', 'pomodoroBreak']) {
    if (document.activeElement !== $(key)) $(key).value = next[key];
  }

  const worn = next.accessory || 'auto';
  document.querySelectorAll('[data-accessory]').forEach((b) =>
    b.classList.toggle('is-on', b.dataset.accessory === worn));
  $('accessoryNote').textContent = worn === 'auto'
    ? `Follows the calendar — today that is ${seasonalToday()}.`
    : '';

  // Say which of the two "where does it wait" rules is actually winning. A spot
  // beats sitting on your window, and finding that out by wondering why the bot
  // never sits on anything is a bad way to learn it.
  const spotWins = next.home && next.homeWhenBusy;
  $('homeState').textContent = !next.home
    ? (next.rideWindows
      ? 'No spot set — it sits on the window you are using instead.'
      : 'No spot set — it drifts around your cursor instead.')
    : spotWins
      ? `Waiting at ${next.home.x}, ${next.home.y} while you work`
        + (next.rideWindows ? ', in preference to sitting on your window.' : '.')
      : `Spot set at ${next.home.x}, ${next.home.y}, used only in focus mode.`;
}

const PERCENT_SLIDERS = ['chatty', 'clingy', 'sassy', 'grabResponse', 'volume'];

for (const key of PERCENT_SLIDERS) {
  $(key).addEventListener('input', (e) => {
    const pct = Number(e.target.value);
    $(`${key}Out`).textContent = `${pct}%`;
    api.update({ [key]: pct / 100 });
  });
}

$('botName').addEventListener('input', (e) => {
  api.update({ name: e.target.value });
});

$('size').addEventListener('input', (e) => {
  $('sizeOut').textContent = `${e.target.value}px`;
  api.update({ size: Number(e.target.value) });
});

$('opacity').addEventListener('input', (e) => {
  $('opacityOut').textContent = `${e.target.value}%`;
  api.update({ opacity: Number(e.target.value) / 100 });
});

$('customCoat').addEventListener('input', (e) => {
  api.update({ customCoat: e.target.value, coat: 'custom' });
});

// ---------------------------------------------------------------- boot
buildTabs();
buildShapes();
buildCoats();
buildToggles();
buildEmotions();
buildActions();
buildTimers();
buildBond();
buildUpdates();
buildAccessories();
buildCorners();

api.onSettings(render);
api.get().then((s) => {
  render(s);
  requestAnimationFrame(previewLoop);
});
api.timers().then(renderTimers);
api.bond().then(renderBond);
api.updateState().then(renderUpdate);
